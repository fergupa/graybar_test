import type { FamilyData } from "@/lib/types";

function isoDay(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** Datetime `days` from now at the given local hour, as ISO string. */
function at(days: number, hour: number, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minutes, 0, 0);
  return d.toISOString();
}

function daysAgo(days: number, hour = 9): string {
  return at(-days, hour);
}

/**
 * Demo household. Dates are relative to "now" at seed time so the demo always
 * looks current. Used to initialize both the local JSON store and an empty
 * Supabase project.
 */
export function seed(): FamilyData {
  return {
    familyName: "The Harper Family",
    members: [
      { id: "m-1", name: "Alex", role: "parent", notes: "Works Tue–Sat, handles school pickups Mon/Wed" },
      { id: "m-2", name: "Sam", role: "parent", notes: "Remote worker, handles weekday appointments" },
      { id: "m-3", name: "Maya", role: "child", age: 9, notes: "Soccer (Westfield league), allergic to peanuts" },
      { id: "m-4", name: "Leo", role: "child", age: 6, notes: "Loves dinosaurs, picky eater — no 'green stuff'" },
    ],
    budget: [
      { id: "b-1", name: "Groceries", monthlyBudget: 900, spent: 412.35 },
      { id: "b-2", name: "Dining out", monthlyBudget: 250, spent: 143.5 },
      { id: "b-3", name: "Kids activities", monthlyBudget: 300, spent: 185.0 },
      { id: "b-4", name: "Utilities", monthlyBudget: 450, spent: 96.2 },
      { id: "b-5", name: "Household", monthlyBudget: 200, spent: 78.99 },
      { id: "b-6", name: "Fun / misc", monthlyBudget: 150, spent: 22.0 },
    ],
    transactions: [
      { id: "t-1", date: isoDay(-1), description: "FreshMart groceries", amount: 132.4, category: "Groceries" },
      { id: "t-2", date: isoDay(-2), description: "Soccer league fee (Maya, summer)", amount: 85.0, category: "Kids activities" },
      { id: "t-3", date: isoDay(-3), description: "Pizza night", amount: 46.5, category: "Dining out" },
      { id: "t-4", date: isoDay(-5), description: "Water bill", amount: 96.2, category: "Utilities" },
      { id: "t-5", date: isoDay(-6), description: "Costco run", amount: 214.95, category: "Groceries" },
    ],
    bills: [
      { id: "bill-1", name: "Electricity (City Power & Light)", amount: 187.42, dueDate: isoDay(13), autopay: false, paid: false },
      { id: "bill-2", name: "Internet", amount: 79.99, dueDate: isoDay(8), autopay: true, paid: false },
      { id: "bill-3", name: "Car insurance", amount: 164.0, dueDate: isoDay(19), autopay: true, paid: false },
      { id: "bill-4", name: "Mortgage", amount: 2350.0, dueDate: isoDay(-1), autopay: true, paid: true },
    ],
    tasks: [
      { id: "task-1", title: "RSVP to Jordan's birthday party for Leo", assignee: "Sam", due: isoDay(3), done: false },
      { id: "task-2", title: "Find a sitter for date night", assignee: "Alex", due: isoDay(3), done: false },
      { id: "task-3", title: "Turn in Maya's summer reading log", assignee: "Alex", due: isoDay(9), done: false },
      { id: "task-4", title: "Sign permission slip for field day", assignee: "Sam", done: true },
    ],
    mealPlan: [
      { day: isoDay(0), dinner: "Sheet-pan chicken fajitas" },
      { day: isoDay(1), dinner: "Spaghetti + salad", notes: "Leo: plain noodles" },
      { day: isoDay(2), dinner: "Leftovers night" },
    ],
    groceries: [
      { id: "g-1", name: "Milk", quantity: "2 gal", done: false },
      { id: "g-2", name: "Chicken thighs", quantity: "3 lb", done: false },
      { id: "g-3", name: "Bell peppers", quantity: "4", done: false },
      { id: "g-4", name: "Tortillas", done: false },
      { id: "g-5", name: "Sunscreen (field day!)", done: false },
    ],
    events: [
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
    ],
    emails: [
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
    ],
  };
}
