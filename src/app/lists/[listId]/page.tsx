import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/supabase/verifiedUser";
import ShoppingListView from "@/components/ShoppingListView";
import type { Household, Item, List, Store } from "@/types/database";

type ListBundle = {
  list: List;
  household: Household;
  lists: List[];
  stores: Store[];
  items: Item[];
  profiles: { id: string; display_name: string }[];
};

export default async function ListPage({
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

  const { list, household, lists, stores, items, profiles } = bundle as ListBundle;

  return (
    <ShoppingListView
      currentUserId={userId}
      household={household}
      list={list}
      allLists={lists}
      initialStores={stores}
      initialItems={items}
      profiles={profiles}
    />
  );
}
