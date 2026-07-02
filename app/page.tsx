"use client";

import { useCallback, useRef, useState } from "react";
import Chat from "@/components/Chat";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Agents can fire several mutations in quick succession; coalesce refetches.
  const onDashboardDirty = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setRefreshKey((k) => k + 1), 400);
  }, []);

  return (
    <div className="mx-auto flex h-dvh max-w-6xl flex-col px-4">
      <header className="flex items-baseline justify-between border-b border-line py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">
            Family <span className="italic text-accent">HQ</span>
          </h1>
          <p className="text-xs text-ink-soft">
            Chief of Staff · Finance Manager · Activity Planner · Food Planner
          </p>
        </div>
        <span className="text-xs text-ink-soft">The Harper Family</span>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-6 py-4 md:grid-cols-[1fr_340px]">
        <div className="min-h-0">
          <Chat onDashboardDirty={onDashboardDirty} />
        </div>
        <aside className="hidden min-h-0 overflow-y-auto pb-4 md:block">
          <Dashboard refreshKey={refreshKey} />
        </aside>
      </main>
    </div>
  );
}
