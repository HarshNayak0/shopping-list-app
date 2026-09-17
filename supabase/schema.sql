-- Shopping List App schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query) once.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Household',
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null default 'Shopping List',
  created_at timestamptz not null default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  quantity text,
  notes text,
  category text,
  store_id uuid references stores(id) on delete set null,
  is_checked boolean not null default false,
  price numeric(10,2),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  checked_at timestamptz
);

create index items_household_normalized_idx on items(household_id, normalized_name);
create index items_list_idx on items(list_id);

create table category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category text not null,
  monthly_limit numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (household_id, category)
);

-- ---------- New-user bootstrap ----------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Household join/create RPCs (avoid RLS chicken-and-egg) ----------

create or replace function create_household(p_name text default 'My Household')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into households (name) values (coalesce(nullif(trim(p_name), ''), 'My Household')) returning id into v_id;
  insert into household_members (household_id, user_id) values (v_id, auth.uid());
  insert into lists (household_id, name) values (v_id, 'Shopping List');
  return v_id;
end;
$$;

create or replace function join_household(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  select id into v_household_id from households where invite_code = lower(trim(p_invite_code));
  if v_household_id is null then
    raise exception 'Invalid invite code';
  end if;
  insert into household_members (household_id, user_id)
  values (v_household_id, auth.uid())
  on conflict do nothing;
  return v_household_id;
end;
$$;

-- ---------- Store suggestion ----------

create or replace function suggest_store_for_item(p_household_id uuid, p_item_name text)
returns uuid
language sql
stable
as $$
  select store_id
  from items
  where household_id = p_household_id
    and normalized_name = lower(trim(p_item_name))
    and store_id is not null
  group by store_id
  order by count(*) desc, max(created_at) desc
  limit 1;
$$;

-- ---------- Price history & budgets ----------

-- Most recent price previously paid for an item name in this household,
-- excluding one item (used when checking if a newly logged price is an
-- increase over the last time the same item was bought).
create or replace function previous_price_for_item(
  p_household_id uuid,
  p_item_name text,
  p_exclude_item_id uuid default null
)
returns numeric
language sql
stable
as $$
  select price
  from items
  where household_id = p_household_id
    and normalized_name = lower(trim(p_item_name))
    and price is not null
    and (p_exclude_item_id is null or id <> p_exclude_item_id)
  order by created_at desc
  limit 1;
$$;

-- Total spend per month per category, for the budget view. Uncategorized
-- items (category is null) are grouped under 'Uncategorized'.
create or replace function monthly_spend_by_category(p_household_id uuid)
returns table (month text, category text, total numeric)
language sql
stable
as $$
  select
    to_char(coalesce(checked_at, created_at), 'YYYY-MM') as month,
    coalesce(category, 'Uncategorized') as category,
    sum(price)::numeric as total
  from items
  where household_id = p_household_id
    and price is not null
  group by 1, 2
  order by 1 desc, 3 desc;
$$;

-- Every item in the household whose price is higher than the price
-- immediately before it for the same item name — used to badge items
-- bought for more than last time, without an N+1 query per item.
create or replace function price_increase_flags(p_household_id uuid)
returns table (item_id uuid, previous_price numeric)
language sql
stable
as $$
  select i.id as item_id, prev.prev_price as previous_price
  from items i
  cross join lateral (
    select i2.price as prev_price
    from items i2
    where i2.household_id = p_household_id
      and i2.normalized_name = i.normalized_name
      and i2.price is not null
      and i2.id <> i.id
      and i2.created_at < i.created_at
    order by i2.created_at desc
    limit 1
  ) prev
  where i.household_id = p_household_id
    and i.price is not null
    and i.price > prev.prev_price;
$$;

-- ---------- Performance: single-round-trip page bundles ----------

-- Bundles everything the list page needs (list, household, sibling lists,
-- stores, items, member profiles) into one call instead of ~5 sequential
-- queries. Authorization is checked manually since the function runs as
-- SECURITY DEFINER (needed so it can read household_members without
-- recursing through its own RLS policy).
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

-- ---------- Row Level Security ----------

alter table profiles enable row level security;
alter table households enable row level security;
alter table household_members enable row level security;
alter table stores enable row level security;
alter table lists enable row level security;
alter table items enable row level security;

-- Membership checks are routed through SECURITY DEFINER functions rather
-- than a direct EXISTS subquery on household_members inside a policy
-- defined on household_members itself — the latter causes Postgres to
-- raise "infinite recursion detected in policy for relation
-- household_members", since evaluating the policy would require
-- re-evaluating the same policy on the subquery, forever. A SECURITY
-- DEFINER function runs as the table owner, which bypasses RLS
-- internally, so the membership check terminates normally.

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

create policy "profiles_self_all" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_household_read" on profiles for select using (
  shares_household_with(id)
);

create policy "households_select" on households for select using (
  is_household_member(households.id)
);

create policy "households_update" on households for update using (
  is_household_member(households.id)
);

create policy "members_select" on household_members for select using (
  is_household_member(household_members.household_id)
);

create policy "stores_all" on stores for all using (
  is_household_member(stores.household_id)
) with check (
  is_household_member(stores.household_id)
);

create policy "lists_all" on lists for all using (
  is_household_member(lists.household_id)
) with check (
  is_household_member(lists.household_id)
);

create policy "items_all" on items for all using (
  is_household_member(items.household_id)
) with check (
  is_household_member(items.household_id)
);

alter table category_budgets enable row level security;

create policy "category_budgets_all" on category_budgets for all using (
  is_household_member(category_budgets.household_id)
) with check (
  is_household_member(category_budgets.household_id)
);

-- ---------- Realtime ----------

-- REPLICA IDENTITY FULL is required so a DELETE's old-row data includes
-- every column (not just the primary key) — Realtime needs the full row
-- to evaluate each subscriber's RLS policy before broadcasting the delete.
alter table stores replica identity full;
alter table items replica identity full;
alter table lists replica identity full;
alter table household_members replica identity full;
alter table category_budgets replica identity full;

alter publication supabase_realtime add table items, stores, lists, household_members, category_budgets;
