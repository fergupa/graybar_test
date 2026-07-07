"use client";

import { useState } from "react";

export interface AuthProfile {
  id: string;
  name: string;
  role: "parent" | "child";
  hasPin: boolean;
}

export default function ProfileGate({
  profiles,
  onLogin,
}: {
  profiles: AuthProfile[];
  onLogin: () => void;
}) {
  const [selected, setSelected] = useState<AuthProfile | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (memberId: string, pinValue?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, pin: pinValue || undefined }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Couldn't sign in");
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  };

  const pick = (p: AuthProfile) => {
    setError(null);
    setPin("");
    if (p.hasPin) setSelected(p);
    else login(p.id);
  };

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-lg text-center">
        <p className="font-display text-3xl italic text-ink">Who&apos;s this?</p>
        <p className="mt-2 text-sm text-ink-soft">
          Pick your profile. Parents see everything; kids get their own view.
        </p>

        {profiles.length === 0 ? (
          <button
            onClick={() => login("setup-parent")}
            className="mt-8 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Continue as Parent to set up the household
          </button>
        ) : (
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                disabled={busy}
                className={`w-28 rounded-2xl border bg-card p-4 transition hover:border-accent ${
                  selected?.id === p.id ? "border-accent" : "border-line"
                }`}
              >
                <span
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full font-display text-xl font-bold text-white ${
                    p.role === "parent" ? "bg-accent" : "bg-sage"
                  }`}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="mt-2 block truncate text-sm font-medium text-ink">{p.name}</span>
                <span className="block text-[11px] text-ink-soft">
                  {p.role}
                  {p.hasPin ? " · 🔒" : ""}
                </span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login(selected.id, pin);
            }}
            className="mx-auto mt-6 flex max-w-xs items-center gap-2"
          >
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={`PIN for ${selected.name}`}
              className="flex-1 rounded-xl border border-line bg-card px-4 py-2.5 text-center text-sm tracking-widest text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !pin}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-40"
            >
              Go
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-accent">{error}</p>}
      </div>
    </div>
  );
}
