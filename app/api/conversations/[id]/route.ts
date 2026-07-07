import { getViewer, type Viewer } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function canAccess(viewer: Viewer, conversationId: string): Promise<boolean> {
  if (viewer.role === "parent") return true;
  const conv = (await getStore().listConversations()).find((c) => c.id === conversationId);
  return Boolean(conv && conv.memberId === viewer.memberId);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Pick a profile first" }, { status: 401 });
  const { id } = await params;
  if (!(await canAccess(viewer, id))) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }
  const messages = await getStore().getConversationMessages(id);
  if (messages === null) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }
  return Response.json(messages);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Pick a profile first" }, { status: 401 });
  const { id } = await params;
  if (!(await canAccess(viewer, id))) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }
  const deleted = await getStore().deleteConversation(id);
  return Response.json({ deleted });
}
