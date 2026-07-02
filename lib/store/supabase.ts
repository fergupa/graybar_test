import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
import { seed } from "./seed";
import { newId, type AddTransactionResult, type FamilyStore, type MemberInput } from "./types";

const HOUSEHOLD_ID = "default";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const memberFromRow = (r: Row): FamilyMember => ({
  id: r.id,
  name: r.name,
  role: r.role,
  age: r.age ?? undefined,
  notes: r.notes ?? undefined,
  email: r.email ?? undefined,
  phone: r.phone ?? undefined,
  birthday: r.birthday ?? undefined,
});

const budgetFromRow = (r: Row): BudgetCategory => ({
  id: r.id,
  name: r.name,
  monthlyBudget: Number(r.monthly_budget),
  spent: Number(r.spent),
});

const txnFromRow = (r: Row): Transaction => ({
  id: r.id,
  date: r.date,
  description: r.description,
  amount: Number(r.amount),
  category: r.category,
});

const billFromRow = (r: Row): Bill => ({
  id: r.id,
  name: r.name,
  amount: Number(r.amount),
  dueDate: r.due_date,
  autopay: r.autopay,
  paid: r.paid,
});

const taskFromRow = (r: Row): FamilyTask => ({
  id: r.id,
  title: r.title,
  assignee: r.assignee ?? undefined,
  due: r.due ?? undefined,
  done: r.done,
});

const mealFromRow = (r: Row): MealPlanEntry => ({
  day: r.day,
  dinner: r.dinner,
  notes: r.notes ?? undefined,
});

const groceryFromRow = (r: Row): GroceryItem => ({
  id: r.id,
  name: r.name,
  quantity: r.quantity ?? undefined,
  done: r.done,
});

const eventFromRow = (r: Row): CalendarEvent => ({
  id: r.id,
  title: r.title,
  start: r.start_at,
  end: r.end_at,
  location: r.location ?? undefined,
  attendees: r.attendees ?? undefined,
  description: r.description ?? undefined,
});

const conversationFromRow = (r: Row): Conversation => ({
  id: r.id,
  title: r.title,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const chatMessageFromRow = (r: Row): ChatMessage => ({
  id: r.id,
  role: r.role,
  content: r.content,
  createdAt: r.created_at,
});

const emailFromRow = (r: Row): EmailMessage => ({
  id: r.id,
  from: r.from_addr,
  subject: r.subject,
  date: r.date,
  body: r.body,
  read: r.read,
});

function throwIf(error: { message: string } | null, op: string): void {
  if (error) throw new Error(`Supabase ${op} failed: ${error.message}`);
}

/**
 * Supabase-backed store. Uses the service role key server-side only (RLS is
 * deny-by-default for other keys). Seeds the demo household on first use if
 * the database is empty.
 */
export class SupabaseStore implements FamilyStore {
  private db: SupabaseClient;
  private seeded: Promise<void> | null = null;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private ensureSeeded(): Promise<void> {
    this.seeded ??= (async () => {
      const { data, error } = await this.db
        .from("households")
        .select("id")
        .eq("id", HOUSEHOLD_ID)
        .maybeSingle();
      throwIf(error, "seed check");
      if (data) return;

      const s = seed();
      const hh = { household_id: HOUSEHOLD_ID };
      throwIf(
        (await this.db.from("households").insert({ id: HOUSEHOLD_ID, name: s.familyName })).error,
        "seed households",
      );
      throwIf(
        (await this.db.from("members").insert(
          s.members.map((m) => ({ ...hh, id: m.id, name: m.name, role: m.role, age: m.age ?? null, notes: m.notes ?? null })),
        )).error,
        "seed members",
      );
      throwIf(
        (await this.db.from("budget_categories").insert(
          s.budget.map((b) => ({ ...hh, id: b.id, name: b.name, monthly_budget: b.monthlyBudget, spent: b.spent })),
        )).error,
        "seed budget",
      );
      throwIf(
        (await this.db.from("transactions").insert(
          s.transactions.map((t) => ({ ...hh, id: t.id, date: t.date, description: t.description, amount: t.amount, category: t.category })),
        )).error,
        "seed transactions",
      );
      throwIf(
        (await this.db.from("bills").insert(
          s.bills.map((b) => ({ ...hh, id: b.id, name: b.name, amount: b.amount, due_date: b.dueDate, autopay: b.autopay, paid: b.paid })),
        )).error,
        "seed bills",
      );
      throwIf(
        (await this.db.from("tasks").insert(
          s.tasks.map((t) => ({ ...hh, id: t.id, title: t.title, assignee: t.assignee ?? null, due: t.due ?? null, done: t.done })),
        )).error,
        "seed tasks",
      );
      throwIf(
        (await this.db.from("meal_plan").insert(
          s.mealPlan.map((m) => ({ ...hh, day: m.day, dinner: m.dinner, notes: m.notes ?? null })),
        )).error,
        "seed meal plan",
      );
      throwIf(
        (await this.db.from("groceries").insert(
          s.groceries.map((g) => ({ ...hh, id: g.id, name: g.name, quantity: g.quantity ?? null, done: g.done })),
        )).error,
        "seed groceries",
      );
      throwIf(
        (await this.db.from("calendar_events").insert(
          s.events.map((e) => ({ ...hh, id: e.id, title: e.title, start_at: e.start, end_at: e.end, location: e.location ?? null, attendees: e.attendees ?? null, description: e.description ?? null })),
        )).error,
        "seed calendar",
      );
      throwIf(
        (await this.db.from("emails").insert(
          s.emails.map((m) => ({ ...hh, id: m.id, from_addr: m.from, subject: m.subject, date: m.date, body: m.body, read: m.read })),
        )).error,
        "seed emails",
      );
    })().catch((err) => {
      // Allow a retry on the next request instead of caching the failure.
      this.seeded = null;
      throw err;
    });
    return this.seeded;
  }

  private from(table: string) {
    return this.db.from(table);
  }

  async getHousehold(): Promise<HouseholdProfile> {
    await this.ensureSeeded();
    const [hh, members] = await Promise.all([
      this.from("households").select("name, notes, onboarded").eq("id", HOUSEHOLD_ID).single(),
      this.from("members").select("*").eq("household_id", HOUSEHOLD_ID).order("id"),
    ]);
    throwIf(hh.error, "getHousehold");
    throwIf(members.error, "getHousehold members");
    const row = hh.data as Row;
    return {
      familyName: row.name,
      notes: row.notes ?? undefined,
      onboarded: Boolean(row.onboarded),
      members: (members.data as Row[]).map(memberFromRow),
    };
  }

  async updateHouseholdProfile(input: {
    familyName?: string;
    notes?: string;
  }): Promise<HouseholdProfile> {
    await this.ensureSeeded();
    const patch: Row = {};
    if (input.familyName !== undefined) patch.name = input.familyName;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (Object.keys(patch).length > 0) {
      throwIf(
        (await this.from("households").update(patch).eq("id", HOUSEHOLD_ID)).error,
        "updateHouseholdProfile",
      );
    }
    return this.getHousehold();
  }

  async upsertMember(input: MemberInput): Promise<FamilyMember> {
    await this.ensureSeeded();
    const row: Row = {
      name: input.name,
      role: input.role,
      age: input.age ?? null,
      notes: input.notes ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      birthday: input.birthday ?? null,
    };
    if (input.id) {
      const { data, error } = await this.from("members")
        .update(row)
        .eq("id", input.id)
        .eq("household_id", HOUSEHOLD_ID)
        .select()
        .maybeSingle();
      throwIf(error, "upsertMember update");
      if (data) return memberFromRow(data as Row);
    }
    const { data, error } = await this.from("members")
      .insert({ ...row, id: input.id ?? newId("m"), household_id: HOUSEHOLD_ID })
      .select()
      .single();
    throwIf(error, "upsertMember insert");
    return memberFromRow(data as Row);
  }

  async removeMember(id: string): Promise<boolean> {
    const { data, error } = await this.from("members")
      .delete()
      .eq("id", id)
      .eq("household_id", HOUSEHOLD_ID)
      .select();
    throwIf(error, "removeMember");
    return (data as Row[]).length > 0;
  }

  async setOnboarded(done: boolean): Promise<void> {
    await this.ensureSeeded();
    throwIf(
      (await this.from("households").update({ onboarded: done }).eq("id", HOUSEHOLD_ID)).error,
      "setOnboarded",
    );
  }

  async clearDemoData(): Promise<void> {
    await this.ensureSeeded();
    const tables = [
      "members",
      "transactions",
      "bills",
      "tasks",
      "meal_plan",
      "groceries",
      "calendar_events",
      "emails",
    ];
    for (const table of tables) {
      throwIf(
        (await this.from(table).delete().eq("household_id", HOUSEHOLD_ID)).error,
        `clearDemoData ${table}`,
      );
    }
    throwIf(
      (await this.from("budget_categories").update({ spent: 0 }).eq("household_id", HOUSEHOLD_ID))
        .error,
      "clearDemoData budget reset",
    );
  }

  async getBudget(): Promise<BudgetCategory[]> {
    await this.ensureSeeded();
    const { data, error } = await this.from("budget_categories")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .order("id");
    throwIf(error, "getBudget");
    return (data as Row[]).map(budgetFromRow);
  }

  async setBudgetCategory(name: string, monthlyBudget: number): Promise<BudgetCategory> {
    const existing = (await this.getBudget()).find(
      (b) => b.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      const { data, error } = await this.from("budget_categories")
        .update({ monthly_budget: monthlyBudget })
        .eq("id", existing.id)
        .select()
        .single();
      throwIf(error, "setBudgetCategory");
      return budgetFromRow(data as Row);
    }
    const { data, error } = await this.from("budget_categories")
      .insert({ id: newId("b"), household_id: HOUSEHOLD_ID, name, monthly_budget: monthlyBudget, spent: 0 })
      .select()
      .single();
    throwIf(error, "setBudgetCategory insert");
    return budgetFromRow(data as Row);
  }

  async getTransactions(): Promise<Transaction[]> {
    await this.ensureSeeded();
    const { data, error } = await this.from("transactions")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .order("date", { ascending: false })
      .limit(50);
    throwIf(error, "getTransactions");
    return (data as Row[]).map(txnFromRow);
  }

  async addTransaction(input: {
    description: string;
    amount: number;
    category: string;
    date?: string;
  }): Promise<AddTransactionResult> {
    const budget = await this.getBudget();
    const cat = budget.find((b) => b.name.toLowerCase() === input.category.toLowerCase());
    if (!cat) {
      return { error: `Unknown category "${input.category}". Valid: ${budget.map((b) => b.name).join(", ")}` };
    }
    const txn: Transaction = {
      id: newId("t"),
      date: input.date ?? new Date().toISOString().slice(0, 10),
      description: input.description,
      amount: input.amount,
      category: cat.name,
    };
    throwIf(
      (await this.from("transactions").insert({
        id: txn.id,
        household_id: HOUSEHOLD_ID,
        date: txn.date,
        description: txn.description,
        amount: txn.amount,
        category: txn.category,
      })).error,
      "addTransaction",
    );
    const spent = Math.round((cat.spent + txn.amount) * 100) / 100;
    throwIf(
      (await this.from("budget_categories").update({ spent }).eq("id", cat.id)).error,
      "addTransaction spent update",
    );
    return { added: txn, categorySpent: spent, categoryBudget: cat.monthlyBudget };
  }

  async getBills(): Promise<Bill[]> {
    await this.ensureSeeded();
    const { data, error } = await this.from("bills")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .order("due_date");
    throwIf(error, "getBills");
    return (data as Row[]).map(billFromRow);
  }

  async markBillPaid(id: string): Promise<Bill | null> {
    const { data, error } = await this.from("bills")
      .update({ paid: true })
      .eq("id", id)
      .eq("household_id", HOUSEHOLD_ID)
      .select()
      .maybeSingle();
    throwIf(error, "markBillPaid");
    return data ? billFromRow(data as Row) : null;
  }

  async getTasks(): Promise<FamilyTask[]> {
    await this.ensureSeeded();
    const { data, error } = await this.from("tasks")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .order("due", { ascending: true, nullsFirst: false });
    throwIf(error, "getTasks");
    return (data as Row[]).map(taskFromRow);
  }

  async addTask(input: { title: string; assignee?: string; due?: string }): Promise<FamilyTask> {
    await this.ensureSeeded();
    const { data, error } = await this.from("tasks")
      .insert({
        id: newId("task"),
        household_id: HOUSEHOLD_ID,
        title: input.title,
        assignee: input.assignee ?? null,
        due: input.due ?? null,
        done: false,
      })
      .select()
      .single();
    throwIf(error, "addTask");
    return taskFromRow(data as Row);
  }

  async completeTask(id: string): Promise<FamilyTask | null> {
    const { data, error } = await this.from("tasks")
      .update({ done: true })
      .eq("id", id)
      .eq("household_id", HOUSEHOLD_ID)
      .select()
      .maybeSingle();
    throwIf(error, "completeTask");
    return data ? taskFromRow(data as Row) : null;
  }

  async getMealPlan(): Promise<MealPlanEntry[]> {
    await this.ensureSeeded();
    const { data, error } = await this.from("meal_plan")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .order("day");
    throwIf(error, "getMealPlan");
    return (data as Row[]).map(mealFromRow);
  }

  async setMealPlanEntry(entry: MealPlanEntry): Promise<MealPlanEntry> {
    await this.ensureSeeded();
    const { error } = await this.from("meal_plan").upsert({
      household_id: HOUSEHOLD_ID,
      day: entry.day,
      dinner: entry.dinner,
      notes: entry.notes ?? null,
    });
    throwIf(error, "setMealPlanEntry");
    return entry;
  }

  async getGroceries(): Promise<GroceryItem[]> {
    await this.ensureSeeded();
    const { data, error } = await this.from("groceries")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .order("id");
    throwIf(error, "getGroceries");
    return (data as Row[]).map(groceryFromRow);
  }

  async addGroceryItems(
    items: { name: string; quantity?: string }[],
  ): Promise<{ added: string[]; alreadyOnList: string[] }> {
    const current = await this.getGroceries();
    const open = new Set(current.filter((g) => !g.done).map((g) => g.name.toLowerCase()));
    const added: string[] = [];
    const alreadyOnList: string[] = [];
    const rows: Row[] = [];
    for (const item of items) {
      const name = item.name.trim();
      if (!name) continue;
      if (open.has(name.toLowerCase())) {
        alreadyOnList.push(name);
        continue;
      }
      open.add(name.toLowerCase());
      rows.push({
        id: newId("g"),
        household_id: HOUSEHOLD_ID,
        name,
        quantity: item.quantity ?? null,
        done: false,
      });
      added.push(name);
    }
    if (rows.length > 0) {
      throwIf((await this.from("groceries").insert(rows)).error, "addGroceryItems");
    }
    return { added, alreadyOnList };
  }

  async checkOffGroceryItem(id: string, remove?: boolean): Promise<{ ok: boolean }> {
    if (remove) {
      const { data, error } = await this.from("groceries")
        .delete()
        .eq("id", id)
        .eq("household_id", HOUSEHOLD_ID)
        .select();
      throwIf(error, "removeGroceryItem");
      return { ok: (data as Row[]).length > 0 };
    }
    const { data, error } = await this.from("groceries")
      .update({ done: true })
      .eq("id", id)
      .eq("household_id", HOUSEHOLD_ID)
      .select()
      .maybeSingle();
    throwIf(error, "checkOffGroceryItem");
    return { ok: Boolean(data) };
  }

  async listEvents(from: string, to: string): Promise<CalendarEvent[]> {
    await this.ensureSeeded();
    const { data, error } = await this.from("calendar_events")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .gte("start_at", from)
      .lte("start_at", to)
      .order("start_at");
    throwIf(error, "listEvents");
    return (data as Row[]).map(eventFromRow);
  }

  async createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    await this.ensureSeeded();
    const { data, error } = await this.from("calendar_events")
      .insert({
        id: newId("evt"),
        household_id: HOUSEHOLD_ID,
        title: event.title,
        start_at: event.start,
        end_at: event.end,
        location: event.location ?? null,
        attendees: event.attendees ?? null,
        description: event.description ?? null,
      })
      .select()
      .single();
    throwIf(error, "createEvent");
    return eventFromRow(data as Row);
  }

  async updateEvent(
    id: string,
    patch: Partial<Omit<CalendarEvent, "id">>,
  ): Promise<CalendarEvent | null> {
    const row: Row = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.start !== undefined) row.start_at = patch.start;
    if (patch.end !== undefined) row.end_at = patch.end;
    if (patch.location !== undefined) row.location = patch.location;
    if (patch.attendees !== undefined) row.attendees = patch.attendees;
    if (patch.description !== undefined) row.description = patch.description;
    const { data, error } = await this.from("calendar_events")
      .update(row)
      .eq("id", id)
      .eq("household_id", HOUSEHOLD_ID)
      .select()
      .maybeSingle();
    throwIf(error, "updateEvent");
    return data ? eventFromRow(data as Row) : null;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const { data, error } = await this.from("calendar_events")
      .delete()
      .eq("id", id)
      .eq("household_id", HOUSEHOLD_ID)
      .select();
    throwIf(error, "deleteEvent");
    return (data as Row[]).length > 0;
  }

  async listConversations(): Promise<Conversation[]> {
    await this.ensureSeeded();
    const { data, error } = await this.from("conversations")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .order("updated_at", { ascending: false })
      .limit(100);
    throwIf(error, "listConversations");
    return (data as Row[]).map(conversationFromRow);
  }

  async createConversation(title: string): Promise<Conversation> {
    await this.ensureSeeded();
    const now = new Date().toISOString();
    const { data, error } = await this.from("conversations")
      .insert({
        id: newId("conv"),
        household_id: HOUSEHOLD_ID,
        title,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    throwIf(error, "createConversation");
    return conversationFromRow(data as Row);
  }

  async deleteConversation(id: string): Promise<boolean> {
    const { data, error } = await this.from("conversations")
      .delete()
      .eq("id", id)
      .eq("household_id", HOUSEHOLD_ID)
      .select();
    throwIf(error, "deleteConversation");
    return (data as Row[]).length > 0;
  }

  async getConversationMessages(conversationId: string): Promise<ChatMessage[] | null> {
    await this.ensureSeeded();
    const { data: conv, error: convError } = await this.from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("household_id", HOUSEHOLD_ID)
      .maybeSingle();
    throwIf(convError, "getConversationMessages check");
    if (!conv) return null;
    const { data, error } = await this.from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .order("id");
    throwIf(error, "getConversationMessages");
    return (data as Row[]).map(chatMessageFromRow);
  }

  async appendChatMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const { data, error } = await this.from("chat_messages")
      .insert({
        id: newId("msg"),
        conversation_id: conversationId,
        household_id: HOUSEHOLD_ID,
        role,
        content,
        created_at: now,
      })
      .select()
      .single();
    throwIf(error, "appendChatMessage");
    throwIf(
      (await this.from("conversations").update({ updated_at: now }).eq("id", conversationId))
        .error,
      "appendChatMessage touch",
    );
    return chatMessageFromRow(data as Row);
  }

  async listRecentEmails(limit: number): Promise<EmailMessage[]> {
    await this.ensureSeeded();
    const { data, error } = await this.from("emails")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .order("date", { ascending: false })
      .limit(limit);
    throwIf(error, "listRecentEmails");
    return (data as Row[]).map(emailFromRow);
  }

  async searchEmails(query: string): Promise<EmailMessage[]> {
    await this.ensureSeeded();
    // Escape PostgREST filter syntax characters in user input.
    const q = query.replaceAll(/[,()%]/g, " ").trim();
    const { data, error } = await this.from("emails")
      .select("*")
      .eq("household_id", HOUSEHOLD_ID)
      .or(`from_addr.ilike.%${q}%,subject.ilike.%${q}%,body.ilike.%${q}%`)
      .order("date", { ascending: false });
    throwIf(error, "searchEmails");
    return (data as Row[]).map(emailFromRow);
  }

  async markEmailRead(id: string): Promise<boolean> {
    const { data, error } = await this.from("emails")
      .update({ read: true })
      .eq("id", id)
      .eq("household_id", HOUSEHOLD_ID)
      .select()
      .maybeSingle();
    throwIf(error, "markEmailRead");
    return Boolean(data);
  }

  async recordSentEmail(to: string, subject: string, body: string): Promise<{ id: string }> {
    await this.ensureSeeded();
    const id = newId("em-out");
    throwIf(
      (await this.from("emails").insert({
        id,
        household_id: HOUSEHOLD_ID,
        from_addr: "You (sent)",
        subject: `To ${to}: ${subject}`,
        date: new Date().toISOString(),
        body,
        read: true,
      })).error,
      "recordSentEmail",
    );
    return { id };
  }
}
