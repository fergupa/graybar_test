"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Chat from "@/components/Chat";
import Dashboard, { type DashboardData } from "@/components/Dashboard";
import Sidebar, { type ConversationSummary } from "@/components/Sidebar";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: DashboardData) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((list: ConversationSummary[]) => {
        if (!cancelled && Array.isArray(list)) setConversations(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Agents can fire several mutations in quick succession; coalesce refetches.
  const onDashboardDirty = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setRefreshKey((k) => k + 1), 400);
  }, []);

  const onConversationCreated = useCallback((conv: ConversationSummary) => {
    setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
    setActiveId(conv.id);
  }, []);

  const onDeleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
      fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    },
    [activeId],
  );

  return (
    <div className="mx-auto flex h-dvh max-w-7xl flex-col px-4">
      <header className="flex items-baseline justify-between border-b border-line py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">
            Family <span className="italic text-accent">HQ</span>
          </h1>
          <p className="text-xs text-ink-soft">
            Chief of Staff · Finance Manager · Activity Planner · Food Planner
          </p>
        </div>
        <span className="flex items-baseline gap-4 text-xs">
          <a href="/agents" className="text-accent hover:underline">
            Manage agents
          </a>
          <span className="text-ink-soft">{data?.familyName ?? ""}</span>
        </span>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-6 py-4 md:grid-cols-[200px_1fr] lg:grid-cols-[200px_1fr_320px]">
        <div className="hidden min-h-0 md:block">
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={setActiveId}
            onNew={() => setActiveId(null)}
            onDelete={onDeleteConversation}
          />
        </div>
        <div className="min-h-0">
          <Chat
            onDashboardDirty={onDashboardDirty}
            onboarded={data?.onboarded ?? null}
            conversationId={activeId}
            onConversationCreated={onConversationCreated}
          />
        </div>
        <aside className="hidden min-h-0 overflow-y-auto pb-4 lg:block">
          <Dashboard data={data} />
        </aside>
      </main>
    </div>
  );
}
