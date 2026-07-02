import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
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
  const { id } = await params;
  const deleted = await getStore().deleteConversation(id);
  return Response.json({ deleted });
}
