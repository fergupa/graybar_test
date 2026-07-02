# Family HQ

A multi-agent family management app inspired by Paperclip.ai: a conversational **Chief of Staff** as the front door, backed by a team of specialist agents that keep the household running — with a live dashboard of the calendar, budget, meal plan, tasks, and inbox.

## The agent team

| Agent | Role | Owns |
|---|---|---|
| **Chief of Staff** | Orchestrator & single point of contact | Inbox triage, calendar overview, family roster, delegation, synthesis |
| **Finance Manager** | Money | Budget categories, transactions, spend tracking, bills |
| **Activity Planner** | Logistics | Family calendar, conflict detection, kids' activities, to-do list |
| **Food Planner** | Meals | Dinner plan (allergy/picky-eater aware), grocery list |

The Chief of Staff runs the top-level agentic loop on the Claude API (`claude-opus-4-8`, adaptive thinking). One of its tools is `delegate_to_specialist`, which runs a nested agentic loop for the chosen specialist — each specialist has its own system prompt and tool set, and multiple delegations in one turn run in parallel. Agent activity streams to the UI as it happens.

## Architecture

```
app/
  page.tsx                 Chat + dashboard shell
  api/chat/route.ts        SSE endpoint → runs the Chief of Staff loop
  api/dashboard/route.ts   Read model for the dashboard panels
components/
  Chat.tsx                 Streaming chat with per-agent activity chips
  Dashboard.tsx            Calendar / meals / budget / bills / tasks / groceries / inbox
lib/
  agents/
    definitions.ts         System prompts + tool assignments per agent
    tools.ts               Domain tools (calendar, email, budget, meals, ...)
    orchestrator.ts        Chief-of-Staff loop + specialist sub-loops
  providers/
    types.ts               CalendarProvider / EmailProvider interfaces
    index.ts               Provider wiring (swap store-backed mocks → real here)
  store/
    types.ts               FamilyStore interface (all state goes through this)
    supabase.ts            Supabase implementation (production / Vercel)
    local.ts               JSON-file implementation (zero-setup local dev)
    seed.ts                Demo household data (relative dates, seeded on first run)
    index.ts               Backend selection via env vars
supabase/
  migrations/0001_init.sql Database schema (run once per Supabase project)
```

### Storage: Supabase in production, JSON file for local dev

All household state flows through the `FamilyStore` interface (`lib/store/types.ts`) with two backends:

- **Supabase** (`lib/store/supabase.ts`) — used automatically when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set. Relational schema, seeds the demo household on first run. Use this on Vercel — serverless filesystems are ephemeral.
- **Local JSON** (`lib/store/local.ts`) — zero-setup fallback; persists to `data/family-data.json` (gitignored, delete to reset).

### Integrations: mock today, real tomorrow

Agents only talk to the `CalendarProvider` / `EmailProvider` interfaces in `lib/providers/types.ts`. The shipped implementations are store-backed mocks with realistic seeded data, so the whole system works end-to-end with zero OAuth setup. To go live with Google:

1. Implement `GoogleCalendarProvider` / `GmailProvider` against those interfaces (OAuth + `googleapis`).
2. Swap the constructors in `lib/providers/index.ts`.

No agent or UI code changes.

## Running it locally

```bash
cp .env.example .env.local   # add your ANTHROPIC_API_KEY (Supabase vars optional locally)
npm install
npm run dev
```

Open http://localhost:3000 and try:

- *"Catch me up — anything in the inbox or calendar I should handle?"*
- *"Plan dinners for the rest of the week and update the grocery list"*
- *"How's our budget looking this month?"*

## Family onboarding

A fresh household starts on seeded demo data (the fictional Harpers) so everything works immediately. To make it yours, click **"Set up your real family"** on the chat home screen (or just ask): the Chief of Staff interviews you conversationally — family name, members with ages and contact info, allergies, routines, schools — clears the demo data (with your confirmation), and saves your profile as you answer, so the dashboard fills in live. The profile feeds every agent's context, and agents keep it current as they learn new durable facts in later conversations. You can update anything later by just telling the chat ("Maya's soccer moved to Tuesdays", "add Grandma's phone number").

## Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Open the SQL editor and run each file in `supabase/migrations/` in order (or use `supabase db push` with the CLI). When new migrations land in that folder, run the new ones against your existing project.
3. Set the env vars (locally in `.env.local`, or in your host's dashboard):
   - `SUPABASE_URL` — Project settings → Data API
   - `SUPABASE_SERVICE_ROLE_KEY` — Project settings → API keys (**server-side secret**; never expose it to the browser or prefix it with `NEXT_PUBLIC_`)
4. Start the app — it seeds the demo household on first request. To reset, wipe the tables (`delete from households;` cascades everywhere) and reload.

Row-level security is enabled with no policies, so the anon key can read nothing; the server uses the service role key. When you add Supabase Auth for multi-family use, replace service-role access with per-household RLS policies (`household_id` is already on every table).

## Deploying to Vercel

1. Import the repo at vercel.com.
2. Set `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the project's environment variables.
3. Deploy. Streaming chat and long agent turns work out of the box (`maxDuration = 300` is set on the chat route).

## Notes & next steps

- **Auth / multi-family**: the schema is multi-tenant-ready (`household_id` on every table). Next step is Supabase Auth + a household-membership mapping + RLS policies, then dropping the service-role key from the request path.
- **Realtime dashboard**: the dashboard currently refetches when the chat stream reports a mutation; with Supabase Realtime it can subscribe to table changes so every family member's view updates live.
- **Confirmation gates**: the Chief of Staff is prompted to ask before hard-to-reverse actions (e.g. sending email); a production version should enforce this in the harness, not just the prompt.
- Natural extensions: Home & Maintenance agent, Health & Appointments agent, Travel Planner, real Google/Microsoft OAuth, per-member views, and push notifications.
