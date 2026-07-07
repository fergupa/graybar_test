import { clearViewerCookie, getViewer, setViewerCookie, verifyPin } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current session + the profile picker list. */
export async function GET(): Promise<Response> {
  const [viewer, profiles] = await Promise.all([getViewer(), getStore().getAuthProfiles()]);
  return Response.json({ session: viewer, profiles });
}

/** Log in as a family member (PIN required if that member has one set). */
export async function POST(req: Request): Promise<Response> {
  let body: { memberId?: string; pin?: string };
  try {
    body = (await req.json()) as { memberId?: string; pin?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const store = getStore();
  const profiles = await store.getAuthProfiles();

  // Recovery path: a household with no members (mid-onboarding wipe, or a
  // fresh reset) can still be entered as a parent to finish setup.
  if (profiles.length === 0 && body.memberId === "setup-parent") {
    const viewer = { memberId: "setup-parent", name: "Parent", role: "parent" as const };
    await setViewerCookie(viewer);
    return Response.json({ session: viewer });
  }

  const profile = profiles.find((p) => p.id === String(body.memberId ?? ""));
  if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

  if (profile.hasPin) {
    const pinHash = await store.getMemberPinHash(profile.id);
    if (!pinHash || !body.pin || !verifyPin(String(body.pin), pinHash)) {
      return Response.json({ error: "Wrong PIN" }, { status: 401 });
    }
  }

  const viewer = { memberId: profile.id, name: profile.name, role: profile.role };
  await setViewerCookie(viewer);
  return Response.json({ session: viewer });
}

/** Log out (back to the profile picker). */
export async function DELETE(): Promise<Response> {
  await clearViewerCookie();
  return Response.json({ ok: true });
}
