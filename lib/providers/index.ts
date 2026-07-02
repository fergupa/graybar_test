import type { CalendarEvent, EmailMessage } from "@/lib/types";
import { getStore } from "@/lib/store";
import type { CalendarProvider, EmailProvider } from "./types";

/**
 * Provider wiring. The default implementations are backed by the family
 * store (Supabase or local JSON), which holds realistic seeded demo data.
 *
 * To go live with a real service, implement the interface against its API
 * and swap it in here — no agent code changes:
 *
 *   const calendar: CalendarProvider = new GoogleCalendarProvider(oauth);
 *   const email: EmailProvider = new GmailProvider(oauth);
 */

class StoreCalendarProvider implements CalendarProvider {
  listEvents(from: string, to: string): Promise<CalendarEvent[]> {
    return getStore().listEvents(from, to);
  }
  createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    return getStore().createEvent(event);
  }
  updateEvent(id: string, patch: Partial<Omit<CalendarEvent, "id">>): Promise<CalendarEvent | null> {
    return getStore().updateEvent(id, patch);
  }
  deleteEvent(id: string): Promise<boolean> {
    return getStore().deleteEvent(id);
  }
}

class StoreEmailProvider implements EmailProvider {
  listRecent(limit: number): Promise<EmailMessage[]> {
    return getStore().listRecentEmails(limit);
  }
  search(query: string): Promise<EmailMessage[]> {
    return getStore().searchEmails(query);
  }
  markRead(id: string): Promise<boolean> {
    return getStore().markEmailRead(id);
  }
  sendEmail(to: string, subject: string, body: string): Promise<{ id: string }> {
    return getStore().recordSentEmail(to, subject, body);
  }
}

const calendar = new StoreCalendarProvider();
const email = new StoreEmailProvider();

export function getCalendarProvider(): CalendarProvider {
  return calendar;
}

export function getEmailProvider(): EmailProvider {
  return email;
}
