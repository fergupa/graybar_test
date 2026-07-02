import fs from "fs";
import path from "path";
import type { FamilyData } from "./types";

/**
 * Family state store.
 *
 * Persists to data/family-data.json so state survives dev-server reloads.
 * Swap for a real database when moving past the demo stage — the agents only
 * touch it through the functions exported here.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "family-data.json");

function isoDay(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function seed(): FamilyData {
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
  };
}

let cache: FamilyData | null = null;

export function getFamilyData(): FamilyData {
  if (cache) return cache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      cache = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as FamilyData;
      return cache;
    }
  } catch {
    // fall through to reseed on corrupt file
  }
  cache = seed();
  saveFamilyData();
  return cache;
}

export function saveFamilyData(): void {
  if (!cache) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // In read-only environments we just keep state in memory.
  }
}

export function resetFamilyData(): FamilyData {
  cache = seed();
  saveFamilyData();
  return cache;
}

let idCounter = 1;
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${idCounter++}`;
}
