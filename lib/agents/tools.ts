import { getCalendarProvider, getEmailProvider } from "@/lib/providers";
import { getStore } from "@/lib/store";

/**
 * Tools the agents can call. Each tool returns a string (usually JSON) that
 * goes back to the model as the tool_result.
 */
export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** True if the tool changes state the dashboard displays. */
  mutates?: boolean;
  run(input: Record<string, unknown>): Promise<string>;
}

const j = (v: unknown) => JSON.stringify(v, null, 1);

// ---------------------------------------------------------------- shared

export const getFamilyOverview: AgentTool = {
  name: "get_family_overview",
  description:
    "Get the family roster (names, ages, roles, important notes like allergies and schedules). Call this when you need to know who is in the family or their constraints.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  async run() {
    return j(await getStore().getHousehold());
  },
};

// ---------------------------------------------------------------- calendar

export const listCalendarEvents: AgentTool = {
  name: "list_calendar_events",
  description:
    "List family calendar events between two ISO datetimes. Call this before scheduling anything to check for conflicts, and whenever asked about the family's schedule.",
  input_schema: {
    type: "object",
    properties: {
      from: { type: "string", description: "ISO 8601 start of range, e.g. 2026-07-02T00:00:00Z" },
      to: { type: "string", description: "ISO 8601 end of range" },
    },
    required: ["from", "to"],
    additionalProperties: false,
  },
  async run(input) {
    return j(await getCalendarProvider().listEvents(String(input.from), String(input.to)));
  },
};

export const createCalendarEvent: AgentTool = {
  name: "create_calendar_event",
  description:
    "Add an event to the family calendar. Check for conflicts with list_calendar_events first.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      start: { type: "string", description: "ISO 8601 datetime" },
      end: { type: "string", description: "ISO 8601 datetime" },
      location: { type: "string" },
      attendees: { type: "array", items: { type: "string" }, description: "Family member names" },
      description: { type: "string" },
    },
    required: ["title", "start", "end"],
    additionalProperties: false,
  },
  async run(input) {
    const created = await getCalendarProvider().createEvent({
      title: String(input.title),
      start: String(input.start),
      end: String(input.end),
      location: input.location ? String(input.location) : undefined,
      attendees: Array.isArray(input.attendees) ? input.attendees.map(String) : undefined,
      description: input.description ? String(input.description) : undefined,
    });
    return j({ created });
  },
};

export const deleteCalendarEvent: AgentTool = {
  name: "delete_calendar_event",
  description: "Remove an event from the family calendar by its id.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  },
  async run(input) {
    return j({ deleted: await getCalendarProvider().deleteEvent(String(input.id)) });
  },
};

// ---------------------------------------------------------------- email

export const listRecentEmails: AgentTool = {
  name: "list_recent_emails",
  description:
    "List the most recent emails in the family inbox (school newsletters, bills, invitations, activity updates). Use this to catch up on what needs attention.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "integer", description: "Max messages to return (default 10)" },
    },
    additionalProperties: false,
  },
  async run(input) {
    const limit = typeof input.limit === "number" ? input.limit : 10;
    return j(await getEmailProvider().listRecent(limit));
  },
};

export const searchEmails: AgentTool = {
  name: "search_emails",
  description: "Search the family inbox by keyword (matches sender, subject, and body).",
  input_schema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
    additionalProperties: false,
  },
  async run(input) {
    return j(await getEmailProvider().search(String(input.query)));
  },
};

export const sendEmail: AgentTool = {
  name: "send_email",
  description:
    "Send an email on the family's behalf (e.g. an RSVP or a reply to a coach). Only send after the user has confirmed the content, or when they explicitly asked you to send it.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      to: { type: "string" },
      subject: { type: "string" },
      body: { type: "string" },
    },
    required: ["to", "subject", "body"],
    additionalProperties: false,
  },
  async run(input) {
    const res = await getEmailProvider().sendEmail(
      String(input.to),
      String(input.subject),
      String(input.body),
    );
    return j({ sent: true, id: res.id });
  },
};

// ---------------------------------------------------------------- finance

export const getBudget: AgentTool = {
  name: "get_budget",
  description: "Get all budget categories with monthly budget and month-to-date spend.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  async run() {
    return j(await getStore().getBudget());
  },
};

export const getTransactions: AgentTool = {
  name: "get_transactions",
  description: "List recent transactions (date, description, amount, category).",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  async run() {
    return j(await getStore().getTransactions());
  },
};

export const addTransaction: AgentTool = {
  name: "add_transaction",
  description:
    "Record a new expense. Also updates the matching budget category's month-to-date spend.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string" },
      amount: { type: "number" },
      category: { type: "string", description: "Must match an existing budget category name" },
      date: { type: "string", description: "ISO date; defaults to today" },
    },
    required: ["description", "amount", "category"],
    additionalProperties: false,
  },
  async run(input) {
    const result = await getStore().addTransaction({
      description: String(input.description),
      amount: Number(input.amount),
      category: String(input.category),
      date: input.date ? String(input.date) : undefined,
    });
    return j(result);
  },
};

export const setBudgetCategory: AgentTool = {
  name: "set_budget_category",
  description: "Create a budget category or change an existing category's monthly budget.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      monthlyBudget: { type: "number" },
    },
    required: ["name", "monthlyBudget"],
    additionalProperties: false,
  },
  async run(input) {
    const category = await getStore().setBudgetCategory(
      String(input.name),
      Number(input.monthlyBudget),
    );
    return j({ category });
  },
};

export const getUpcomingBills: AgentTool = {
  name: "get_upcoming_bills",
  description: "List bills with amount, due date, autopay status, and whether they're paid.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  async run() {
    return j(await getStore().getBills());
  },
};

export const markBillPaid: AgentTool = {
  name: "mark_bill_paid",
  description: "Mark a bill as paid by its id.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  },
  async run(input) {
    const bill = await getStore().markBillPaid(String(input.id));
    return j(bill ? { bill } : { error: "Bill not found" });
  },
};

// ---------------------------------------------------------------- tasks

export const listTasks: AgentTool = {
  name: "list_tasks",
  description: "List the family to-do list (title, assignee, due date, done).",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  async run() {
    return j(await getStore().getTasks());
  },
};

export const addTask: AgentTool = {
  name: "add_task",
  description: "Add a to-do to the family task list.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      assignee: { type: "string", description: "Family member name" },
      due: { type: "string", description: "ISO date" },
    },
    required: ["title"],
    additionalProperties: false,
  },
  async run(input) {
    const task = await getStore().addTask({
      title: String(input.title),
      assignee: input.assignee ? String(input.assignee) : undefined,
      due: input.due ? String(input.due) : undefined,
    });
    return j({ added: task });
  },
};

export const completeTask: AgentTool = {
  name: "complete_task",
  description: "Mark a task done by its id.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  },
  async run(input) {
    const task = await getStore().completeTask(String(input.id));
    return j(task ? { task } : { error: "Task not found" });
  },
};

// ---------------------------------------------------------------- food

export const getMealPlan: AgentTool = {
  name: "get_meal_plan",
  description: "Get the current dinner plan (one entry per day).",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  async run() {
    return j(await getStore().getMealPlan());
  },
};

export const setMealPlanEntry: AgentTool = {
  name: "set_meal_plan_entry",
  description:
    "Set (or replace) the dinner for a given day. Respect family food constraints from get_family_overview (allergies, picky eaters).",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      day: { type: "string", description: "ISO date, e.g. 2026-07-04" },
      dinner: { type: "string" },
      notes: { type: "string" },
    },
    required: ["day", "dinner"],
    additionalProperties: false,
  },
  async run(input) {
    const entry = await getStore().setMealPlanEntry({
      day: String(input.day),
      dinner: String(input.dinner),
      notes: input.notes ? String(input.notes) : undefined,
    });
    return j({ entry });
  },
};

export const getGroceryList: AgentTool = {
  name: "get_grocery_list",
  description: "Get the shared grocery list.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  async run() {
    return j(await getStore().getGroceries());
  },
};

export const addGroceryItems: AgentTool = {
  name: "add_grocery_items",
  description: "Add one or more items to the grocery list. Skips items already on the list.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "string" },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
  async run(input) {
    const items = (Array.isArray(input.items) ? input.items : [])
      .map((raw) => {
        const item = raw as { name?: unknown; quantity?: unknown };
        return {
          name: String(item.name ?? ""),
          quantity: item.quantity ? String(item.quantity) : undefined,
        };
      })
      .filter((i) => i.name.trim().length > 0);
    return j(await getStore().addGroceryItems(items));
  },
};

export const checkOffGroceryItem: AgentTool = {
  name: "check_off_grocery_item",
  description: "Mark a grocery item as bought (done) by its id, or remove it entirely.",
  mutates: true,
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string" },
      remove: { type: "boolean", description: "If true, delete the item instead of checking it off" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  async run(input) {
    const result = await getStore().checkOffGroceryItem(String(input.id), Boolean(input.remove));
    return j(result.ok ? result : { ...result, error: "Item not found" });
  },
};
