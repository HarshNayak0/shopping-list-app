"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applyRealtimeListChange } from "@/lib/realtimeSync";
import type { CategoryBudget, Household, List, MonthlyCategorySpend } from "@/types/database";
import BudgetManager from "./BudgetManager";
import { ChevronDownIcon } from "./icons";

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function barColor(pct: number) {
  if (pct >= 1) return "bg-red-500";
  if (pct >= 0.8) return "bg-amber-500";
  return "bg-neutral-900 dark:bg-white";
}

export default function BudgetView({ household, list }: { household: Household; list: List }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [spend, setSpend] = useState<MonthlyCategorySpend[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: spendData }, { data: budgetData }] = await Promise.all([
        supabase.rpc("monthly_spend_by_category", { p_household_id: household.id }),
        supabase.from("category_budgets").select("*").eq("household_id", household.id),
      ]);
      setSpend((spendData ?? []) as MonthlyCategorySpend[]);
      setBudgets((budgetData ?? []) as CategoryBudget[]);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`budgets-${household.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "category_budgets",
          filter: `household_id=eq.${household.id}`,
        },
        applyRealtimeListChange<CategoryBudget>(setBudgets)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, household.id]);

  const categories = useMemo(
    () => [...new Set(spend.map((s) => s.category))].sort(),
    [spend]
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, { category: string; total: number }[]>();
    for (const row of spend) {
      if (!map.has(row.month)) map.set(row.month, []);
      map.get(row.month)!.push({ category: row.category, total: row.total });
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [spend]);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthRows = byMonth.find(([m]) => m === currentMonthKey)?.[1] ?? [];
  const currentTotal = currentMonthRows.reduce((s, r) => s + r.total, 0);
  const spendByCategory = new Map(currentMonthRows.map((r) => [r.category, r.total]));

  const pastMonths = byMonth.filter(([m]) => m !== currentMonthKey);

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-black/40">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/lists/${list.id}`)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-all duration-150 hover:bg-black/5 active:scale-90 dark:text-neutral-400 dark:hover:bg-white/10"
              aria-label="Back to list"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path
                  d="M12.5 5L7.5 10L12.5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-[19px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                Budget
              </h1>
              <p className="truncate px-0.5 text-xs text-neutral-400">{household.name}</p>
            </div>
          </div>
          <button
            onClick={() => setShowManager(true)}
            className="rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-95 dark:bg-white dark:text-neutral-900"
          >
            Set budgets
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-7 px-4 py-6">
        {loading && <p className="py-12 text-center text-sm text-neutral-400">Loading…</p>}

        {!loading && spend.length === 0 && (
          <p className="animate-fade-in py-12 text-center text-sm text-neutral-400">
            No priced items yet — import a receipt or add prices to items to see spending here.
          </p>
        )}

        {!loading && spend.length > 0 && (
          <section className="animate-fade-slide-in space-y-3">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {monthLabel(currentMonthKey)}
              </h2>
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                ${currentTotal.toFixed(2)}
              </span>
            </div>

            <div className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-white shadow-sm shadow-black/[0.03] ring-1 ring-black/5 dark:divide-white/10 dark:bg-neutral-900 dark:ring-white/10">
              {budgets.map((b) => {
                const spent = spendByCategory.get(b.category) ?? 0;
                const pct = Math.min(spent / b.monthly_limit, 1.4);
                return (
                  <div key={b.id} className="space-y-1.5 px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-800 dark:text-neutral-100">{b.category}</span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        ${spent.toFixed(2)} / ${b.monthly_limit.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor(pct)}`}
                        style={{ width: `${Math.min(pct, 1) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {[...spendByCategory.keys()]
                .filter((c) => !budgets.some((b) => b.category === c))
                .map((c) => (
                  <div key={c} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-neutral-800 dark:text-neutral-100">{c}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      ${spendByCategory.get(c)!.toFixed(2)}
                    </span>
                  </div>
                ))}
              {budgets.length === 0 && spendByCategory.size === 0 && (
                <p className="px-4 py-3 text-sm text-neutral-400">
                  No spending logged yet this month.
                </p>
              )}
            </div>
          </section>
        )}

        {pastMonths.length > 0 && (
          <section className="space-y-3">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Previous months
            </h2>
            <div className="space-y-2">
              {pastMonths.map(([month, rows]) => {
                const total = rows.reduce((s, r) => s + r.total, 0);
                const sorted = [...rows].sort((a, b) => b.total - a.total);
                return (
                  <details
                    key={month}
                    className="group overflow-hidden rounded-2xl bg-white shadow-sm shadow-black/[0.03] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm">
                      <span className="text-neutral-800 dark:text-neutral-100">
                        {monthLabel(month)}
                      </span>
                      <span className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                        ${total.toFixed(2)}
                        <ChevronDownIcon className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" />
                      </span>
                    </summary>
                    <div className="divide-y divide-black/5 border-t border-black/5 dark:divide-white/10 dark:border-white/10">
                      {sorted.map((r) => (
                        <div
                          key={r.category}
                          className="flex items-center justify-between px-4 py-2 text-sm"
                        >
                          <span className="text-neutral-600 dark:text-neutral-300">
                            {r.category}
                          </span>
                          <span className="text-neutral-500 dark:text-neutral-400">
                            ${r.total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {showManager && (
        <BudgetManager
          householdId={household.id}
          budgets={budgets}
          categories={categories}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  );
}
