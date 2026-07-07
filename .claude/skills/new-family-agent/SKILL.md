---
name: new-family-agent
description: Scaffold a new Family HQ specialist agent, domain toolset, or dashboard panel. Use when asked to add an agent (Travel Planner, Home & Maintenance, Health...), new agent tools, or a new household data domain to this app.
---

# Adding a Family HQ specialist agent

## First decision: custom agent or built-in agent?

- **Custom agent (no code!)** — if the request is just "an agent with a persona/instructions that uses EXISTING tools" (e.g. a Homework Helper that uses tasks + calendar), don't write code. Point the user to **Manage agents** in the app UI, or create it via `POST /api/agents`. Custom agents live in the `custom_agents` table and are loaded into the roster on every chat turn.
- **Built-in agent (code)** — needed when the agent requires **new domain state or new tools** (e.g. a Home & Maintenance agent needs appliance/warranty tables and tools). Follow the steps below.

## Steps for a built-in agent with a new domain

Work through these in order; each has an established pattern to copy.

### 1. Domain state (skip if the agent only needs existing data)

- Add types to `lib/types.ts` and extend `FamilyData` (used by seed + local store).
- Add methods to the `FamilyStore` interface in `lib/store/types.ts`.
- Implement in **both** backends: `lib/store/local.ts` (JSON) and `lib/store/supabase.ts` (map snake_case rows ↔ camelCase types; follow the `*FromRow` helper pattern).
- Add seed rows in `lib/store/seed.ts` (dates relative to now via `isoDay()`/`at()`).
- If Supabase tables change: add `supabase/migrations/NNNN_<name>.sql` (next number; `household_id` FK + `enable row level security` on every table). Update the Supabase store's `ensureSeeded()` if the new domain is seeded.
- If the domain should be wiped during onboarding, add it to `clearDemoData()` in both stores.

### 2. Tools — `lib/agents/tools.ts`

Conventions:
- Tool `run()` returns a JSON string (`j(...)`); errors return `j({ error: "..." })` rather than throwing when the model can recover.
- Set `mutates: true` on anything that changes dashboard-visible state (drives live dashboard refresh).
- Descriptions are prescriptive about **when** to call the tool, not just what it does.
- Validate/`String()`-coerce all inputs; schemas use `additionalProperties: false`.
- **Register every new tool in `TOOL_REGISTRY`** at the bottom of the file — that's what makes it assignable to custom agents in the UI.

### 3. The agent — `lib/agents/definitions.ts`

- Create a `SpecialistAgent`: short `key`, `label`, one-sentence `charter` (the Chief of Staff reads charters to decide delegation), `system` prompt ending with `${SHARED_STYLE}`, and its tool list (usually include `getFamilyOverview`).
- Add it to the `SPECIALISTS` array — delegation, the chat roster, and the Chief's prompt all derive from it.
- System prompt shape: "You are the X for a family, working under the family's Chief of Staff. You own: ... How to work: ..." — ground every claim in tool results; call out safety-critical notes (like allergies) explicitly.

### 4. UI

- New dashboard data: extend `/api/dashboard/route.ts` + add a `Card` in `components/Dashboard.tsx` + the `DashboardData` interface.
- Add a chip color for the agent in `AGENT_COLORS` in `components/Chat.tsx` (label must match the agent's `label`).

### 5. Verify & ship

- `rm -f data/family-data.json` (stale local seed), then `npm run build` — must pass clean.
- Smoke test: `npm run start -- -p 31xx` → `curl /api/dashboard` shows the new domain; page returns 200.
- Update `README.md` (agent table + any migration).
- **If a migration was added, tell the user to run it in the Supabase SQL editor BEFORE/AS the Vercel deploy lands** — pushes auto-deploy, and code that reads missing tables errors at runtime. Make this warning prominent in your summary.

## Adding tools to an existing agent

Steps 2 → 3 (just extend its `tools` array) → 5. If the tool needs new state, step 1 too.

## Gotchas

- Specialists never see the chat or attachments — the Chief writes them a self-contained brief. Design tools so a briefed agent can act without conversation context.
- Don't call `pkill -f "next start"` in scripts (it matches its own shell); use `fuser -k <port>/tcp`.
- The store must stay behind the `FamilyStore` interface — never import `@supabase/supabase-js` outside `lib/store/supabase.ts`.
- Model calls always go through `lib/agents/orchestrator.ts` (`claude-opus-4-8`, adaptive thinking); don't add per-agent API clients.
