import type { CalendarEvent, EmailMessage } from "@/lib/types";
import { getStore } from "@/lib/store";
import { AppleCalendarProvider } from "./apple-calendar";
import type { CalendarProvider, EmailProvider } from "./types";

/**
 * Provider wiring, selected by environment variables:
 *
 *  - Calendar: Apple/iCloud via CalDAV when APPLE_CALDAV_USERNAME +
 *    APPLE_CALDAV_APP_PASSWORD are set; otherwise the store-backed mock.
 *  - Email: store-backed mock (a Gmail/IMAP provider slots in the same way).
 *
 * To add another integration, implement the interface against its API and
 * add a branch here — no agent code changes.
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

const globalForProviders = globalThis as unknown as {
  __familyHqCalendar?: CalendarProvider;
  __familyHqEmail?: EmailProvider;
};

export function getCalendarProvider(): CalendarProvider {
  if (!globalForProviders.__familyHqCalendar) {
    const username = process.env.APPLE_CALDAV_USERNAME;
    const appPassword = process.env.APPLE_CALDAV_APP_PASSWORD;
    globalForProviders.__familyHqCalendar =
      username && appPassword
        ? new AppleCalendarProvider(username, appPassword, process.env.APPLE_CALDAV_CALENDAR)
        : new StoreCalendarProvider();
  }
  return globalForProviders.__familyHqCalendar;
}

export function getEmailProvider(): EmailProvider {
  globalForProviders.__familyHqEmail ??= new StoreEmailProvider();
  return globalForProviders.__familyHqEmail;
}
