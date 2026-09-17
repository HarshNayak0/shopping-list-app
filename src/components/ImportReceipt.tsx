"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Item, Store } from "@/types/database";
import { STORE_COLORS } from "@/lib/storeColors";
import { parseReceiptText } from "@/lib/parseReceipt";
import Modal from "./Modal";
import { XIcon } from "./icons";

const PROMPT_TEMPLATE =
  "Read the attached receipt and list every item as one line each, in exactly this format: name, qty, price, store, category. Category is optional (e.g. Groceries, Household, Personal Care) - leave it blank if unsure. Use the store name from the receipt (or say \"unknown\" if unclear). No header row, no extra commentary.";

export default function ImportReceipt({
  householdId,
  listId,
  currentUserId,
  stores,
  categories,
  onClose,
  onImported,
}: {
  householdId: string;
  listId: string;
  currentUserId: string;
  stores: Store[];
  categories: string[];
  onClose: () => void;
  onImported: (newStores: Store[], newItems: Item[]) => void;
}) {
  const [text, setText] = useState("");
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState<Record<number, string>>({});
  const [bulkCategory, setBulkCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy prompt");
  const [priceFlags, setPriceFlags] = useState<Map<string, number>>(new Map());
  const supabase = useMemo(() => createClient(), []);

  const rows = useMemo(() => parseReceiptText(text), [text]);
  const activeIndexes = rows.map((_, i) => i).filter((i) => !removed.has(i));

  function categoryFor(i: number) {
    return categoryOverrides[i] ?? rows[i]?.category ?? "";
  }

  function setCategoryFor(i: number, value: string) {
    setCategoryOverrides((prev) => ({ ...prev, [i]: value }));
  }

  function applyBulkCategory() {
    if (!bulkCategory.trim()) return;
    setCategoryOverrides((prev) => {
      const next = { ...prev };
      activeIndexes.forEach((i) => {
        next[i] = bulkCategory.trim();
      });
      return next;
    });
  }

  // Debounced check: does any parsed row cost more than we last paid for it?
  useEffect(() => {
    const candidates = rows.filter((r) => r.price != null);
    if (candidates.length === 0) {
      setPriceFlags(new Map());
      return;
    }
    const handle = setTimeout(async () => {
      const uniqueNames = [...new Set(candidates.map((r) => r.name.toLowerCase()))];
      const results = await Promise.all(
        uniqueNames.map((name) =>
          supabase
            .rpc("previous_price_for_item", { p_household_id: householdId, p_item_name: name })
            .then(({ data }) => [name, data as number | null] as const)
        )
      );
      const map = new Map<string, number>();
      results.forEach(([name, prev]) => {
        if (prev != null) map.set(name, prev);
      });
      setPriceFlags(map);
    }, 300);
    return () => clearTimeout(handle);
  }, [rows, supabase, householdId]);

  function copyPrompt() {
    navigator.clipboard.writeText(PROMPT_TEMPLATE).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy prompt"), 1500);
    });
  }

  async function handleImport() {
    if (activeIndexes.length === 0) return;
    setBusy(true);
    setError("");

    try {
      const activeRows = activeIndexes.map((i) => ({ ...rows[i], category: categoryFor(i) || null }));

      const existingByName = new Map(stores.map((s) => [s.name.toLowerCase(), s.id]));
      const newStoreNames = [
        ...new Set(
          activeRows
            .map((r) => r.storeName?.trim())
            .filter((n): n is string => !!n && n.toLowerCase() !== "unknown")
        ),
      ].filter((n) => !existingByName.has(n.toLowerCase()));

      let createdStores: Store[] = [];
      if (newStoreNames.length > 0) {
        const { data, error: storeError } = await supabase
          .from("stores")
          .insert(
            newStoreNames.map((name, i) => ({
              household_id: householdId,
              name,
              color: STORE_COLORS[(stores.length + i) % STORE_COLORS.length],
              sort_order: stores.length + i,
            }))
          )
          .select();
        if (storeError) throw storeError;
        createdStores = data ?? [];
        createdStores.forEach((s) => existingByName.set(s.name.toLowerCase(), s.id));
      }

      const now = new Date().toISOString();
      const itemsToInsert = activeRows.map((r) => ({
        list_id: listId,
        household_id: householdId,
        name: r.name,
        quantity: r.qty,
        price: r.price,
        category: r.category,
        store_id:
          r.storeName && r.storeName.toLowerCase() !== "unknown"
            ? existingByName.get(r.storeName.toLowerCase()) ?? null
            : null,
        is_checked: true,
        checked_at: now,
        created_by: currentUserId,
      }));

      const { data: insertedItems, error: itemError } = await supabase
        .from("items")
        .insert(itemsToInsert)
        .select();
      if (itemError) throw itemError;

      onImported(createdStores, insertedItems ?? []);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Import receipt" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-2 rounded-2xl bg-black/[0.03] p-3.5 text-xs leading-relaxed text-neutral-500 dark:bg-white/[0.04] dark:text-neutral-400">
        <p>
          Upload the receipt photo to a Claude chat and ask it to extract items in this format,
          then paste the reply below.
        </p>
        <div className="flex items-start justify-between gap-2 rounded-xl bg-white px-3 py-2 dark:bg-neutral-800">
          <code className="text-[11px] text-neutral-600 dark:text-neutral-300">{PROMPT_TEMPLATE}</code>
          <button
            onClick={copyPrompt}
            className="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition-all duration-150 active:scale-95 dark:bg-white/10 dark:text-neutral-200"
          >
            {copyLabel}
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Milk, 1, 4.99, No Frills, Groceries\nPaper towels, 2, 12.49, Costco, Household"}
        rows={5}
        className="w-full resize-none rounded-2xl border border-black/10 bg-black/[0.03] px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-all duration-150 placeholder:text-neutral-400 focus:border-neutral-900/20 focus:bg-white focus:ring-4 focus:ring-neutral-900/5 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50 dark:focus:border-white/25 dark:focus:bg-white/10"
      />

      {rows.length > 0 && (
        <>
          <div className="flex gap-2">
            <input
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              placeholder="Category for all items…"
              list="import-category-options"
              className="min-w-0 flex-1 rounded-xl border border-black/10 bg-black/[0.03] px-3 py-1.5 text-xs text-neutral-900 outline-none focus:border-neutral-900/20 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50"
            />
            <button
              type="button"
              onClick={applyBulkCategory}
              className="shrink-0 rounded-xl bg-black/5 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-all duration-150 active:scale-95 dark:bg-white/10 dark:text-neutral-200"
            >
              Apply to all
            </button>
            <datalist id="import-category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl bg-black/[0.02] p-2 dark:bg-white/[0.03]">
            {rows.map((r, i) => {
              if (removed.has(i)) return null;
              const prevPrice = priceFlags.get(r.name.toLowerCase());
              const isIncrease = r.price != null && prevPrice != null && r.price > prevPrice;
              return (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm dark:bg-neutral-800"
                >
                  <span className="min-w-0 flex-1 truncate text-neutral-900 dark:text-neutral-50">
                    {r.name}
                  </span>
                  {r.qty && <span className="shrink-0 text-xs text-neutral-400">×{r.qty}</span>}
                  {r.price != null && (
                    <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                      ${r.price.toFixed(2)}
                    </span>
                  )}
                  {isIncrease && (
                    <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-500">
                      ↑ was ${prevPrice!.toFixed(2)}
                    </span>
                  )}
                  <input
                    value={categoryFor(i)}
                    onChange={(e) => setCategoryFor(i, e.target.value)}
                    placeholder="Category"
                    list="import-category-options"
                    className="w-28 shrink-0 rounded-lg border border-black/10 bg-black/[0.03] px-2 py-1 text-[11px] text-neutral-700 outline-none focus:border-neutral-900/20 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"
                  />
                  <span className="shrink-0 truncate text-xs text-neutral-400">
                    {r.storeName ?? "Unsorted"}
                  </span>
                  <button
                    onClick={() => setRemoved((prev) => new Set(prev).add(i))}
                    className="shrink-0 rounded-full p-1 text-neutral-300 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:text-neutral-600"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={handleImport}
        disabled={busy || activeIndexes.length === 0}
        className="w-full rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        {busy
          ? "Importing…"
          : activeIndexes.length > 0
            ? `Import ${activeIndexes.length} item${activeIndexes.length === 1 ? "" : "s"}`
            : "Paste items above"}
      </button>
      {error && <p className="animate-fade-in text-center text-sm text-red-500">{error}</p>}
    </Modal>
  );
}
