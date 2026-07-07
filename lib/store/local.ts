import fs from "fs";
import path from "path";
import type {
  Bill,
  BudgetCategory,
  CalendarEvent,
  EmailMessage,
  FamilyData,
  FamilyMember,
  FamilyTask,
  GroceryItem,
  MealPlanEntry,
  Transaction,
} from "@/lib/types";
import type { ChatMessage, Conversation, HouseholdProfile } from "@/lib/types";
import { seed } from "./seed";
import {
  newId,
  type AddTransactionResult,
  type FamilyStore,
  type MemberInput,
  type NewAttachment,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "family-data.json");
const ATTACHMENTS_DIR = path.join(DATA_DIR, "attachments");

/**
 * Zero-setup store: keeps the whole household in data/family-data.json.
 * Good for local dev; on serverless hosts state is ephemeral — use Supabase
 * there (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 */
export class LocalJsonStore implements FamilyStore {
  private cache: FamilyData | null = null;

  private data(): FamilyData {
    if (this.cache) return this.cache;
    try {
      if (fs.existsSync(DATA_FILE)) {
        this.cache = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as FamilyData;
        // Older data files predate events/emails living in the store.
        const fresh = seed();
        this.cache.events ??= fresh.events;
        this.cache.emails ??= fresh.emails;
        return this.cache;
      }
    } catch {
      // corrupt file — reseed
    }
    this.cache = seed();
    this.save();
    return this.cache;
  }

  private save(): void {
    if (!this.cache) return;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.cache, null, 2));
    } catch {
      // read-only filesystem — keep state in memory only
    }
  }

  async getHousehold(): Promise<HouseholdProfile> {
    const d = this.data();
    return {
      familyName: d.familyName,
      notes: d.notes,
      onboarded: d.onboarded ?? false,
      members: d.members,
    };
  }

  async updateHouseholdProfile(input: {
    familyName?: string;
    notes?: string;
  }): Promise<HouseholdProfile> {
    const d = this.data();
    if (input.familyName !== undefined) d.familyName = input.familyName;
    if (input.notes !== undefined) d.notes = input.notes;
    this.save();
    return this.getHousehold();
  }

  async upsertMember(input: MemberInput): Promise<FamilyMember> {
    const d = this.data();
    if (input.id) {
      const existing = d.members.find((m) => m.id === input.id);
      if (existing) {
        Object.assign(existing, input);
        this.save();
        return existing;
      }
    }
    const member: FamilyMember = { ...input, id: input.id ?? newId("m") };
    d.members.push(member);
    this.save();
    return member;
  }

  async removeMember(id: string): Promise<boolean> {
    const d = this.data();
    const before = d.members.length;
    d.members = d.members.filter((m) => m.id !== id);
    this.save();
    return d.members.length < before;
  }

  async setOnboarded(done: boolean): Promise<void> {
    this.data().onboarded = done;
    this.save();
  }

  async clearDemoData(): Promise<void> {
    const d = this.data();
    d.members = [];
    d.transactions = [];
    d.bills = [];
    d.tasks = [];
    d.mealPlan = [];
    d.groceries = [];
    d.events = [];
    d.emails = [];
    for (const cat of d.budget) cat.spent = 0;
    this.save();
  }

  async getBudget(): Promise<BudgetCategory[]> {
    return this.data().budget;
  }

  async setBudgetCategory(name: string, monthlyBudget: number): Promise<BudgetCategory> {
    const d = this.data();
    let cat = d.budget.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (cat) {
      cat.monthlyBudget = monthlyBudget;
    } else {
      cat = { id: newId("b"), name, monthlyBudget, spent: 0 };
      d.budget.push(cat);
    }
    this.save();
    return cat;
  }

  async getTransactions(): Promise<Transaction[]> {
    return [...this.data().transactions].sort((a, b) => b.date.localeCompare(a.date));
  }

  async addTransaction(input: {
    description: string;
    amount: number;
    category: string;
    date?: string;
  }): Promise<AddTransactionResult> {
    const d = this.data();
    const cat = d.budget.find((b) => b.name.toLowerCase() === input.category.toLowerCase());
    if (!cat) {
      return { error: `Unknown category "${input.category}". Valid: ${d.budget.map((b) => b.name).join(", ")}` };
    }
    const txn: Transaction = {
      id: newId("t"),
      date: input.date ?? new Date().toISOString().slice(0, 10),
      description: input.description,
      amount: input.amount,
      category: cat.name,
    };
    d.transactions.push(txn);
    cat.spent = Math.round((cat.spent + txn.amount) * 100) / 100;
    this.save();
    return { added: txn, categorySpent: cat.spent, categoryBudget: cat.monthlyBudget };
  }

  async getBills(): Promise<Bill[]> {
    return [...this.data().bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  async markBillPaid(id: string): Promise<Bill | null> {
    const bill = this.data().bills.find((b) => b.id === id);
    if (!bill) return null;
    bill.paid = true;
    this.save();
    return bill;
  }

  async getTasks(): Promise<FamilyTask[]> {
    return this.data().tasks;
  }

  async addTask(input: { title: string; assignee?: string; due?: string }): Promise<FamilyTask> {
    const d = this.data();
    const task: FamilyTask = { id: newId("task"), done: false, ...input };
    d.tasks.push(task);
    this.save();
    return task;
  }

  async completeTask(id: string): Promise<FamilyTask | null> {
    const task = this.data().tasks.find((t) => t.id === id);
    if (!task) return null;
    task.done = true;
    this.save();
    return task;
  }

  async getMealPlan(): Promise<MealPlanEntry[]> {
    return [...this.data().mealPlan].sort((a, b) => a.day.localeCompare(b.day));
  }

  async setMealPlanEntry(entry: MealPlanEntry): Promise<MealPlanEntry> {
    const d = this.data();
    const existing = d.mealPlan.find((m) => m.day === entry.day);
    if (existing) Object.assign(existing, entry);
    else d.mealPlan.push(entry);
    this.save();
    return entry;
  }

  async getGroceries(): Promise<GroceryItem[]> {
    return this.data().groceries;
  }

  async addGroceryItems(
    items: { name: string; quantity?: string }[],
  ): Promise<{ added: string[]; alreadyOnList: string[] }> {
    const d = this.data();
    const added: string[] = [];
    const alreadyOnList: string[] = [];
    for (const item of items) {
      const name = item.name.trim();
      if (!name) continue;
      if (d.groceries.some((g) => g.name.toLowerCase() === name.toLowerCase() && !g.done)) {
        alreadyOnList.push(name);
        continue;
      }
      d.groceries.push({ id: newId("g"), name, quantity: item.quantity, done: false });
      added.push(name);
    }
    this.save();
    return { added, alreadyOnList };
  }

  async checkOffGroceryItem(id: string, remove?: boolean): Promise<{ ok: boolean }> {
    const d = this.data();
    if (remove) {
      const before = d.groceries.length;
      d.groceries = d.groceries.filter((g) => g.id !== id);
      this.save();
      return { ok: d.groceries.length < before };
    }
    const item = d.groceries.find((g) => g.id === id);
    if (!item) return { ok: false };
    item.done = true;
    this.save();
    return { ok: true };
  }

  async listEvents(from: string, to: string): Promise<CalendarEvent[]> {
    const fromT = new Date(from).getTime();
    const toT = new Date(to).getTime();
    return this.data()
      .events.filter((e) => {
        const t = new Date(e.start).getTime();
        return t >= fromT && t <= toT;
      })
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  async createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const created: CalendarEvent = { ...event, id: newId("evt") };
    this.data().events.push(created);
    this.save();
    return created;
  }

  async updateEvent(
    id: string,
    patch: Partial<Omit<CalendarEvent, "id">>,
  ): Promise<CalendarEvent | null> {
    const evt = this.data().events.find((e) => e.id === id);
    if (!evt) return null;
    Object.assign(evt, patch);
    this.save();
    return evt;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const d = this.data();
    const before = d.events.length;
    d.events = d.events.filter((e) => e.id !== id);
    this.save();
    return d.events.length < before;
  }

  async listConversations(): Promise<Conversation[]> {
    const d = this.data();
    d.conversations ??= [];
    return d.conversations
      .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createConversation(title: string): Promise<Conversation> {
    const d = this.data();
    d.conversations ??= [];
    const now = new Date().toISOString();
    const conv = { id: newId("conv"), title, createdAt: now, updatedAt: now, messages: [] };
    d.conversations.push(conv);
    this.save();
    const { messages: _messages, ...summary } = conv;
    return summary;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const d = this.data();
    d.conversations ??= [];
    const before = d.conversations.length;
    d.conversations = d.conversations.filter((c) => c.id !== id);
    this.save();
    return d.conversations.length < before;
  }

  async getConversationMessages(conversationId: string): Promise<ChatMessage[] | null> {
    const d = this.data();
    const conv = (d.conversations ?? []).find((c) => c.id === conversationId);
    return conv ? conv.messages : null;
  }

  async appendChatMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    attachments?: NewAttachment[],
  ): Promise<ChatMessage> {
    const d = this.data();
    const conv = (d.conversations ?? []).find((c) => c.id === conversationId);
    if (!conv) throw new Error("Conversation not found");
    const messageId = newId("msg");
    const message: ChatMessage = {
      id: messageId,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    if (attachments?.length) {
      fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
      message.attachments = attachments.map((att, i) => {
        const buffer = Buffer.from(att.data, "base64");
        const storagePath = `${messageId}-${i}`;
        fs.writeFileSync(path.join(ATTACHMENTS_DIR, storagePath), buffer);
        return {
          name: att.name,
          mediaType: att.mediaType,
          size: buffer.length,
          storagePath,
        };
      });
    }
    conv.messages.push(message);
    conv.updatedAt = message.createdAt;
    this.save();
    return message;
  }

  async getAttachmentData(storagePath: string): Promise<string> {
    // storagePath is an opaque id we generated; keep reads inside the dir.
    const file = path.join(ATTACHMENTS_DIR, path.basename(storagePath));
    return fs.readFileSync(file).toString("base64");
  }

  async listRecentEmails(limit: number): Promise<EmailMessage[]> {
    return [...this.data().emails].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  async searchEmails(query: string): Promise<EmailMessage[]> {
    const q = query.toLowerCase();
    return this.data().emails.filter(
      (m) =>
        m.from.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q),
    );
  }

  async markEmailRead(id: string): Promise<boolean> {
    const msg = this.data().emails.find((m) => m.id === id);
    if (!msg) return false;
    msg.read = true;
    this.save();
    return true;
  }

  async recordSentEmail(to: string, subject: string, body: string): Promise<{ id: string }> {
    const id = newId("em-out");
    this.data().emails.push({
      id,
      from: "You (sent)",
      subject: `To ${to}: ${subject}`,
      date: new Date().toISOString(),
      body,
      read: true,
    });
    this.save();
    return { id };
  }
}
