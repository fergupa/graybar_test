import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Family-grade auth: a profile picker with optional PINs, carried in a signed
 * HTTP-only cookie. This protects kids from stumbling into parent-only data
 * (finances, inbox, agent management) — it is NOT internet-grade account
 * security. The upgrade path is Supabase Auth + RLS; all enforcement already
 * flows through getViewer(), so that swap is contained.
 */

export interface Viewer {
  memberId: string;
  name: string;
  role: "parent" | "child";
}

const COOKIE_NAME = "fhq_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  // Prefer an explicit secret; fall back to existing server secrets so the
  // app works without extra config (sessions reset if those rotate).
  return (
    process.env.SESSION_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    "family-hq-dev-secret"
  );
}

function hmac(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function signViewer(viewer: Viewer): string {
  const payload = Buffer.from(JSON.stringify(viewer)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function verifyToken(token: string): Viewer | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const viewer = JSON.parse(Buffer.from(payload, "base64url").toString()) as Viewer;
    if (!viewer.memberId || (viewer.role !== "parent" && viewer.role !== "child")) return null;
    return viewer;
  } catch {
    return null;
  }
}

export async function getViewer(): Promise<Viewer | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

export async function setViewerCookie(viewer: Viewer): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, signViewer(viewer), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearViewerCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// ---------------------------------------------------------------- PINs

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(pin, salt, 32).toString("hex");
  const a = Buffer.from(candidate);
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
