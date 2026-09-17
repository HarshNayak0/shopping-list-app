-- Adds monthly category budgets and price-history lookups.
-- Run this once in the Supabase SQL editor.

create table category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category text not null,
  monthly_limit numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (household_id, category)
);

alter table category_budgets enable row level security;
alter table category_budgets replica identity full;

create policy "category_budgets_all" on category_budgets for all using (
  is_household_member(category_budgets.household_id)
) with check (
  is_household_member(category_budgets.household_id)
);

alter publication supabase_realtime add table category_budgets;

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
