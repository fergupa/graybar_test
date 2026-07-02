import type {
  Bill,
  BudgetCategory,
  CalendarEvent,
  EmailMessage,
  FamilyMember,
  FamilyTask,
  GroceryItem,
  MealPlanEntry,
  Transaction,
} from "@/lib/types";

export type AddTransactionResult =
  | { error: string }
  | { added: Transaction; categorySpent: number; categoryBudget: number };

/**
 * Storage backend for all household state.
 *
 * Two implementations:
 *  - SupabaseStore (lib/store/supabase.ts) — production; used when
 *    SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
 *  - LocalJsonStore (lib/store/local.ts) — zero-setup fallback that persists
 *    to data/family-data.json.
 *
 * Agents and API routes only ever talk to this interface.
 */
export interface FamilyStore {
  getHousehold(): Promise<{ familyName: string; members: FamilyMember[] }>;

  // Finance
  getBudget(): Promise<BudgetCategory[]>;
  setBudgetCategory(name: string, monthlyBudget: number): Promise<BudgetCategory>;
  getTransactions(): Promise<Transaction[]>;
  addTransaction(input: {
    description: string;
    amount: number;
    category: string;
    date?: string;
  }): Promise<AddTransactionResult>;
  getBills(): Promise<Bill[]>;
  markBillPaid(id: string): Promise<Bill | null>;

  // Tasks
  getTasks(): Promise<FamilyTask[]>;
  addTask(input: { title: string; assignee?: string; due?: string }): Promise<FamilyTask>;
  completeTask(id: string): Promise<FamilyTask | null>;

  // Food
  getMealPlan(): Promise<MealPlanEntry[]>;
  setMealPlanEntry(entry: MealPlanEntry): Promise<MealPlanEntry>;
  getGroceries(): Promise<GroceryItem[]>;
  addGroceryItems(
    items: { name: string; quantity?: string }[],
  ): Promise<{ added: string[]; alreadyOnList: string[] }>;
  checkOffGroceryItem(id: string, remove?: boolean): Promise<{ ok: boolean }>;

  // Calendar
  listEvents(from: string, to: string): Promise<CalendarEvent[]>;
  createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent>;
  updateEvent(id: string, patch: Partial<Omit<CalendarEvent, "id">>): Promise<CalendarEvent | null>;
  deleteEvent(id: string): Promise<boolean>;

  // Email
  listRecentEmails(limit: number): Promise<EmailMessage[]>;
  searchEmails(query: string): Promise<EmailMessage[]>;
  markEmailRead(id: string): Promise<boolean>;
  recordSentEmail(to: string, subject: string, body: string): Promise<{ id: string }>;
}

let idCounter = 1;
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${idCounter++}`;
}
