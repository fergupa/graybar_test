import type Anthropic from "@anthropic-ai/sdk";
import { runChiefOfStaff, type AgentEvent } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
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

  const history: Anthropic.MessageParam[] = (body.messages ?? [])
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return json({ error: "Last message must be a non-empty user message" }, 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runChiefOfStaff(history, emit);
      } catch (err) {
        emit({
          type: "error",
          message: err instanceof Error ? err.message : "Something went wrong",
        });
      } finally {
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
