import { getCalendarProvider, getEmailProvider } from "@/lib/providers";
import { getFamilyData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const data = getFamilyData();

  const now = new Date();
  const weekOut = new Date(now);
  weekOut.setDate(weekOut.getDate() + 8);

  const [events, emails] = await Promise.all([
    getCalendarProvider().listEvents(now.toISOString(), weekOut.toISOString()),
    getEmailProvider().listRecent(6),
  ]);

  return Response.json({
    familyName: data.familyName,
    members: data.members,
    events,
    emails: emails.map(({ id, from, subject, date, read }) => ({ id, from, subject, date, read })),
    budget: data.budget,
    bills: data.bills.filter((b) => !b.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    tasks: data.tasks.filter((t) => !t.done),
    mealPlan: [...data.mealPlan]
      .filter((m) => m.day >= now.toISOString().slice(0, 10))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(0, 7),
    groceries: data.groceries.filter((g) => !g.done),
  });
}
