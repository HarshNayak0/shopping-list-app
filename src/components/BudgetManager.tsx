"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryBudget } from "@/types/database";
import Modal from "./Modal";

export default function BudgetManager({
  householdId,
  budgets,
  categories,
  onClose,
}: {
  householdId: string;
  budgets: CategoryBudget[];
  categories: string[];
  onClose: () => void;
}) {
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function addBudget(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(limit);
    if (!category.trim() || !Number.isFinite(value)) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.from("category_budgets").upsert(
      {
        household_id: householdId,
        category: category.trim(),
        monthly_limit: value,
      },
      { onConflict: "household_id,category" }
    );
    if (error) setError(error.message);
    setCategory("");
    setLimit("");
    setBusy(false);
  }

  async function deleteBudget(id: string) {
    const { error } = await supabase.from("category_budgets").delete().eq("id", id);
    if (error) setError(error.message);
  }

  return (
    <Modal title="Monthly budgets" onClose={onClose}>
      <ul className="max-h-64 space-y-1.5 overflow-y-auto">
        {budgets.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
          >
            <span className="flex-1 truncate text-sm text-neutral-800 dark:text-neutral-100">
              {b.category}
            </span>
            <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
              ${b.monthly_limit.toFixed(2)}/mo
            </span>
            <button
              onClick={() => deleteBudget(b.id)}
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-red-500 transition-all duration-150 hover:bg-red-500/10 active:scale-95"
            >
              Delete
            </button>
          </li>
        ))}
        {budgets.length === 0 && (
          <p className="py-4 text-center text-sm text-neutral-400">No budgets set yet.</p>
        )}
      </ul>

      <form onSubmit={addBudget} className="space-y-3 border-t border-black/5 pt-4 dark:border-white/10">
        <div className="flex gap-2">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            list="budget-category-options"
            className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-black/[0.03] px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-all duration-150 placeholder:text-neutral-400 focus:border-neutral-900/20 focus:bg-white focus:ring-4 focus:ring-neutral-900/5 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50 dark:focus:border-white/25 dark:focus:bg-white/10"
          />
          <datalist id="budget-category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="$/mo"
            inputMode="decimal"
            className="w-24 shrink-0 rounded-2xl border border-black/10 bg-black/[0.03] px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-all duration-150 placeholder:text-neutral-400 focus:border-neutral-900/20 focus:bg-white focus:ring-4 focus:ring-neutral-900/5 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50 dark:focus:border-white/25 dark:focus:bg-white/10"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Save budget
        </button>
        {error && <p className="animate-fade-in text-center text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
