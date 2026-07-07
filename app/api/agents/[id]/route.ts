import { getViewer } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Pick a profile first" }, { status: 401 });
  if (viewer.role !== "parent") {
    return Response.json({ error: "Only parents can manage agents" }, { status: 403 });
  }
  const { id } = await params;
  const deleted = await getStore().deleteCustomAgent(id);
  return Response.json({ deleted });
}
