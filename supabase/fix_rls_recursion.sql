-- Fixes "infinite recursion detected in policy for relation household_members".
-- Run this once in the Supabase SQL editor on top of the existing schema.
-- Cause: the original policies checked household membership by querying
-- household_members from *within* a policy defined on household_members
-- itself, which Postgres cannot evaluate. The fix routes that check through
-- a SECURITY DEFINER function, which runs as the table owner and bypasses
-- RLS internally, breaking the recursion.

create or replace function is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = auth.uid()
  );
$$;

create or replace function shares_household_with(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members hm1
    join household_members hm2 on hm1.household_id = hm2.household_id
    where hm1.user_id = auth.uid() and hm2.user_id = p_user_id
  );
$$;

drop policy if exists "profiles_household_read" on profiles;
create policy "profiles_household_read" on profiles for select using (
  shares_household_with(id)
);

drop policy if exists "households_select" on households;
create policy "households_select" on households for select using (
  is_household_member(households.id)
);

drop policy if exists "households_update" on households;
create policy "households_update" on households for update using (
  is_household_member(households.id)
);

drop policy if exists "members_select" on household_members;
create policy "members_select" on household_members for select using (
  is_household_member(household_members.household_id)
);

drop policy if exists "stores_all" on stores;
create policy "stores_all" on stores for all using (
  is_household_member(stores.household_id)
) with check (
  is_household_member(stores.household_id)
);

drop policy if exists "lists_all" on lists;
create policy "lists_all" on lists for all using (
  is_household_member(lists.household_id)
) with check (
  is_household_member(lists.household_id)
);

drop policy if exists "items_all" on items;
create policy "items_all" on items for all using (
  is_household_member(items.household_id)
) with check (
  is_household_member(items.household_id)
);
