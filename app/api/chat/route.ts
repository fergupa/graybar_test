import type Anthropic from "@anthropic-ai/sdk";
import { runChiefOfStaff, type AgentEvent } from "@/lib/agents/orchestrator";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ChatRequestBody {
  /** Omit to start a new conversation. */
  conversationId?: string;
  message: string;
}

type StreamEvent =
  | AgentEvent
  | { type: "meta"; conversationId: string; title: string; isNew: boolean };

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
  if (!message) {
    return json({ error: "message is required" }, 400);
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
    history = prior.map((m) => ({ role: m.role, content: m.content }));
  } else {
    title = message.length > 60 ? `${message.slice(0, 57)}…` : message;
    const conv = await store.createConversation(title);
    conversationId = conv.id;
    isNew = true;
  }

  await store.appendChatMessage(conversationId, "user", message);
  history.push({ role: "user", content: message });

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
