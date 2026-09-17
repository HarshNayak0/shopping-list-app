"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/types/database";
import { STORE_COLORS as COLORS } from "@/lib/storeColors";
import Modal from "./Modal";

export default function StoreManager({
  householdId,
  stores,
  onClose,
  onDelete,
}: {
  householdId: string;
  stores: Store[];
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);

  const supabase = createClient();

  async function addStore(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.from("stores").insert({
      household_id: householdId,
      name: name.trim(),
      color,
      sort_order: stores.length,
    });
    if (error) setError(error.message);
    setName("");
    setBusy(false);
  }

  function deleteStore(id: string) {
    if (!window.confirm("Delete this store? Items assigned to it will become unsorted.")) return;
    onDelete(id);
  }

  function startEdit(store: Store) {
    setEditingId(store.id);
    setEditName(store.name);
    setEditColor(store.color);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("stores")
      .update({ name: editName.trim(), color: editColor })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
  }

  async function move(id: string, dir: -1 | 1) {
    const sorted = [...stores].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((s) => s.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const { error } = await supabase.from("stores").update({ sort_order: b.sort_order }).eq("id", a.id);
    if (error) return setError(error.message);
    const { error: error2 } = await supabase
      .from("stores")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id);
    if (error2) setError(error2.message);
  }

  const sorted = [...stores].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Modal title="Manage stores" onClose={onClose}>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto">
        {sorted.map((s, i) =>
          editingId === s.id ? (
            <li
              key={s.id}
              className="animate-fade-in space-y-2.5 rounded-2xl bg-black/[0.03] px-3.5 py-3 dark:bg-white/[0.04]"
            >
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900/30 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-50"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setEditColor(c)}
                    className="h-6 w-6 rounded-full transition-transform duration-150 active:scale-90"
                    style={{
                      backgroundColor: c,
                      boxShadow: editColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={() => saveEdit(s.id)}
                  className="rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white transition-all duration-150 active:scale-95 dark:bg-white dark:text-neutral-900"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded-full bg-black/5 px-3.5 py-1.5 text-xs font-medium text-neutral-600 transition-all duration-150 active:scale-95 dark:bg-white/10 dark:text-neutral-300"
                >
                  Cancel
                </button>
              </div>
            </li>
          ) : (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 truncate text-sm text-neutral-800 dark:text-neutral-100">
                {s.name}
              </span>
              <button
                disabled={i === 0}
                onClick={() => move(s.id, -1)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition-all duration-150 hover:bg-black/5 active:scale-90 disabled:opacity-20 dark:text-neutral-500 dark:hover:bg-white/10"
              >
                ↑
              </button>
              <button
                disabled={i === sorted.length - 1}
                onClick={() => move(s.id, 1)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition-all duration-150 hover:bg-black/5 active:scale-90 disabled:opacity-20 dark:text-neutral-500 dark:hover:bg-white/10"
              >
                ↓
              </button>
              <button
                onClick={() => startEdit(s)}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-neutral-500 transition-all duration-150 hover:bg-black/5 active:scale-95 dark:text-neutral-400 dark:hover:bg-white/10"
              >
                Edit
              </button>
              <button
                onClick={() => deleteStore(s.id)}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-red-500 transition-all duration-150 hover:bg-red-500/10 active:scale-95"
              >
                Delete
              </button>
            </li>
          )
        )}
        {sorted.length === 0 && (
          <p className="py-4 text-center text-sm text-neutral-400">No stores yet.</p>
        )}
      </ul>

      <form onSubmit={addStore} className="space-y-3 border-t border-black/5 pt-4 dark:border-white/10">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Store name (e.g. Costco)"
          className="w-full rounded-2xl border border-black/10 bg-black/[0.03] px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-all duration-150 placeholder:text-neutral-400 focus:border-neutral-900/20 focus:bg-white focus:ring-4 focus:ring-neutral-900/5 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50 dark:focus:border-white/25 dark:focus:bg-white/10"
        />
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className="h-6 w-6 rounded-full transition-transform duration-150 active:scale-90"
              style={{
                backgroundColor: c,
                boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
              }}
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Add store
        </button>
        {error && <p className="animate-fade-in text-center text-sm text-red-500">{error}</p>}
      </form>
    </Modal>
  );
}
