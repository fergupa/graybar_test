"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  attachments?: { name: string; mediaType: string }[];
  /** Activity lines (agent + action) that happened while producing this turn. */
  activity?: { agent: string; message: string }[];
}

interface PendingAttachment {
  name: string;
  mediaType: string;
  data: string; // base64
}

const MAX_ATTACHMENTS = 4;
const MAX_TOTAL_BASE64 = 4_000_000; // keep under Vercel's request body cap

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Downscale/recompress photos client-side so flyers and receipts fit the upload cap. */
async function prepareAttachment(file: File): Promise<PendingAttachment> {
  if (file.type === "application/pdf") {
    if (file.size > 3_000_000) throw new Error(`"${file.name}" is too large — PDFs must be under 3MB.`);
    return { name: file.name, mediaType: file.type, data: await fileToBase64(file) };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" isn't supported — attach images or PDFs.`);
  }
  // Keep small originals as-is (incl. GIFs, which canvas would flatten).
  if (file.size <= 800_000 || file.type === "image/gif") {
    if (file.size > 3_000_000) throw new Error(`"${file.name}" is too large (max 3MB).`);
    return { name: file.name, mediaType: file.type, data: await fileToBase64(file) };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { name: file.name, mediaType: "image/jpeg", data: dataUrl.split(",")[1] ?? "" };
}

function AttachmentChips({ attachments }: { attachments: { name: string; mediaType: string }[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {attachments.map((a, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px]"
        >
          {a.mediaType === "application/pdf" ? "📄" : "🖼️"} {a.name}
        </span>
      ))}
    </div>
  );
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
  conversationId,
  onConversationCreated,
}: {
  onDashboardDirty: () => void;
  /** null while loading; false = still on demo data */
  onboarded: boolean | null;
  /** null = fresh, unsaved chat */
  conversationId: string | null;
  onConversationCreated: (conv: { id: string; title: string; updatedAt: string }) => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The conversation this component itself just created mid-stream — when the
  // parent selects it, we must not reload messages over the live stream.
  const createdIdRef = useRef<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  // Load history when switching conversations (or clear for a new chat).
  useEffect(() => {
    if (!conversationId) {
      createdIdRef.current = null;
      setTurns([]);
      setError(null);
      return;
    }
    if (conversationId === createdIdRef.current) return; // already showing it live
    createdIdRef.current = null;
    let cancelled = false;
    setError(null);
    fetch(`/api/conversations/${conversationId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load conversation"))))
      .then(
        (
          messages: {
            role: "user" | "assistant";
            content: string;
            attachments?: { name: string; mediaType: string }[];
          }[],
        ) => {
          if (!cancelled) {
            setTurns(
              messages.map((m) => ({
                role: m.role,
                content: m.content,
                attachments: m.attachments,
              })),
            );
          }
        },
      )
      .catch(() => {
        if (!cancelled) setError("Couldn't load that conversation.");
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      setError(null);
      const next = [...pending];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_ATTACHMENTS) {
          setError(`At most ${MAX_ATTACHMENTS} attachments per message.`);
          break;
        }
        try {
          const prepared = await prepareAttachment(file);
          const total = next.reduce((n, a) => n + a.data.length, 0) + prepared.data.length;
          if (total > MAX_TOTAL_BASE64) {
            setError("Attachments too large — keep the total under ~3MB per message.");
            break;
          }
          next.push(prepared);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't read that file.");
        }
      }
      setPending(next);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [pending],
  );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if ((!message && pending.length === 0) || busy) return;
      const attachments = pending;
      setError(null);
      setBusy(true);
      setInput("");
      setPending([]);

      setTurns((prev) => [
        ...prev,
        {
          role: "user",
          content: message,
          attachments: attachments.map(({ name, mediaType }) => ({ name, mediaType })),
        },
        { role: "assistant", content: "", activity: [] },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationId ?? undefined,
            message,
            attachments,
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
          conversationId?: string;
          title?: string;
          isNew?: boolean;
        }) => {
          if (event.type === "meta") {
            if (event.isNew && event.conversationId) {
              createdIdRef.current = event.conversationId;
              onConversationCreated({
                id: event.conversationId,
                title: event.title ?? "Conversation",
                updatedAt: new Date().toISOString(),
              });
            }
            return;
          }
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
    [busy, pending, conversationId, onDashboardDirty, onConversationCreated],
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
              <div className="max-w-[85%] space-y-1.5 rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-white">
                {(turn.attachments?.length ?? 0) > 0 && (
                  <AttachmentChips attachments={turn.attachments!} />
                )}
                {turn.content && <div>{turn.content}</div>}
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

      <div className="border-t border-line pt-3">
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pending.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink"
              >
                {a.mediaType === "application/pdf" ? "📄" : "🖼️"} {a.name}
                <button
                  type="button"
                  onClick={() => setPending((prev) => prev.filter((_, k) => k !== i))}
                  aria-label={`Remove ${a.name}`}
                  className="text-ink-soft transition hover:text-accent"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            aria-label="Attach images or PDFs"
            title="Attach images or PDFs (school flyers, receipts, forms…)"
            className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent disabled:opacity-40"
          >
            📎
          </button>
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
            placeholder={
              pending.length > 0
                ? "Add a note about the attachment(s)…"
                : "Ask your chief of staff anything…"
            }
            className="flex-1 resize-none rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || (!input.trim() && pending.length === 0)}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
