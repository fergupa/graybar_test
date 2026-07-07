"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Chat from "@/components/Chat";
import Dashboard, { type DashboardData } from "@/components/Dashboard";
import ProfileGate, { type AuthProfile } from "@/components/ProfileGate";
import Sidebar, { type ConversationSummary } from "@/components/Sidebar";

interface Session {
  memberId: string;
  name: string;
  role: "parent" | "child";
}

export default function Home() {
  const [authLoaded, setAuthLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAuth = useCallback(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d: { session: Session | null; profiles: AuthProfile[] }) => {
        setSession(d.session);
        setProfiles(d.profiles ?? []);
        setAuthLoaded(true);
      })
      .catch(() => setAuthLoaded(true));
  }, []);

  useEffect(loadAuth, [loadAuth]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DashboardData | null) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey, session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ConversationSummary[]) => {
        if (!cancelled && Array.isArray(list)) setConversations(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session]);

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

  const switchProfile = async () => {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    setSession(null);
    setData(null);
    setConversations([]);
    setActiveId(null);
    loadAuth();
  };

  const setPin = async () => {
    const pin = window.prompt("Set a PIN for your profile (4-8 digits; leave empty to remove):");
    if (pin === null) return;
    const res = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin || null }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    alert(res.ok ? (pin ? "PIN set." : "PIN removed.") : (payload.error ?? "Couldn't set PIN"));
    loadAuth();
  };

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
        {session && (
          <span className="flex items-baseline gap-3 text-xs">
            {session.role === "parent" && (
              <a href="/agents" className="text-accent hover:underline">
                Manage agents
              </a>
            )}
            <button onClick={setPin} className="text-ink-soft hover:text-accent hover:underline">
              Set PIN
            </button>
            <span className="text-ink-soft">
              {session.name} ({session.role})
            </span>
            <button
              onClick={switchProfile}
              className="text-ink-soft hover:text-accent hover:underline"
            >
              Switch
            </button>
          </span>
        )}
      </header>

      {!authLoaded ? (
        <p className="p-6 text-sm text-ink-soft">Loading…</p>
      ) : !session ? (
        <ProfileGate profiles={profiles} onLogin={loadAuth} />
      ) : (
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
              viewerRole={session.role}
              conversationId={activeId}
              onConversationCreated={onConversationCreated}
            />
          </div>
          <aside className="hidden min-h-0 overflow-y-auto pb-4 lg:block">
            <Dashboard data={data} />
          </aside>
        </main>
      )}
    </div>
  );
}
