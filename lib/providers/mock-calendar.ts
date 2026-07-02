import type { CalendarEvent } from "@/lib/types";
import type { CalendarProvider } from "./types";

/** Build a date `days` from now at the given local hour, as ISO string. */
function at(days: number, hour: number, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minutes, 0, 0);
  return d.toISOString();
}

let nextId = 1000;

function seedEvents(): CalendarEvent[] {
  return [
    {
      id: "evt-1",
      title: "Maya — soccer practice",
      start: at(0, 17, 30),
      end: at(0, 19, 0),
      location: "Riverside Park, Field 3",
      attendees: ["Maya"],
    },
    {
      id: "evt-2",
      title: "Dentist — Leo (cleaning)",
      start: at(1, 15, 0),
      end: at(1, 16, 0),
      location: "Bright Smiles Dental",
      attendees: ["Leo", "Sam"],
    },
    {
      id: "evt-3",
      title: "Parent-teacher conference (Maya)",
      start: at(2, 16, 30),
      end: at(2, 17, 0),
      location: "Lincoln Elementary, Room 12",
      attendees: ["Alex"],
    },
    {
      id: "evt-4",
      title: "Date night",
      start: at(4, 19, 0),
      end: at(4, 22, 0),
      location: "TBD — need a sitter!",
      attendees: ["Alex", "Sam"],
    },
    {
      id: "evt-5",
      title: "Maya — soccer game vs. Falcons",
      start: at(5, 9, 0),
      end: at(5, 11, 0),
      location: "Westfield Sports Complex",
      attendees: ["Maya", "Alex", "Sam", "Leo"],
    },
    {
      id: "evt-6",
      title: "Jordan's birthday party (Leo invited)",
      start: at(6, 14, 0),
      end: at(6, 16, 30),
      location: "Bounce Zone",
      attendees: ["Leo"],
      description: "Bring a gift — Jordan likes LEGO and dinosaurs.",
    },
  ];
}

export class MockCalendarProvider implements CalendarProvider {
  private events: CalendarEvent[];

  constructor(initial?: CalendarEvent[]) {
    this.events = initial ?? seedEvents();
  }

  async listEvents(from: string, to: string): Promise<CalendarEvent[]> {
    const fromT = new Date(from).getTime();
    const toT = new Date(to).getTime();
    return this.events
      .filter((e) => {
        const t = new Date(e.start).getTime();
        return t >= fromT && t <= toT;
      })
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  async createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const created: CalendarEvent = { ...event, id: `evt-${nextId++}` };
    this.events.push(created);
    return created;
  }

  async updateEvent(
    id: string,
    patch: Partial<Omit<CalendarEvent, "id">>,
  ): Promise<CalendarEvent | null> {
    const evt = this.events.find((e) => e.id === id);
    if (!evt) return null;
    Object.assign(evt, patch);
    return evt;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const before = this.events.length;
    this.events = this.events.filter((e) => e.id !== id);
    return this.events.length < before;
  }
}
