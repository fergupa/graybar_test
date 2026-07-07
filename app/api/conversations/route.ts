import { getViewer } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Pick a profile first" }, { status: 401 });
  const all = await getStore().listConversations();
  // Parents see the whole household's chats; children only their own.
  const visible =
    viewer.role === "parent" ? all : all.filter((c) => c.memberId === viewer.memberId);
  return Response.json(visible);
}
