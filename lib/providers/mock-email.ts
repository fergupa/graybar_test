import type { EmailMessage } from "@/lib/types";
import type { EmailProvider } from "./types";

function daysAgo(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

let nextId = 1000;

function seedInbox(): EmailMessage[] {
  return [
    {
      id: "em-1",
      from: "Lincoln Elementary <newsletter@lincolnelem.edu>",
      subject: "This Week at Lincoln: Field Day + Summer Reading",
      date: daysAgo(0, 8),
      read: false,
      body: "Field Day is Friday — kids should wear sunscreen and bring a water bottle. Summer reading logs are due at the front office by the 15th. Maya's class (Room 12) is hosting parent-teacher conferences this week; check the portal for your time slot.",
    },
    {
      id: "em-2",
      from: "Coach Rivera <coach.rivera@westfieldsoccer.org>",
      subject: "Falcons game Saturday — carpool + snack signup",
      date: daysAgo(0, 7),
      read: false,
      body: "Reminder: game vs. Falcons this Saturday, 9am at Westfield Sports Complex. Arrive 8:30 for warmups. We still need one family for the snack signup and two carpool drivers. Reply to claim a slot.",
    },
    {
      id: "em-3",
      from: "City Power & Light <billing@citypl.com>",
      subject: "Your July statement is ready — $187.42 due on the 15th",
      date: daysAgo(1, 10),
      read: false,
      body: "Your electricity statement for June is $187.42, due July 15. You are not enrolled in autopay. Log in to pay or set up autopay.",
    },
    {
      id: "em-4",
      from: "Bright Smiles Dental <appointments@brightsmiles.com>",
      subject: "Appointment reminder: Leo, tomorrow 3:00 PM",
      date: daysAgo(1, 12),
      read: true,
      body: "This is a reminder for Leo's cleaning appointment tomorrow at 3:00 PM. Please arrive 10 minutes early and bring your insurance card.",
    },
    {
      id: "em-5",
      from: "Dana P. <dana.p@gmail.com>",
      subject: "Jordan's birthday party — RSVP",
      date: daysAgo(2, 18),
      read: true,
      body: "Hi! Jordan's turning 7 and we'd love Leo to come. Party is Wednesday next week 2-4:30pm at Bounce Zone. Pizza provided. Let me know by Monday! — Dana",
    },
    {
      id: "em-6",
      from: "Summer Camp Registration <camps@cityrec.gov>",
      subject: "Last chance: Week 4 camp spots close Friday",
      date: daysAgo(3, 9),
      read: true,
      body: "Spots for Week 4 day camps (ages 6-12) close this Friday. Art Camp and Science Explorers still have openings. $145/child for the week, 9am-3pm with optional aftercare.",
    },
  ];
}

export class MockEmailProvider implements EmailProvider {
  private inbox: EmailMessage[];

  constructor(initial?: EmailMessage[]) {
    this.inbox = initial ?? seedInbox();
  }

  async listRecent(limit: number): Promise<EmailMessage[]> {
    return [...this.inbox]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async search(query: string): Promise<EmailMessage[]> {
    const q = query.toLowerCase();
    return this.inbox.filter(
      (m) =>
        m.from.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q),
    );
  }

  async markRead(id: string): Promise<boolean> {
    const msg = this.inbox.find((m) => m.id === id);
    if (!msg) return false;
    msg.read = true;
    return true;
  }

  async sendEmail(to: string, subject: string, body: string): Promise<{ id: string }> {
    // The mock records outgoing mail in the inbox thread for visibility.
    const id = `em-out-${nextId++}`;
    this.inbox.push({
      id,
      from: "You (sent)",
      subject: `To ${to}: ${subject}`,
      date: new Date().toISOString(),
      body,
      read: true,
    });
    return { id };
  }
}
