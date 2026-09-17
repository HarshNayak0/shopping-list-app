"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { applyRealtimeListChange } from "@/lib/realtimeSync";
import type { Household, Item, List, Store } from "@/types/database";
import StoreManager from "./StoreManager";
import ImportReceipt from "./ImportReceipt";
import Dropdown from "./Dropdown";
import Checkbox from "./Checkbox";
import { ChevronDownIcon, XIcon } from "./icons";

const UNASSIGNED = "unassigned";

export default function ShoppingListView({
  currentUserId,
  household,
  list,
  allLists,
  initialStores,
  initialItems,
  profiles,
}: {
  currentUserId: string;
  household: Household;
  list: List;
  allLists: List[];
  initialStores: Store[];
  initialItems: Item[];
  profiles: { id: string; display_name: string }[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [stores, setStores] = useState<Store[]>(initialStores);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [showStoreManager, setShowStoreManager] = useState(false);
  const [showImportReceipt, setShowImportReceipt] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [priceFlags, setPriceFlags] = useState<Map<string, number>>(new Map());

  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newStoreId, setNewStoreId] = useState<string>("auto");
  const [suggestedStoreId, setSuggestedStoreId] = useState<string | null>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.display_name));
    return m;
  }, [profiles]);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort(),
    [items]
  );

  const refreshPriceFlags = useCallback(async () => {
    const { data } = await supabase.rpc("price_increase_flags", {
      p_household_id: household.id,
    });
    const map = new Map<string, number>();
    (data ?? []).forEach((row: { item_id: string; previous_price: number }) => {
      map.set(row.item_id, row.previous_price);
    });
    setPriceFlags(map);
  }, [supabase, household.id]);

  useEffect(() => {
    refreshPriceFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.id]);

  // Realtime: items + stores for this household/list
  useEffect(() => {
    const channel = supabase
      .channel(`list-${list.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `list_id=eq.${list.id}` },
        applyRealtimeListChange<Item>(setItems)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stores", filter: `household_id=eq.${household.id}` },
        applyRealtimeListChange<Store>(setStores)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, list.id, household.id]);

  // Debounced store suggestion as the user types a new item name
  useEffect(() => {
    if (!newName.trim()) {
      setSuggestedStoreId(null);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase.rpc("suggest_store_for_item", {
        p_household_id: household.id,
        p_item_name: newName.trim(),
      });
      setSuggestedStoreId((data as string) ?? null);
    }, 300);
    return () => clearTimeout(handle);
  }, [newName, supabase, household.id]);

  const sortedStores = useMemo(
    () => [...stores].sort((a, b) => a.sort_order - b.sort_order),
    [stores]
  );

  const activeItems = items.filter((i) => !i.is_checked);
  const checkedItems = items.filter((i) => i.is_checked);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const store of sortedStores) map.set(store.id, []);
    map.set(UNASSIGNED, []);
    for (const item of activeItems) {
      const key = item.store_id && map.has(item.store_id) ? item.store_id : UNASSIGNED;
      map.get(key)!.push(item);
    }
    return map;
  }, [activeItems, sortedStores]);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    const storeId = newStoreId === "auto" ? suggestedStoreId : newStoreId || null;

    setNewName("");
    setNewQty("");
    setNewStoreId("auto");
    setSuggestedStoreId(null);

    await supabase.from("items").insert({
      list_id: list.id,
      household_id: household.id,
      name,
      quantity: newQty.trim() || null,
      store_id: storeId,
      created_by: currentUserId,
    });
  }

  async function toggleChecked(item: Item) {
    await supabase
      .from("items")
      .update({
        is_checked: !item.is_checked,
        checked_at: !item.is_checked ? new Date().toISOString() : null,
      })
      .eq("id", item.id);
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) return alert(error.message);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function clearChecked() {
    const { error } = await supabase
      .from("items")
      .delete()
      .eq("list_id", list.id)
      .eq("is_checked", true);
    if (error) return alert(error.message);
    setItems((prev) => prev.filter((i) => !i.is_checked));
  }

  async function changeItemStore(item: Item, storeId: string) {
    await supabase
      .from("items")
      .update({ store_id: storeId || null })
      .eq("id", item.id);
  }

  async function updateItem(
    item: Item,
    updates: {
      name: string;
      quantity: string | null;
      notes: string | null;
      price: number | null;
      category: string | null;
    }
  ) {
    await supabase
      .from("items")
      .update({
        name: updates.name,
        quantity: updates.quantity,
        notes: updates.notes,
        price: updates.price,
        category: updates.category,
      })
      .eq("id", item.id);
    if (updates.price != null) refreshPriceFlags();
  }

  async function deleteStore(id: string) {
    const { error } = await supabase.from("stores").delete().eq("id", id);
    if (error) return alert(error.message);
    setStores((prev) => prev.filter((s) => s.id !== id));
    setItems((prev) => prev.map((i) => (i.store_id === id ? { ...i, store_id: null } : i)));
  }

  async function handleNewList() {
    const name = window.prompt("New list name", "Shopping List");
    if (!name) return;
    const { data } = await supabase
      .from("lists")
      .insert({ household_id: household.id, name })
      .select()
      .single();
    if (data) router.push(`/lists/${data.id}`);
  }

  function copyInvite() {
    navigator.clipboard.writeText(household.invite_code).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 1500);
    });
  }

  const storeSelectOptions = [
    { value: "", label: "Unsorted" },
    ...sortedStores.map((s) => ({ value: s.id, label: s.name, color: s.color })),
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-32 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-black/40">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Dropdown
              value={list.id}
              onChange={(id) => router.push(`/lists/${id}`)}
              options={allLists.map((l) => ({ value: l.id, label: l.name }))}
              buttonClassName="-ml-1 flex items-center gap-1 rounded-lg px-1 py-0.5 text-[19px] font-semibold tracking-tight text-neutral-900 transition-colors duration-150 hover:bg-black/5 active:scale-[0.98] dark:text-neutral-50 dark:hover:bg-white/10"
              renderTrigger={(selected) => (
                <>
                  <span className="max-w-[45vw] truncate">{selected?.label ?? list.name}</span>
                  <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                </>
              )}
            />
            <p className="truncate px-1 text-xs text-neutral-400">{household.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={handleNewList}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all duration-150 hover:bg-black/5 active:scale-95 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              + List
            </button>
            <button
              onClick={() => setShowStoreManager(true)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all duration-150 hover:bg-black/5 active:scale-95 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              Stores
            </button>
            <button
              onClick={() => setShowImportReceipt(true)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all duration-150 hover:bg-black/5 active:scale-95 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              Import
            </button>
            <button
              onClick={() => router.push(`/lists/${list.id}/budget`)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all duration-150 hover:bg-black/5 active:scale-95 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              Budget
            </button>
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-95 dark:bg-white dark:text-neutral-900"
            >
              Invite
            </button>
          </div>
        </div>
        {showInvite && (
          <div className="mx-auto max-w-2xl animate-fade-slide-in px-4 pb-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-black/5 px-4 py-2.5 text-sm dark:bg-white/10">
              <span className="text-neutral-600 dark:text-neutral-300">
                Invite code:{" "}
                <strong className="font-semibold tracking-wider text-neutral-900 dark:text-neutral-50">
                  {household.invite_code}
                </strong>
              </span>
              <button
                onClick={copyInvite}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-900 shadow-sm transition-all duration-150 active:scale-95 dark:bg-neutral-800 dark:text-neutral-50"
              >
                {copyLabel}
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl space-y-7 px-4 py-6">
        {sortedStores.map((store) => {
          const storeItems = grouped.get(store.id) ?? [];
          if (storeItems.length === 0) return null;
          return (
            <section key={store.id}>
              <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: store.color }} />
                {store.name}
                <span className="font-normal normal-case text-neutral-400">({storeItems.length})</span>
              </h2>
              <ul className="animate-fade-slide-in divide-y divide-black/5 overflow-hidden rounded-2xl bg-white shadow-sm shadow-black/[0.03] ring-1 ring-black/5 dark:divide-white/10 dark:bg-neutral-900 dark:ring-white/10">
                {storeItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    storeOptions={storeSelectOptions}
                    addedBy={item.created_by ? nameById.get(item.created_by) : undefined}
                    categories={categories}
                    priceFlag={priceFlags.get(item.id)}
                    onToggle={() => toggleChecked(item)}
                    onDelete={() => deleteItem(item.id)}
                    onStoreChange={(sid) => changeItemStore(item, sid)}
                    onEdit={(updates) => updateItem(item, updates)}
                    supabase={supabase}
                  />
                ))}
              </ul>
            </section>
          );
        })}

        {(grouped.get(UNASSIGNED) ?? []).length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
              Unsorted
              <span className="font-normal normal-case text-neutral-400">
                ({(grouped.get(UNASSIGNED) ?? []).length})
              </span>
            </h2>
            <ul className="animate-fade-slide-in divide-y divide-black/5 overflow-hidden rounded-2xl bg-white shadow-sm shadow-black/[0.03] ring-1 ring-black/5 dark:divide-white/10 dark:bg-neutral-900 dark:ring-white/10">
              {(grouped.get(UNASSIGNED) ?? []).map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  storeOptions={storeSelectOptions}
                  addedBy={item.created_by ? nameById.get(item.created_by) : undefined}
                  categories={categories}
                  priceFlag={priceFlags.get(item.id)}
                  onToggle={() => toggleChecked(item)}
                  onDelete={() => deleteItem(item.id)}
                  onStoreChange={(sid) => changeItemStore(item, sid)}
                  onEdit={(updates) => updateItem(item, updates)}
                  supabase={supabase}
                />
              ))}
            </ul>
          </section>
        )}

        {activeItems.length === 0 && (
          <p className="animate-fade-in py-12 text-center text-sm text-neutral-400">
            Your list is empty. Add something below.
          </p>
        )}

        {checkedItems.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-400">
                Checked ({checkedItems.length})
              </h2>
              <button
                onClick={clearChecked}
                className="text-xs font-medium text-red-500 transition-opacity hover:opacity-70"
              >
                Clear checked
              </button>
            </div>
            <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-white opacity-60 shadow-sm shadow-black/[0.03] ring-1 ring-black/5 dark:divide-white/10 dark:bg-neutral-900 dark:ring-white/10">
              {checkedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  storeOptions={storeSelectOptions}
                  addedBy={item.created_by ? nameById.get(item.created_by) : undefined}
                  categories={categories}
                  priceFlag={priceFlags.get(item.id)}
                  onToggle={() => toggleChecked(item)}
                  onDelete={() => deleteItem(item.id)}
                  onStoreChange={(sid) => changeItemStore(item, sid)}
                  onEdit={(updates) => updateItem(item, updates)}
                  supabase={supabase}
                />
              ))}
            </ul>
          </section>
        )}
      </main>

      <form
        onSubmit={handleAddItem}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-black/5 bg-white/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/60"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add an item…"
            className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-black/[0.03] px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-all duration-150 placeholder:text-neutral-400 focus:border-neutral-900/20 focus:bg-white focus:ring-4 focus:ring-neutral-900/5 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50 dark:focus:border-white/25 dark:focus:bg-white/10"
          />
          <input
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            placeholder="Qty"
            className="w-16 shrink-0 rounded-2xl border border-black/10 bg-black/[0.03] px-2 py-2.5 text-center text-sm text-neutral-900 outline-none transition-all duration-150 placeholder:text-neutral-400 focus:border-neutral-900/20 focus:bg-white focus:ring-4 focus:ring-neutral-900/5 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50 dark:focus:border-white/25 dark:focus:bg-white/10"
          />
          <Dropdown
            value={newStoreId}
            onChange={setNewStoreId}
            align="right"
            options={[
              {
                value: "auto",
                label: suggestedStoreId
                  ? `Auto · ${stores.find((s) => s.id === suggestedStoreId)?.name ?? "…"}`
                  : "Auto",
              },
              ...sortedStores.map((s) => ({ value: s.id, label: s.name, color: s.color })),
            ]}
            buttonClassName="shrink-0 flex max-w-[7.5rem] items-center gap-1 rounded-2xl bg-black/[0.05] px-3 py-2.5 text-xs font-medium text-neutral-600 transition-all duration-150 hover:bg-black/[0.08] active:scale-95 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
          />
          <button
            type="submit"
            className="shrink-0 rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-95 dark:bg-white dark:text-neutral-900"
          >
            Add
          </button>
        </div>
      </form>

      {showStoreManager && (
        <StoreManager
          householdId={household.id}
          stores={stores}
          onClose={() => setShowStoreManager(false)}
          onDelete={deleteStore}
        />
      )}

      {showImportReceipt && (
        <ImportReceipt
          householdId={household.id}
          listId={list.id}
          currentUserId={currentUserId}
          stores={stores}
          categories={categories}
          onClose={() => setShowImportReceipt(false)}
          onImported={(newStores, newItems) => {
            setStores((prev) => [...prev, ...newStores]);
            setItems((prev) => [...prev, ...newItems]);
            refreshPriceFlags();
          }}
        />
      )}
    </div>
  );
}

function ItemRow({
  item,
  storeOptions,
  addedBy,
  categories,
  priceFlag,
  onToggle,
  onDelete,
  onStoreChange,
  onEdit,
  supabase,
}: {
  item: Item;
  storeOptions: { value: string; label: string; color?: string }[];
  addedBy?: string;
  categories: string[];
  priceFlag?: number;
  onToggle: () => void;
  onDelete: () => void;
  onStoreChange: (storeId: string) => void;
  onEdit: (updates: {
    name: string;
    quantity: string | null;
    notes: string | null;
    price: number | null;
    category: string | null;
  }) => void;
  supabase: SupabaseClient;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(item.quantity ?? "");
  const [editNotes, setEditNotes] = useState(item.notes ?? "");
  const [editPrice, setEditPrice] = useState(item.price != null ? String(item.price) : "");
  const [editCategory, setEditCategory] = useState(item.category ?? "");
  const [editPriceWarning, setEditPriceWarning] = useState<number | null>(null);

  function startEdit() {
    setEditName(item.name);
    setEditQty(item.quantity ?? "");
    setEditNotes(item.notes ?? "");
    setEditPrice(item.price != null ? String(item.price) : "");
    setEditCategory(item.category ?? "");
    setEditing(true);
  }

  // Live price-increase check while editing a price
  useEffect(() => {
    if (!editing) return;
    const price = parseFloat(editPrice);
    if (!editName.trim() || !Number.isFinite(price)) {
      setEditPriceWarning(null);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase.rpc("previous_price_for_item", {
        p_household_id: item.household_id,
        p_item_name: editName.trim(),
        p_exclude_item_id: item.id,
      });
      const prev = data as number | null;
      setEditPriceWarning(prev != null && price > prev ? prev : null);
    }, 300);
    return () => clearTimeout(handle);
  }, [editing, editName, editPrice, supabase, item.household_id, item.id]);

  function save() {
    if (!editName.trim()) return;
    const price = editPrice.trim() ? parseFloat(editPrice) : NaN;
    onEdit({
      name: editName.trim(),
      quantity: editQty.trim() || null,
      notes: editNotes.trim() || null,
      price: Number.isFinite(price) ? price : null,
      category: editCategory.trim() || null,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="animate-fade-in space-y-2 bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
        <div className="flex gap-2">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Item name"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900/30 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-50"
          />
          <input
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            placeholder="Qty"
            className="w-16 shrink-0 rounded-xl border border-black/10 bg-white px-2 py-1.5 text-center text-sm text-neutral-900 outline-none focus:border-neutral-900/30 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-50"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            placeholder="Price"
            inputMode="decimal"
            className="w-20 shrink-0 rounded-xl border border-black/10 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900/30 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-50"
          />
          <input
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            placeholder="Category"
            list="category-options"
            className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900/30 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-50"
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        {editPriceWarning != null && (
          <p className="text-xs font-medium text-red-500">
            ↑ up from ${editPriceWarning.toFixed(2)} last time
          </p>
        )}
        <input
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900/30 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-50"
        />
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={save}
            className="rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white transition-all duration-150 active:scale-95 dark:bg-white dark:text-neutral-900"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-full bg-black/5 px-3.5 py-1.5 text-xs font-medium text-neutral-600 transition-all duration-150 active:scale-95 dark:bg-white/10 dark:text-neutral-300"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
      <Checkbox checked={item.is_checked} onChange={onToggle} />
      <button className="min-w-0 flex-1 text-left" onClick={startEdit}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className={`truncate text-[15px] text-neutral-900 transition-colors dark:text-neutral-50 ${
              item.is_checked ? "text-neutral-400 line-through dark:text-neutral-500" : ""
            }`}
          >
            {item.name}
          </span>
          {item.quantity && (
            <span className="shrink-0 text-xs text-neutral-400">×{item.quantity}</span>
          )}
          {item.price != null && (
            <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
              ${item.price.toFixed(2)}
            </span>
          )}
          {priceFlag != null && (
            <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
              ↑ was ${priceFlag.toFixed(2)}
            </span>
          )}
          {item.category && (
            <span className="shrink-0 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-white/10 dark:text-neutral-400">
              {item.category}
            </span>
          )}
        </div>
        {item.notes && <p className="truncate text-[12px] text-neutral-400">{item.notes}</p>}
        {addedBy && <p className="text-[11px] text-neutral-400">added by {addedBy}</p>}
      </button>
      <Dropdown
        value={item.store_id ?? ""}
        onChange={onStoreChange}
        align="right"
        options={storeOptions}
        buttonClassName="shrink-0 flex max-w-[6rem] items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs text-neutral-500 transition-all duration-150 hover:bg-black/[0.07] active:scale-95 dark:bg-white/[0.06] dark:text-neutral-400 dark:hover:bg-white/10"
      />
      <button
        onClick={onDelete}
        className="shrink-0 rounded-full p-1.5 text-neutral-300 transition-all duration-150 hover:bg-red-500/10 hover:text-red-500 active:scale-90 dark:text-neutral-600"
        aria-label="Delete item"
      >
        <XIcon />
      </button>
    </li>
  );
}
