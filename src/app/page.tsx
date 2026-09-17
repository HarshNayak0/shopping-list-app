import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/supabase/verifiedUser";

export default async function Home() {
  const supabase = await createClient();
  const userId = await getVerifiedUserId();

  if (!userId) redirect("/login");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const { data: list } = await supabase
    .from("lists")
    .select("id")
    .eq("household_id", membership.household_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!list) redirect("/onboarding");

  redirect(`/lists/${list.id}`);
}
