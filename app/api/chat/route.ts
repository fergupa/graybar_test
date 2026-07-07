import type Anthropic from "@anthropic-ai/sdk";
import { runChiefOfStaff, type AgentEvent } from "@/lib/agents/orchestrator";
import { getStore } from "@/lib/store";
import type { NewAttachment } from "@/lib/store/types";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const ALLOWED_TYPES = [...IMAGE_TYPES, "application/pdf"];
const MAX_ATTACHMENTS = 4;
// Vercel caps request bodies at ~4.5MB; base64 inflates 4/3, so cap the
// combined base64 payload well under that.
const MAX_TOTAL_BASE64_CHARS = 4_000_000;

interface ChatRequestBody {
  /** Omit to start a new conversation. */
  conversationId?: string;
  message: string;
  attachments?: { name?: string; mediaType?: string; data?: string }[];
}

type StreamEvent =
  | AgentEvent
  | { type: "meta"; conversationId: string; title: string; isNew: boolean };

type ImageMediaType = (typeof IMAGE_TYPES)[number];

function toBlocks(
  text: string,
  attachments: { mediaType: string; data: string }[],
): string | Anthropic.ContentBlockParam[] {
  if (attachments.length === 0) return text;
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const att of attachments) {
    if (att.mediaType === "application/pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: att.data },
      });
    } else {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mediaType as ImageMediaType,
          data: att.data,
        },
      });
    }
  }
  if (text) blocks.push({ type: "text", text });
  return blocks;
}

/** Rebuild a stored message into API content, refetching attachment binaries. */
async function replayMessage(m: ChatMessage): Promise<Anthropic.MessageParam> {
  if (m.role !== "user" || !m.attachments?.length) {
    return { role: m.role, content: m.content };
  }
  const store = getStore();
  const attachments: { mediaType: string; data: string }[] = [];
  const missing: string[] = [];
  for (const att of m.attachments) {
    try {
      attachments.push({
        mediaType: att.mediaType,
        data: await store.getAttachmentData(att.storagePath),
      });
    } catch {
      missing.push(att.name);
    }
  }
  const note = missing.length
    ? `\n[Note: attachment(s) no longer available: ${missing.join(", ")}]`
    : "";
  return { role: "user", content: toBlocks(m.content + note, attachments) };
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key, then restart the dev server.",
      },
      500,
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";

  // Validate attachments.
  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (rawAttachments.length > MAX_ATTACHMENTS) {
    return json({ error: `At most ${MAX_ATTACHMENTS} attachments per message` }, 400);
  }
  const attachments: NewAttachment[] = [];
  let totalChars = 0;
  for (const raw of rawAttachments) {
    const mediaType = String(raw.mediaType ?? "");
    const data = typeof raw.data === "string" ? raw.data : "";
    if (!ALLOWED_TYPES.includes(mediaType)) {
      return json(
        { error: `Unsupported attachment type "${mediaType}". Allowed: images (JPEG/PNG/GIF/WebP) and PDF.` },
        400,
      );
    }
    if (!data) return json({ error: "Attachment is missing data" }, 400);
    totalChars += data.length;
    if (totalChars > MAX_TOTAL_BASE64_CHARS) {
      return json({ error: "Attachments too large — keep the total under ~3MB per message." }, 400);
    }
    attachments.push({ name: String(raw.name ?? "attachment"), mediaType, data });
  }

  if (!message && attachments.length === 0) {
    return json({ error: "message or attachments required" }, 400);
  }

  const store = getStore();

  // Resolve the conversation: load history for an existing one, or create.
  let conversationId = body.conversationId;
  let title: string;
  let isNew = false;
  let history: Anthropic.MessageParam[] = [];

  if (conversationId) {
    const prior = await store.getConversationMessages(conversationId);
    if (prior === null) return json({ error: "Conversation not found" }, 404);
    const conv = (await store.listConversations()).find((c) => c.id === conversationId);
    title = conv?.title ?? "Conversation";
    history = await Promise.all(prior.map(replayMessage));
  } else {
    const seedTitle = message || `📎 ${attachments[0]?.name ?? "Attachment"}`;
    title = seedTitle.length > 60 ? `${seedTitle.slice(0, 57)}…` : seedTitle;
    const conv = await store.createConversation(title);
    conversationId = conv.id;
    isNew = true;
  }

  await store.appendChatMessage(conversationId, "user", message, attachments);
  history.push({ role: "user", content: toBlocks(message, attachments) });

  const finalConversationId = conversationId;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      const emit = (event: StreamEvent) => {
        if (event.type === "text") assistantText += event.text;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      emit({ type: "meta", conversationId: finalConversationId, title, isNew });
      try {
        await runChiefOfStaff(history, emit);
      } catch (err) {
        emit({
          type: "error",
          message: err instanceof Error ? err.message : "Something went wrong",
        });
      } finally {
        // Persist whatever the assistant produced, even on partial failure,
        // so the stored transcript matches what the user saw.
        if (assistantText.trim()) {
          try {
            await getStore().appendChatMessage(finalConversationId, "assistant", assistantText);
          } catch {
            // history write failure shouldn't break the stream teardown
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
