import type {
  Bill,
  BudgetCategory,
  CalendarEvent,
  ChatMessage,
  Conversation,
  EmailMessage,
  FamilyMember,
  FamilyTask,
  GroceryItem,
  HouseholdProfile,
  MealPlanEntry,
  Transaction,
} from "@/lib/types";

export type MemberInput = Omit<FamilyMember, "id"> & { id?: string };

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
  getHousehold(): Promise<HouseholdProfile>;

  // Profile & onboarding
  updateHouseholdProfile(input: { familyName?: string; notes?: string }): Promise<HouseholdProfile>;
  upsertMember(input: MemberInput): Promise<FamilyMember>;
  removeMember(id: string): Promise<boolean>;
  setOnboarded(done: boolean): Promise<void>;
  /**
   * Wipe the seeded demo content (members, calendar, inbox, transactions,
   * bills, tasks, meals, groceries; budget spent reset to 0). Keeps the
   * household row and budget categories.
   */
  clearDemoData(): Promise<void>;

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

  // Chat history
  listConversations(): Promise<Conversation[]>;
  createConversation(title: string): Promise<Conversation>;
  deleteConversation(id: string): Promise<boolean>;
  /** Returns null if the conversation doesn't exist. */
  getConversationMessages(conversationId: string): Promise<ChatMessage[] | null>;
  /** Appends a message and bumps the conversation's updatedAt. */
  appendChatMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<ChatMessage>;

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
