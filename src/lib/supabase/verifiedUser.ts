import { headers } from "next/headers";

// Reads the user id middleware already verified via getUser() for this
// request (see lib/supabase/middleware.ts). Server Components can trust
// this instead of re-verifying with another round trip to Supabase Auth.
export async function getVerifiedUserId(): Promise<string | null> {
  const h = await headers();
  return h.get("x-verified-user-id");
}
