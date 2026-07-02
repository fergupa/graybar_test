"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  /** Activity lines (agent + action) that happened while producing this turn. */
  activity?: { agent: string; message: string }[];
}

const SUGGESTIONS = [
  "Catch me up — anything in the inbox or calendar I should handle?",
  "Plan dinners for the rest of the week and update the grocery list",
  "How's our budget looking this month?",
  "What's on the schedule this weekend, and what prep do we need?",
];

const SETUP_PROMPT =
  "Let's set up our family — interview me and replace the demo data with our real household.";

const AGENT_COLORS: Record<string, string> = {
  "Chief of Staff": "bg-accent-soft text-accent",
  "Finance Manager": "bg-sage-soft text-sage",
  "Activity Planner": "bg-[#e8ecf3] text-[#4a5d80]",
  "Food Planner": "bg-[#f3ecdf] text-[#8a6a2f]",
};

export default function Chat({
  onDashboardDirty,
  onboarded,
}: {
  onDashboardDirty: () => void;
  /** null while loading; false = still on demo data */
  onboarded: boolean | null;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setError(null);
      setBusy(true);
      setInput("");

      const priorTurns = turns;
      const history = [...priorTurns, { role: "user" as const, content: message }];
      // Optimistically render the user turn and an empty assistant turn.
      setTurns([...history, { role: "assistant", content: "", activity: [] }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
          }),
        });

        if (!res.ok || !res.body) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyEvent = (event: {
          type: string;
          text?: string;
          agent?: string;
          message?: string;
        }) => {
          if (event.type === "dashboard_dirty") {
            onDashboardDirty();
            return;
          }
          if (event.type === "error") {
            setError(event.message ?? "Something went wrong");
            return;
          }
          setTurns((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (!last || last.role !== "assistant") return prev;
            if (event.type === "text") {
              next[next.length - 1] = { ...last, content: last.content + (event.text ?? "") };
            } else if (event.type === "status" && event.agent && event.message) {
              next[next.length - 1] = {
                ...last,
                activity: [...(last.activity ?? []), { agent: event.agent, message: event.message }],
              };
            }
            return next;
          });
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data: ")) continue;
            try {
              applyEvent(JSON.parse(line.slice(6)));
            } catch {
              // ignore malformed frame
            }
          }
        }
        // The turn may have mutated state even if no dirty event fired last.
        onDashboardDirty();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        // Drop the empty assistant bubble if nothing arrived.
        setTurns((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content && !(last.activity?.length ?? 0)) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, turns, onDashboardDirty],
  );

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 py-4">
        {turns.length === 0 && (
          <div className="mx-auto max-w-md pt-10 text-center">
            <p className="font-display text-2xl italic text-ink">
              What can I take off your plate?
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              I&apos;m your family&apos;s chief of staff. I read the inbox, watch the calendar, and
              run a team for finances, activities, and meals.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {onboarded === false && (
                <button
                  onClick={() => send(SETUP_PROMPT)}
                  className="rounded-xl border border-accent bg-accent-soft px-4 py-2.5 text-left text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
                >
                  👋 New here? Set up your real family (you&apos;re seeing demo data)
                </button>
              )}
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-line bg-card px-4 py-2.5 text-left text-sm text-ink transition hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-white">
                {turn.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[92%] space-y-2">
                {(turn.activity?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {turn.activity!.map((a, k) => (
                      <span
                        key={k}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${AGENT_COLORS[a.agent] ?? "bg-line text-ink-soft"}`}
                      >
                        <span className="font-semibold">{a.agent}</span>
                        <span className="opacity-75">· {a.message}</span>
                      </span>
                    ))}
                  </div>
                )}
                {(turn.content || !busy || i < turns.length - 1) && (
                  <div className="chat-body whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-line bg-card px-4 py-3 text-sm leading-relaxed text-ink">
                    {turn.content || <span className="text-ink-soft">…</span>}
                  </div>
                )}
                {busy && i === turns.length - 1 && !turn.content && (
                  <div className="px-1 text-xs text-ink-soft">
                    <span className="animate-pulse">The team is working…</span>
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {error && (
          <div className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-line pt-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="Ask your chief of staff anything…"
          className="flex-1 resize-none rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
