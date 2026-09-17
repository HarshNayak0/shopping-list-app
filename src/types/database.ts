export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
};

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type Store = {
  id: string;
  household_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
};

export type List = {
  id: string;
  household_id: string;
  name: string;
  created_at: string;
};

export type Item = {
  id: string;
  list_id: string;
  household_id: string;
  name: string;
  normalized_name: string;
  quantity: string | null;
  notes: string | null;
  category: string | null;
  store_id: string | null;
  is_checked: boolean;
  price: number | null;
  created_by: string | null;
  created_at: string;
  checked_at: string | null;
};

export type CategoryBudget = {
  id: string;
  household_id: string;
  category: string;
  monthly_limit: number;
  created_at: string;
};

export type MonthlyCategorySpend = {
  month: string;
  category: string;
  total: number;
};
