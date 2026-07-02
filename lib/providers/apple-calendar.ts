import ICAL from "ical.js";
import { DAVClient, type DAVCalendar, type DAVObject } from "tsdav";
import type { CalendarEvent } from "@/lib/types";
import type { CalendarProvider } from "./types";

/**
 * Apple (iCloud) Calendar via CalDAV.
 *
 * Apple has no OAuth API for third-party web apps; the supported integration
 * is CalDAV authenticated with an app-specific password
 * (appleid.apple.com → Sign-In and Security → App-Specific Passwords).
 *
 * Event ids are the CalDAV object URLs, so reads and writes round-trip
 * cleanly. Recurring events are expanded into occurrences for reads; deleting
 * an occurrence of a recurring event deletes the whole series (acceptable for
 * v1 — the agents mostly create simple events).
 */

const escapeText = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const toIcsUtc = (iso: string): string =>
  new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const MAX_OCCURRENCES = 200;

export class AppleCalendarProvider implements CalendarProvider {
  private connPromise: Promise<{ client: DAVClient; calendar: DAVCalendar }> | null = null;

  constructor(
    private username: string,
    private appPassword: string,
    /** Optional calendar display name (e.g. "Family"); defaults to the first event calendar. */
    private calendarName?: string,
  ) {}

  private conn(): Promise<{ client: DAVClient; calendar: DAVCalendar }> {
    this.connPromise ??= (async () => {
      const client = new DAVClient({
        serverUrl: "https://caldav.icloud.com",
        credentials: { username: this.username, password: this.appPassword },
        authMethod: "Basic",
        defaultAccountType: "caldav",
      });
      await client.login();
      const calendars = await client.fetchCalendars();
      const eventCalendars = calendars.filter(
        (c) => !c.components || c.components.includes("VEVENT"),
      );
      let calendar: DAVCalendar | undefined;
      if (this.calendarName) {
        const wanted = this.calendarName.toLowerCase();
        calendar = eventCalendars.find(
          (c) => String(c.displayName ?? "").toLowerCase() === wanted,
        );
        if (!calendar) {
          const names = eventCalendars.map((c) => String(c.displayName ?? "?")).join(", ");
          throw new Error(
            `Apple calendar "${this.calendarName}" not found. Available calendars: ${names}`,
          );
        }
      } else {
        calendar = eventCalendars[0];
      }
      if (!calendar) throw new Error("No event calendars found on this Apple account.");
      return { client, calendar };
    })().catch((err) => {
      // Don't cache failures (bad password, transient network) forever.
      this.connPromise = null;
      throw new Error(
        `Apple Calendar connection failed: ${err instanceof Error ? err.message : String(err)}. ` +
          "Check APPLE_CALDAV_USERNAME and the app-specific password.",
      );
    });
    return this.connPromise;
  }

  async listEvents(from: string, to: string): Promise<CalendarEvent[]> {
    const { client, calendar } = await this.conn();
    const objects = await client.fetchCalendarObjects({
      calendar,
      timeRange: { start: from, end: to },
    });
    const fromT = new Date(from).getTime();
    const toT = new Date(to).getTime();
    const events: CalendarEvent[] = [];

    for (const obj of objects) {
      if (!obj.data || !obj.url) continue;
      try {
        const comp = new ICAL.Component(ICAL.parse(obj.data));
        for (const vevent of comp.getAllSubcomponents("vevent")) {
          const ev = new ICAL.Event(vevent);
          if (ev.isRecurring()) {
            const iterator = ev.iterator();
            let next: ICAL.Time | null;
            let count = 0;
            while ((next = iterator.next()) && count++ < MAX_OCCURRENCES) {
              const occStart = next.toJSDate();
              if (occStart.getTime() > toT) break;
              if (occStart.getTime() < fromT) continue;
              const details = ev.getOccurrenceDetails(next);
              events.push(this.toEvent(obj, ev, details.startDate.toJSDate(), details.endDate.toJSDate()));
            }
          } else {
            const start = ev.startDate?.toJSDate();
            if (!start) continue;
            const t = start.getTime();
            if (t < fromT || t > toT) continue;
            const end = ev.endDate ? ev.endDate.toJSDate() : start;
            events.push(this.toEvent(obj, ev, start, end));
          }
        }
      } catch {
        // Skip objects we can't parse rather than failing the whole listing.
        continue;
      }
    }
    return events.sort((a, b) => a.start.localeCompare(b.start));
  }

  private toEvent(obj: DAVObject, ev: ICAL.Event, start: Date, end: Date): CalendarEvent {
    return {
      id: obj.url,
      title: ev.summary || "(untitled)",
      start: start.toISOString(),
      end: end.toISOString(),
      location: ev.location || undefined,
      description: ev.description || undefined,
    };
  }

  async createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const { client, calendar } = await this.conn();
    const uid = `familyhq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // Family member "attendees" aren't real CalDAV attendees (no email
    // invitations wanted) — fold them into the description instead.
    let description = event.description ?? "";
    if (event.attendees?.length) {
      description = description
        ? `${description}\nFor: ${event.attendees.join(", ")}`
        : `For: ${event.attendees.join(", ")}`;
    }

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FamilyHQ//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
      `DTSTART:${toIcsUtc(event.start)}`,
      `DTEND:${toIcsUtc(event.end)}`,
      `SUMMARY:${escapeText(event.title)}`,
      ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
      ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const result = await client.createCalendarObject({
      calendar,
      filename: `${uid}.ics`,
      iCalString: lines.join("\r\n"),
    });
    if (!result.ok) {
      throw new Error(`Apple Calendar rejected the event (HTTP ${result.status}).`);
    }
    const base = calendar.url.endsWith("/") ? calendar.url : `${calendar.url}/`;
    return {
      id: `${base}${uid}.ics`,
      title: event.title,
      start: new Date(event.start).toISOString(),
      end: new Date(event.end).toISOString(),
      location: event.location,
      attendees: event.attendees,
      description: description || undefined,
    };
  }

  private async fetchObject(id: string): Promise<DAVObject | null> {
    const { client, calendar } = await this.conn();
    const objects = await client.fetchCalendarObjects({ calendar, objectUrls: [id] });
    return objects.find((o) => o.data) ?? null;
  }

  async updateEvent(
    id: string,
    patch: Partial<Omit<CalendarEvent, "id">>,
  ): Promise<CalendarEvent | null> {
    const { client } = await this.conn();
    const obj = await this.fetchObject(id);
    if (!obj) return null;

    const comp = new ICAL.Component(ICAL.parse(obj.data));
    const vevent = comp.getFirstSubcomponent("vevent");
    if (!vevent) return null;
    const ev = new ICAL.Event(vevent);

    if (patch.title !== undefined) ev.summary = patch.title;
    if (patch.location !== undefined) ev.location = patch.location ?? "";
    if (patch.description !== undefined) ev.description = patch.description ?? "";
    if (patch.start !== undefined) ev.startDate = ICAL.Time.fromJSDate(new Date(patch.start), true);
    if (patch.end !== undefined) ev.endDate = ICAL.Time.fromJSDate(new Date(patch.end), true);

    await client.updateCalendarObject({
      calendarObject: { ...obj, data: comp.toString() },
    });

    return {
      id,
      title: ev.summary || "(untitled)",
      start: ev.startDate.toJSDate().toISOString(),
      end: ev.endDate.toJSDate().toISOString(),
      location: ev.location || undefined,
      description: ev.description || undefined,
    };
  }

  async deleteEvent(id: string): Promise<boolean> {
    const { client } = await this.conn();
    const obj = await this.fetchObject(id);
    if (!obj) return false;
    await client.deleteCalendarObject({ calendarObject: obj });
    return true;
  }
}
