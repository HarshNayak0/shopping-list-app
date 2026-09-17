import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/supabase/verifiedUser";
import BudgetView from "@/components/BudgetView";
import type { Household, List } from "@/types/database";

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  const supabase = await createClient();

  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");

  const { data: bundle, error } = await supabase.rpc("get_list_bundle", {
    p_list_id: listId,
  });
  if (error || !bundle) redirect("/");

  const { list, household } = bundle as { list: List; household: Household };

  return <BudgetView household={household} list={list} />;
}
