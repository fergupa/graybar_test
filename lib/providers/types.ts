import type { CalendarEvent, EmailMessage } from "@/lib/types";

/**
 * Integration provider interfaces.
 *
 * The agents only ever talk to these interfaces. Swapping the mock
 * implementations for real ones (Google Calendar / Gmail, Microsoft 365, ...)
 * is purely a matter of writing a new class that implements the interface and
 * changing the wiring in lib/providers/index.ts — no agent code changes.
 */

export interface CalendarProvider {
  /** List events in the [from, to] ISO datetime range, sorted by start. */
  listEvents(from: string, to: string): Promise<CalendarEvent[]>;
  createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent>;
  updateEvent(id: string, patch: Partial<Omit<CalendarEvent, "id">>): Promise<CalendarEvent | null>;
  deleteEvent(id: string): Promise<boolean>;
}

export interface EmailProvider {
  /** Most recent messages first. */
  listRecent(limit: number): Promise<EmailMessage[]>;
  /** Case-insensitive search over sender, subject, and body. */
  search(query: string): Promise<EmailMessage[]>;
  markRead(id: string): Promise<boolean>;
  /** Draft an outgoing message. Mocks just record it; real providers send. */
  sendEmail(to: string, subject: string, body: string): Promise<{ id: string }>;
}
