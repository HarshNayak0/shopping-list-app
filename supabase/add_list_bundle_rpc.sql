-- Bundles everything the list page needs into a single round trip instead
-- of ~5 sequential queries (list, household, stores, items, profiles).
-- Run this once in the Supabase SQL editor.

create or replace function get_list_bundle(p_list_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_result jsonb;
begin
  select household_id into v_household_id from lists where id = p_list_id;

  if v_household_id is null or not is_household_member(v_household_id) then
    return null;
  end if;

  select jsonb_build_object(
    'list', to_jsonb(l),
    'household', to_jsonb(h),
    'lists', (
      select coalesce(jsonb_agg(l2 order by l2.created_at), '[]'::jsonb)
      from lists l2
      where l2.household_id = v_household_id
    ),
    'stores', (
      select coalesce(jsonb_agg(s order by s.sort_order), '[]'::jsonb)
      from stores s
      where s.household_id = v_household_id
    ),
    'items', (
      select coalesce(jsonb_agg(i order by i.created_at), '[]'::jsonb)
      from items i
      where i.list_id = p_list_id
    ),
    'profiles', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name)), '[]'::jsonb)
      from profiles p
      where p.id in (
        select hm.user_id from household_members hm where hm.household_id = v_household_id
      )
    )
  )
  into v_result
  from lists l
  join households h on h.id = l.household_id
  where l.id = p_list_id;

  return v_result;
end;
$$;
