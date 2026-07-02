import type { CalendarProvider, EmailProvider } from "./types";
import { MockCalendarProvider } from "./mock-calendar";
import { MockEmailProvider } from "./mock-email";

/**
 * Provider wiring. This is the single place to swap mocks for real
 * integrations, e.g.:
 *
 *   const calendar: CalendarProvider = new GoogleCalendarProvider(oauthClient);
 *   const email: EmailProvider = new GmailProvider(oauthClient);
 *
 * Module-level singletons keep mock state alive across requests in dev.
 */

const globalForProviders = globalThis as unknown as {
  __familyHqCalendar?: CalendarProvider;
  __familyHqEmail?: EmailProvider;
};

export function getCalendarProvider(): CalendarProvider {
  globalForProviders.__familyHqCalendar ??= new MockCalendarProvider();
  return globalForProviders.__familyHqCalendar;
}

export function getEmailProvider(): EmailProvider {
  globalForProviders.__familyHqEmail ??= new MockEmailProvider();
  return globalForProviders.__familyHqEmail;
}
