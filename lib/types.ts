// Shared domain types for Family HQ.

export interface FamilyMember {
  id: string;
  name: string;
  role: "parent" | "child";
  age?: number;
  notes?: string;
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

export interface FamilyData {
  familyName: string;
  members: FamilyMember[];
  budget: BudgetCategory[];
  transactions: Transaction[];
  bills: Bill[];
  tasks: FamilyTask[];
  mealPlan: MealPlanEntry[];
  groceries: GroceryItem[];
}
