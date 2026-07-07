import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@/lib/store";
import type { AgentTool } from "./tools";
import {
  CHIEF_TOOLS,
  PARENT_ONLY_TOOL_NAMES,
  SPECIALISTS,
  buildCustomSpecialist,
  chiefOfStaffSystem,
  type SpecialistAgent,
  type ViewerContext,
} from "./definitions";

/**
 * Multi-agent orchestration.
 *
 * The Chief of Staff runs the top-level agentic loop (streamed). One of its
 * tools is delegate_to_specialist, which runs a nested agentic loop with the
 * chosen specialist (Finance / Activities / Food), each with its own system
 * prompt and tool set. Specialists are stateless per delegation — the Chief
 * writes them a self-contained brief.
 */

export const MODEL = process.env.FAMILY_HQ_MODEL ?? "claude-opus-4-8";

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "status"; agent: string; message: string }
  | { type: "dashboard_dirty" }
  | { type: "done" }
  | { type: "error"; message: string };

export type Emit = (event: AgentEvent) => void;

const MAX_CHIEF_TURNS = 12;
const MAX_SPECIALIST_TURNS = 8;

function toApiTools(tools: AgentTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));
}

function humanizeToolCall(name: string): string {
  return name.replaceAll("_", " ");
}

async function runTool(
  tools: AgentTool[],
  name: string,
  input: Record<string, unknown>,
  agentLabel: string,
  emit: Emit,
): Promise<{ content: string; isError: boolean }> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { content: `Unknown tool: ${name}`, isError: true };
  }
  emit({ type: "status", agent: agentLabel, message: humanizeToolCall(name) });
  try {
    const content = await tool.run(input);
    if (tool.mutates) emit({ type: "dashboard_dirty" });
    return { content, isError: false };
  } catch (err) {
    return { content: `Tool failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}

/** Run a specialist's full agentic loop for one delegated task; returns its final report. */
async function runSpecialist(
  client: Anthropic,
  specialist: SpecialistAgent,
  task: string,
  emit: Emit,
): Promise<string> {
  emit({ type: "status", agent: specialist.label, message: "picking up the task" });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];
  const apiTools = toApiTools(specialist.tools);

  for (let turn = 0; turn < MAX_SPECIALIST_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: specialist.system,
      tools: apiTools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      emit({ type: "status", agent: specialist.label, message: "done" });
      return text || "(no report)";
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const { content, isError } = await runTool(
        specialist.tools,
        block.name,
        block.input as Record<string, unknown>,
        specialist.label,
        emit,
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content,
        is_error: isError || undefined,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return "(specialist hit its step limit before finishing — partial work may have been done)";
}

function delegateToolDefinition(specialists: SpecialistAgent[]): Anthropic.Tool {
  return {
    name: "delegate_to_specialist",
    description:
      "Hand a task to one of your specialist agents and get back their report. The specialist does not see this conversation — write a self-contained brief with all relevant facts, dates, names, and constraints. You may call this multiple times in one turn to run specialists in parallel.",
    input_schema: {
      type: "object",
      properties: {
        specialist: {
          type: "string",
          enum: specialists.map((s) => s.key),
          description: specialists.map((s) => `${s.key}: ${s.charter}`).join(" | "),
        },
        task: {
          type: "string",
          description: "Self-contained brief for the specialist.",
        },
      },
      required: ["specialist", "task"],
      additionalProperties: false,
    },
  };
}

/**
 * Run one Chief-of-Staff turn over the given conversation history for the
 * given family member, streaming text and activity events via emit.
 *
 * Role enforcement happens here, not just in the prompt: children's requests
 * run with parent-only tools removed and a roster that excludes the Finance
 * Manager and agents not assigned to them.
 */
export async function runChiefOfStaff(
  history: Anthropic.MessageParam[],
  emit: Emit,
  viewer: ViewerContext,
): Promise<void> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [...history];
  const isChild = viewer.role === "child";

  // Roster = built-in specialists + enabled UI-created agents (with at least
  // one resolvable tool), loaded fresh each turn so new agents work instantly.
  const [profile, customAgents] = await Promise.all([
    getStore().getHousehold(),
    getStore().listCustomAgents(),
  ]);
  const specialists: SpecialistAgent[] = [
    ...SPECIALISTS.filter((s) => !isChild || s.key !== "finance"),
    ...customAgents
      .filter((a) => a.enabled)
      // Children only get family-wide agents or ones assigned to them;
      // parents see everything.
      .filter((a) => !isChild || !a.memberIds || a.memberIds.includes(viewer.memberId))
      .map((a) => buildCustomSpecialist(a, viewer.role))
      .filter((s) => s.tools.length > 0),
  ];

  const chiefTools = isChild
    ? CHIEF_TOOLS.filter((t) => !PARENT_ONLY_TOOL_NAMES.has(t.name))
    : CHIEF_TOOLS;
  const apiTools: Anthropic.Tool[] = [...toApiTools(chiefTools), delegateToolDefinition(specialists)];
  const system = chiefOfStaffSystem(profile, specialists, viewer);

  for (let turn = 0; turn < MAX_CHIEF_TURNS; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      tools: apiTools,
      messages,
    });

    stream.on("text", (delta) => emit({ type: "text", text: delta }));

    const response = await stream.finalMessage();
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") {
      emit({ type: "done" });
      return;
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    // Run all tool calls from this turn concurrently (delegations included),
    // then return every result in a single user message.
    const results = await Promise.all(
      toolUses.map(async (block): Promise<Anthropic.ToolResultBlockParam> => {
        if (block.name === "delegate_to_specialist") {
          const input = block.input as { specialist?: string; task?: string };
          const specialist = specialists.find((s) => s.key === input.specialist);
          if (!specialist || !input.task) {
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: `Invalid delegation. Valid specialists: ${specialists.map((s) => s.key).join(", ")}`,
              is_error: true,
            };
          }
          emit({
            type: "status",
            agent: "Chief of Staff",
            message: `delegating to ${specialist.label}`,
          });
          try {
            const report = await runSpecialist(client, specialist, input.task, emit);
            return { type: "tool_result", tool_use_id: block.id, content: report };
          } catch (err) {
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: `Specialist failed: ${err instanceof Error ? err.message : String(err)}`,
              is_error: true,
            };
          }
        }
        const { content, isError } = await runTool(
          chiefTools,
          block.name,
          block.input as Record<string, unknown>,
          "Chief of Staff",
          emit,
        );
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content,
          is_error: isError || undefined,
        };
      }),
    );

    messages.push({ role: "user", content: results });
  }

  emit({
    type: "text",
    text: "\n\n_I hit my step limit for this request — ask me to continue if something looks unfinished._",
  });
  emit({ type: "done" });
}
