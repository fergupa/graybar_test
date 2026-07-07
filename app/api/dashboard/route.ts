import { getViewer } from "@/lib/auth";
import { getCalendarProvider } from "@/lib/providers";
import { getStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Pick a profile first" }, { status: 401 });
  const isParent = viewer.role === "parent";
  const store = getStore();

  const now = new Date();
  const weekOut = new Date(now);
  weekOut.setDate(weekOut.getDate() + 8);
  const today = now.toISOString().slice(0, 10);

  // Calendar goes through the provider (Apple CalDAV when configured). A
  // calendar outage shouldn't take down the whole dashboard.
  let events: CalendarEvent[] = [];
  let calendarError: string | undefined;
  try {
    events = await getCalendarProvider().listEvents(now.toISOString(), weekOut.toISOString());
  } catch (err) {
    calendarError = err instanceof Error ? err.message : "Calendar unavailable";
  }

  // Finance and the inbox are parent-only.
  const [household, emails, budget, bills, tasks, mealPlan, groceries] = await Promise.all([
    store.getHousehold(),
    isParent ? store.listRecentEmails(6) : Promise.resolve([]),
    isParent ? store.getBudget() : Promise.resolve([]),
    isParent ? store.getBills() : Promise.resolve([]),
    store.getTasks(),
    store.getMealPlan(),
    store.getGroceries(),
  ]);

  return Response.json({
    calendarError,
    viewer,
    familyName: household.familyName,
    onboarded: household.onboarded,
    members: household.members,
    events,
    emails: isParent
      ? emails.map(({ id, from, subject, date, read }) => ({ id, from, subject, date, read }))
      : undefined,
    budget: isParent ? budget : undefined,
    bills: isParent ? bills.filter((b) => !b.paid) : undefined,
    tasks: tasks.filter((t) => !t.done),
    mealPlan: mealPlan.filter((m) => m.day >= today).slice(0, 7),
    groceries: groceries.filter((g) => !g.done),
  });
}
