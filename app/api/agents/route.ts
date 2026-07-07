import { PARENT_ONLY_TOOL_NAMES, SPECIALISTS } from "@/lib/agents/definitions";
import { TOOL_REGISTRY } from "@/lib/agents/tools";
import { getViewer } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITS = { label: 40, charter: 200, system: 4000, tools: 15 };

export async function GET(): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Pick a profile first" }, { status: 401 });
  if (viewer.role !== "parent") {
    return Response.json({ error: "Managing agents is a parent thing — ask a parent!" }, { status: 403 });
  }
  const store = getStore();
  const [custom, household] = await Promise.all([store.listCustomAgents(), store.getHousehold()]);
  return Response.json({
    builtIn: SPECIALISTS.map((s) => ({
      key: s.key,
      label: s.label,
      charter: s.charter,
      tools: s.tools.map((t) => t.name),
    })),
    custom,
    members: household.members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    toolCatalog: Object.values(TOOL_REGISTRY).map((t) => ({
      name: t.name,
      description: t.description,
      mutates: Boolean(t.mutates),
      parentOnly: PARENT_ONLY_TOOL_NAMES.has(t.name),
    })),
  });
}

interface UpsertBody {
  id?: string;
  label?: string;
  charter?: string;
  system?: string;
  tools?: string[];
  memberIds?: string[] | null;
  enabled?: boolean;
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "agent"
  );
}

export async function POST(req: Request): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Pick a profile first" }, { status: 401 });
  if (viewer.role !== "parent") {
    return Response.json({ error: "Only parents can manage agents" }, { status: 403 });
  }

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const label = String(body.label ?? "").trim();
  const charter = String(body.charter ?? "").trim();
  const system = String(body.system ?? "").trim();
  const tools = Array.isArray(body.tools) ? body.tools.map(String) : [];
  const enabled = body.enabled !== false;

  if (!label || label.length > LIMITS.label) {
    return Response.json({ error: `Name is required (max ${LIMITS.label} chars)` }, { status: 400 });
  }
  if (!charter || charter.length > LIMITS.charter) {
    return Response.json(
      { error: `"What they handle" is required (max ${LIMITS.charter} chars)` },
      { status: 400 },
    );
  }
  if (!system || system.length > LIMITS.system) {
    return Response.json(
      { error: `Instructions are required (max ${LIMITS.system} chars)` },
      { status: 400 },
    );
  }
  const unknown = tools.filter((t) => !TOOL_REGISTRY[t]);
  if (unknown.length > 0) {
    return Response.json({ error: `Unknown tools: ${unknown.join(", ")}` }, { status: 400 });
  }
  if (tools.length === 0 || tools.length > LIMITS.tools) {
    return Response.json(
      { error: `Pick between 1 and ${LIMITS.tools} tools` },
      { status: 400 },
    );
  }

  const store = getStore();

  // Validate member assignment (null = whole family).
  let memberIds: string[] | null = null;
  if (Array.isArray(body.memberIds) && body.memberIds.length > 0) {
    const validIds = new Set((await store.getHousehold()).members.map((m) => m.id));
    memberIds = body.memberIds.map(String);
    const bad = memberIds.filter((id) => !validIds.has(id));
    if (bad.length > 0) {
      return Response.json({ error: `Unknown members: ${bad.join(", ")}` }, { status: 400 });
    }
  }

  // New agents need a delegation key that's unique across built-ins + customs.
  let key = "";
  if (!body.id) {
    const taken = new Set<string>([
      ...SPECIALISTS.map((s) => s.key),
      ...(await store.listCustomAgents()).map((a) => a.key),
    ]);
    key = slugify(label);
    let n = 2;
    while (taken.has(key)) key = `${slugify(label)}-${n++}`;
  }

  try {
    const agent = await store.upsertCustomAgent({
      id: body.id ? String(body.id) : undefined,
      key,
      label,
      charter,
      system,
      tools,
      memberIds,
      enabled,
    });
    return Response.json({ agent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return Response.json({ error: message }, { status: message === "Agent not found" ? 404 : 500 });
  }
}
