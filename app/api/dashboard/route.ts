import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const store = getStore();

  const now = new Date();
  const weekOut = new Date(now);
  weekOut.setDate(weekOut.getDate() + 8);
  const today = now.toISOString().slice(0, 10);

  const [household, events, emails, budget, bills, tasks, mealPlan, groceries] =
    await Promise.all([
      store.getHousehold(),
      store.listEvents(now.toISOString(), weekOut.toISOString()),
      store.listRecentEmails(6),
      store.getBudget(),
      store.getBills(),
      store.getTasks(),
      store.getMealPlan(),
      store.getGroceries(),
    ]);

  return Response.json({
    familyName: household.familyName,
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
