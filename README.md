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
    mock-calendar.ts       Seeded mock calendar
    mock-email.ts          Seeded mock inbox
    index.ts               Provider wiring (swap mocks → real here)
  store.ts                 Family state (budget, meals, tasks...), persisted to data/
```

### Integrations: mock today, real tomorrow

Agents only talk to the `CalendarProvider` / `EmailProvider` interfaces in `lib/providers/types.ts`. The shipped implementations are seeded mocks so the whole system works end-to-end with zero setup. To go live with Google:

1. Implement `GoogleCalendarProvider` / `GmailProvider` against those interfaces (OAuth + `googleapis`).
2. Swap the constructors in `lib/providers/index.ts`.

No agent or UI code changes.

## Running it

```bash
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev
```

Open http://localhost:3000 and try:

- *"Catch me up — anything in the inbox or calendar I should handle?"*
- *"Plan dinners for the rest of the week and update the grocery list"*
- *"How's our budget looking this month?"*

Mock family state lives in `data/family-data.json` (gitignored); delete it to reset to the seed data.

## Notes & next steps

- **Persistence** is a JSON file for demo purposes — swap `lib/store.ts` for a database for multi-user use.
- **Confirmation gates**: the Chief of Staff is prompted to ask before hard-to-reverse actions (e.g. sending email); a production version should enforce this in the harness, not just the prompt.
- Natural extensions: Home & Maintenance agent, Health & Appointments agent, Travel Planner, real Google/Microsoft OAuth, per-member views, and push notifications.
