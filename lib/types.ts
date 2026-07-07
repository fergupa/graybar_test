// Shared domain types for Family HQ.

export interface FamilyMember {
  id: string;
  name: string;
  role: "parent" | "child";
  age?: number;
  notes?: string;
  email?: string;
  phone?: string;
  /** ISO 8601 date */
  birthday?: string;
}

export interface HouseholdProfile {
  familyName: string;
  /** Freeform household context: address, schools, routines, sitter contacts... */
  notes?: string;
  /** False while the household is still running on seeded demo data. */
  onboarded: boolean;
  members: FamilyMember[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO 8601 datetime */
  start: string;
  /** ISO 8601 datetime */
  end: string;
  location?: string;
  attendees?: string[];
  description?: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  /** ISO 8601 datetime */
  date: string;
  body: string;
  read: boolean;
}

export interface BudgetCategory {
  id: string;
  name: string;
  monthlyBudget: number;
  spent: number;
}

export interface Transaction {
  id: string;
  /** ISO 8601 date */
  date: string;
  description: string;
  amount: number;
  category: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  /** ISO 8601 date */
  dueDate: string;
  autopay: boolean;
  paid: boolean;
}

export interface FamilyTask {
  id: string;
  title: string;
  assignee?: string;
  /** ISO 8601 date */
  due?: string;
  done: boolean;
}

export interface MealPlanEntry {
  /** ISO 8601 date */
  day: string;
  dinner: string;
  notes?: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity?: string;
  done: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  /** ISO 8601 datetime */
  createdAt: string;
  /** ISO 8601 datetime */
  updatedAt: string;
}

export interface ChatAttachmentMeta {
  name: string;
  /** image/jpeg, image/png, image/gif, image/webp, or application/pdf */
  mediaType: string;
  /** Raw size in bytes */
  size: number;
  /** Where the binary lives (Supabase Storage path or local file path) */
  storagePath: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachmentMeta[];
  /** ISO 8601 datetime */
  createdAt: string;
}

/** Conversation with inline messages — used by the local JSON store. */
export interface StoredConversation extends Conversation {
  messages: ChatMessage[];
}

/** Full household snapshot — used by the seed and the local JSON store. */
export interface FamilyData {
  familyName: string;
  notes?: string;
  onboarded?: boolean;
  members: FamilyMember[];
  budget: BudgetCategory[];
  transactions: Transaction[];
  bills: Bill[];
  tasks: FamilyTask[];
  mealPlan: MealPlanEntry[];
  groceries: GroceryItem[];
  events: CalendarEvent[];
  emails: EmailMessage[];
  conversations?: StoredConversation[];
}
