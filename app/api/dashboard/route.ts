import { getCalendarProvider } from "@/lib/providers";
import { getStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
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

  const [household, emails, budget, bills, tasks, mealPlan, groceries] = await Promise.all([
    store.getHousehold(),
    store.listRecentEmails(6),
    store.getBudget(),
    store.getBills(),
    store.getTasks(),
    store.getMealPlan(),
    store.getGroceries(),
  ]);

  return Response.json({
    calendarError,
    familyName: household.familyName,
    onboarded: household.onboarded,
    members: household.members,
    events,
    emails: emails.map(({ id, from, subject, date, read }) => ({ id, from, subject, date, read })),
    budget,
    bills: bills.filter((b) => !b.paid),
    tasks: tasks.filter((t) => !t.done),
    mealPlan: mealPlan.filter((m) => m.day >= today).slice(0, 7),
    groceries: groceries.filter((g) => !g.done),
  });
}
