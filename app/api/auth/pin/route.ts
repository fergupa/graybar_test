import { getViewer, hashPin } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Set or clear a PIN. Members manage their own PIN; parents can also manage
 * anyone's (e.g. help a child, or reset a forgotten one).
 */
export async function POST(req: Request): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Not signed in" }, { status: 401 });

  let body: { memberId?: string; pin?: string | null };
  try {
    body = (await req.json()) as { memberId?: string; pin?: string | null };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetId = body.memberId ? String(body.memberId) : viewer.memberId;
  if (targetId !== viewer.memberId && viewer.role !== "parent") {
    return Response.json({ error: "Only parents can change someone else's PIN" }, { status: 403 });
  }

  let pinHash: string | null = null;
  if (body.pin != null && String(body.pin).length > 0) {
    const pin = String(body.pin);
    if (!/^\d{4,8}$/.test(pin)) {
      return Response.json({ error: "PIN must be 4-8 digits" }, { status: 400 });
    }
    pinHash = hashPin(pin);
  }

  const ok = await getStore().setMemberPin(targetId, pinHash);
  if (!ok) return Response.json({ error: "Member not found" }, { status: 404 });
  return Response.json({ ok: true, hasPin: pinHash !== null });
}
