"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  familyName: string;
  members: { id: string; name: string; role: string; age?: number }[];
  events: { id: string; title: string; start: string; end: string; location?: string }[];
  emails: { id: string; from: string; subject: string; date: string; read: boolean }[];
  budget: { id: string; name: string; monthlyBudget: number; spent: number }[];
  bills: { id: string; name: string; amount: number; dueDate: string; autopay: boolean }[];
  tasks: { id: string; title: string; assignee?: string; due?: string }[];
  mealPlan: { day: string; dinner: string; notes?: string }[];
  groceries: { id: string; name: string; quantity?: string }[];
}

function fmtDay(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function Dashboard({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<DashboardData | null>(null);

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

  if (!data) {
    return <p className="p-4 text-sm text-ink-soft">Loading the household…</p>;
  }

  return (
    <div className="space-y-4">
      <Card title="This week">
        {data.events.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing on the calendar.</p>
        ) : (
          <ul className="space-y-2.5">
            {data.events.map((e) => (
              <li key={e.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{e.title}</span>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {fmtDay(e.start)} · {fmtTime(e.start)}
                  </span>
                </div>
                {e.location && <div className="text-xs text-ink-soft">{e.location}</div>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Dinner plan">
        {data.mealPlan.length === 0 ? (
          <p className="text-sm text-ink-soft">No dinners planned yet — ask the Food Planner.</p>
        ) : (
          <ul className="space-y-2">
            {data.mealPlan.map((m) => (
              <li key={m.day} className="text-sm">
                <span className="text-xs font-medium text-ink-soft">{fmtDay(m.day)}</span>{" "}
                <span className="text-ink">— {m.dinner}</span>
                {m.notes && <span className="text-xs italic text-ink-soft"> ({m.notes})</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Budget · month to date">
        <ul className="space-y-1.5">
          {data.budget.map((b) => {
            const over = b.spent > b.monthlyBudget;
            const high = !over && b.spent > 0.8 * b.monthlyBudget;
            return (
              <li key={b.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-ink">{b.name}</span>
                <span
                  className={
                    over
                      ? "font-semibold text-accent"
                      : high
                        ? "font-medium text-[#8a6a2f]"
                        : "text-ink-soft"
                  }
                >
                  {money(b.spent)} <span className="text-xs">of {money(b.monthlyBudget)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Bills coming up">
        {data.bills.length === 0 ? (
          <p className="text-sm text-ink-soft">All settled.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.bills.map((b) => (
              <li key={b.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-ink">
                  {b.name}
                  {!b.autopay && (
                    <span className="ml-1.5 rounded bg-accent-soft px-1 py-0.5 text-[10px] font-semibold text-accent">
                      manual
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-ink-soft">
                  {money(b.amount)} · {fmtDay(b.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="To-dos">
        {data.tasks.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing pending. Enjoy it.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.tasks.map((t) => (
              <li key={t.id} className="text-sm text-ink">
                {t.title}
                <span className="text-xs text-ink-soft">
                  {t.assignee ? ` — ${t.assignee}` : ""}
                  {t.due ? ` · due ${fmtDay(t.due)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Grocery list">
        {data.groceries.length === 0 ? (
          <p className="text-sm text-ink-soft">List is empty.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {data.groceries.map((g) => (
              <li
                key={g.id}
                className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink"
              >
                {g.name}
                {g.quantity ? ` (${g.quantity})` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Inbox">
        <ul className="space-y-2">
          {data.emails.map((m) => (
            <li key={m.id} className="text-sm">
              <div className="flex items-baseline gap-1.5">
                {!m.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                <span className={`truncate ${m.read ? "text-ink-soft" : "font-medium text-ink"}`}>
                  {m.subject}
                </span>
              </div>
              <div className="truncate text-xs text-ink-soft">{m.from}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
