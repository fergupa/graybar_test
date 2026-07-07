"use client";

import { useCallback, useEffect, useState } from "react";

interface BuiltInAgent {
  key: string;
  label: string;
  charter: string;
  tools: string[];
}

interface CustomAgent {
  id: string;
  key: string;
  label: string;
  charter: string;
  system: string;
  tools: string[];
  memberIds?: string[] | null;
  enabled: boolean;
}

interface ToolInfo {
  name: string;
  description: string;
  mutates: boolean;
  parentOnly: boolean;
}

interface AgentsPayload {
  builtIn: BuiltInAgent[];
  custom: CustomAgent[];
  members: { id: string; name: string; role: string }[];
  toolCatalog: ToolInfo[];
}

const EMPTY_FORM = {
  id: "",
  label: "",
  charter: "",
  system: "",
  tools: [] as string[],
  memberIds: null as string[] | null,
  enabled: true,
};

export default function AgentsPage() {
  const [data, setData] = useState<AgentsPayload | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/agents")
      .then(async (r) => {
        const payload = await r.json();
        if (!r.ok) {
          setBlocked(
            r.status === 401
              ? "Pick a profile on the home page first."
              : "Managing agents is for parents — ask a parent to sign in.",
          );
          return;
        }
        setBlocked(null);
        setData(payload as AgentsPayload);
      })
      .catch(() => setError("Couldn't load agents."));
  }, []);

  useEffect(load, [load]);

  const save = async () => {
    if (!form || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id || undefined,
          label: form.label,
          charter: form.charter,
          system: form.system,
          tools: form.tools,
          memberIds: form.memberIds,
          enabled: form.enabled,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Save failed");
      setForm(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (agent: CustomAgent) => {
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...agent, enabled: !agent.enabled }),
    }).catch(() => {});
    load();
  };

  const remove = async (agent: CustomAgent) => {
    if (!confirm(`Delete the ${agent.label} agent? This can't be undone.`)) return;
    await fetch(`/api/agents/${agent.id}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  const toggleTool = (name: string) => {
    if (!form) return;
    setForm({
      ...form,
      tools: form.tools.includes(name)
        ? form.tools.filter((t) => t !== name)
        : [...form.tools, name],
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <header className="flex items-baseline justify-between border-b border-line py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">
            Manage <span className="italic text-accent">agents</span>
          </h1>
          <p className="text-xs text-ink-soft">
            Create specialists for your family — they join the Chief of Staff&apos;s team instantly.
          </p>
        </div>
        <a href="/" className="text-sm text-accent hover:underline">
          ← Back to chat
        </a>
      </header>

      {error && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent">
          {error}
        </div>
      )}

      {blocked ? (
        <p className="mt-6 text-sm text-ink-soft">{blocked}</p>
      ) : !data ? (
        <p className="mt-6 text-sm text-ink-soft">Loading…</p>
      ) : (
        <div className="mt-6 space-y-8">
          <section>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
              Built-in team
            </h2>
            <div className="mt-3 space-y-2">
              {data.builtIn.map((a) => (
                <div key={a.key} className="rounded-2xl border border-line bg-card p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{a.label}</span>
                    <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                      built-in
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{a.charter}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
                Your agents
              </h2>
              {!form && (
                <button
                  onClick={() => setForm({ ...EMPTY_FORM })}
                  className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  + New agent
                </button>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {data.custom.length === 0 && !form && (
                <p className="text-sm text-ink-soft">
                  None yet. Try a Travel Planner, Homework Helper, or Chore Captain — pick their
                  tools and write their instructions, and the Chief of Staff can delegate to them
                  on your very next message.
                </p>
              )}
              {data.custom.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-2xl border border-line bg-card p-4 ${a.enabled ? "" : "opacity-60"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">
                      {a.label}
                      {!a.enabled && (
                        <span className="ml-2 rounded bg-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                          paused
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 gap-3 text-xs">
                      <button
                        onClick={() => setForm({ ...a, memberIds: a.memberIds ?? null })}
                        className="text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleEnabled(a)}
                        className="text-ink-soft hover:underline"
                      >
                        {a.enabled ? "Pause" : "Resume"}
                      </button>
                      <button onClick={() => remove(a)} className="text-ink-soft hover:underline">
                        Delete
                      </button>
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{a.charter}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    For:{" "}
                    {a.memberIds?.length
                      ? a.memberIds
                          .map((id) => data.members.find((m) => m.id === id)?.name ?? id)
                          .join(", ")
                      : "everyone"}{" "}
                    · Tools: {a.tools.map((t) => t.replaceAll("_", " ")).join(", ")}
                  </p>
                </div>
              ))}
            </div>

            {form && (
              <div className="mt-4 space-y-4 rounded-2xl border border-accent/40 bg-card p-4">
                <h3 className="font-display font-semibold text-ink">
                  {form.id ? `Edit ${form.label}` : "New agent"}
                </h3>
                <label className="block text-sm">
                  <span className="text-ink-soft">Name</span>
                  <input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="Travel Planner"
                    className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-ink-soft">
                    What they handle{" "}
                    <span className="text-[11px]">
                      (one sentence — the Chief of Staff reads this to decide when to delegate)
                    </span>
                  </span>
                  <input
                    value={form.charter}
                    onChange={(e) => setForm({ ...form, charter: e.target.value })}
                    placeholder="Family trips: itineraries, packing lists, and travel-week logistics."
                    className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-ink-soft">Instructions</span>
                  <textarea
                    value={form.system}
                    onChange={(e) => setForm({ ...form, system: e.target.value })}
                    rows={5}
                    placeholder={
                      "How should this agent think and behave?\ne.g. Plan trips around school breaks. Always build a packing list as tasks. Kids get one carry-on each…"
                    }
                    className="mt-1 w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <div className="text-sm">
                  <span className="text-ink-soft">Who is this agent for?</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs hover:border-accent">
                      <input
                        type="radio"
                        checked={form.memberIds === null}
                        onChange={() => setForm({ ...form, memberIds: null })}
                        className="accent-[#c05d3b]"
                      />
                      <span className="text-ink">Everyone</span>
                    </label>
                    {data.members.map((m) => (
                      <label
                        key={m.id}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs hover:border-accent"
                      >
                        <input
                          type="checkbox"
                          checked={form.memberIds?.includes(m.id) ?? false}
                          onChange={() => {
                            const current = form.memberIds ?? [];
                            const next = current.includes(m.id)
                              ? current.filter((id) => id !== m.id)
                              : [...current, m.id];
                            setForm({ ...form, memberIds: next.length > 0 ? next : null });
                          }}
                          className="accent-[#c05d3b]"
                        />
                        <span className="text-ink">
                          {m.name} <span className="text-ink-soft">({m.role})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    Kids never get parent-only tools (finance, email, settings) even if checked
                    below.
                  </p>
                </div>
                <div className="text-sm">
                  <span className="text-ink-soft">Tools this agent may use</span>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {data.toolCatalog.map((t) => (
                      <label
                        key={t.name}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs hover:border-accent"
                        title={t.description}
                      >
                        <input
                          type="checkbox"
                          checked={form.tools.includes(t.name)}
                          onChange={() => toggleTool(t.name)}
                          className="mt-0.5 accent-[#c05d3b]"
                        />
                        <span className="text-ink">
                          {t.name.replaceAll("_", " ")}
                          {t.mutates && <span className="ml-1 text-[10px] text-accent">writes</span>}
                          {t.parentOnly && (
                            <span className="ml-1 text-[10px] text-ink-soft">parents only</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
                  >
                    {saving ? "Saving…" : form.id ? "Save changes" : "Create agent"}
                  </button>
                  <button
                    onClick={() => setForm(null)}
                    className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-accent hover:text-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
