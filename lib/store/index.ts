import type { FamilyStore } from "./types";
import { LocalJsonStore } from "./local";
import { SupabaseStore } from "./supabase";

export type { FamilyStore } from "./types";
export { newId } from "./types";

/**
 * Store selection:
 *  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set → Supabase (use this on
 *    Vercel and any serverless host; the local JSON file is ephemeral there).
 *  - otherwise → local JSON file (zero-setup dev mode).
 */
const globalForStore = globalThis as unknown as { __familyHqStore?: FamilyStore };

export function getStore(): FamilyStore {
  if (!globalForStore.__familyHqStore) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    globalForStore.__familyHqStore =
      url && key ? new SupabaseStore(url, key) : new LocalJsonStore();
  }
  return globalForStore.__familyHqStore;
}
