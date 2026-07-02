"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Chat from "@/components/Chat";
import Dashboard, { type DashboardData } from "@/components/Dashboard";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
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
        <span className="text-xs text-ink-soft">{data?.familyName ?? ""}</span>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-6 py-4 md:grid-cols-[1fr_340px]">
        <div className="min-h-0">
          <Chat onDashboardDirty={onDashboardDirty} onboarded={data?.onboarded ?? null} />
        </div>
        <aside className="hidden min-h-0 overflow-y-auto pb-4 md:block">
          <Dashboard data={data} />
        </aside>
      </main>
    </div>
  );
}
