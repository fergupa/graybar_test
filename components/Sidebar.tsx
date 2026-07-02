"use client";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diffDays = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  );
  if (diffDays <= 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <nav className="flex h-full flex-col gap-3">
      <button
        onClick={onNew}
        className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        + New chat
      </button>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="px-2 pt-2 text-xs text-ink-soft">
            No conversations yet — your chats with the team will show up here.
          </p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 transition ${
              c.id === activeId
                ? "border-accent bg-accent-soft"
                : "border-transparent hover:border-line hover:bg-card"
            }`}
          >
            <button
              onClick={() => onSelect(c.id)}
              className="min-w-0 flex-1 text-left"
              title={c.title}
            >
              <span className="block truncate text-sm text-ink">{c.title}</span>
              <span className="block text-[10px] text-ink-soft">{relativeDay(c.updatedAt)}</span>
            </button>
            <button
              onClick={() => onDelete(c.id)}
              aria-label={`Delete "${c.title}"`}
              className="hidden shrink-0 rounded p-1 text-xs text-ink-soft transition hover:text-accent group-hover:block"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </nav>
  );
}
