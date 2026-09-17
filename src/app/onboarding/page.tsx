"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("Our Household");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function afterHousehold(supabase: ReturnType<typeof createClient>, householdId: string) {
    const { data: list } = await supabase
      .from("lists")
      .select("id")
      .eq("household_id", householdId)
      .limit(1)
      .maybeSingle();
    router.push(list ? `/lists/${list.id}` : "/");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_household", { p_name: name });
    setLoading(false);
    if (error) return setError(error.message);
    await afterHousehold(supabase, data as string);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("join_household", { p_invite_code: code });
    setLoading(false);
    if (error) return setError(error.message);
    await afterHousehold(supabase, data as string);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 dark:bg-black">
      <div className="w-full max-w-sm animate-fade-slide-in space-y-7 rounded-[28px] bg-white/80 p-8 shadow-xl shadow-black/5 ring-1 ring-black/5 backdrop-blur-xl dark:bg-neutral-900/80 dark:ring-white/10">
        <div className="space-y-2 text-center">
          <h1 className="text-[20px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Set up your household
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Shopping lists are shared with whoever is in your household.
          </p>
        </div>

        {mode === "choose" && (
          <div className="animate-fade-in space-y-2.5">
            <button
              onClick={() => setMode("create")}
              className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Create a new household
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full rounded-2xl bg-black/5 px-4 py-3 text-sm font-medium text-neutral-900 transition-all duration-150 hover:bg-black/10 active:scale-[0.98] dark:bg-white/10 dark:text-neutral-50 dark:hover:bg-white/15"
            >
              Join with an invite code
            </button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="animate-fade-in space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Household name"
              className="w-full rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm text-neutral-900 outline-none transition-all duration-150 placeholder:text-neutral-400 focus:border-neutral-900/30 focus:bg-white focus:ring-4 focus:ring-neutral-900/5 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50 dark:focus:border-white/30 dark:focus:bg-white/10 dark:focus:ring-white/5"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {loading ? "Creating…" : "Create household"}
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="w-full text-center text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Back
            </button>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoin} className="animate-fade-in space-y-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Invite code"
              className="w-full rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm uppercase text-neutral-900 outline-none transition-all duration-150 placeholder:text-neutral-400 placeholder:normal-case focus:border-neutral-900/30 focus:bg-white focus:ring-4 focus:ring-neutral-900/5 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50 dark:focus:border-white/30 dark:focus:bg-white/10 dark:focus:ring-white/5"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {loading ? "Joining…" : "Join household"}
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="w-full text-center text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Back
            </button>
          </form>
        )}

        {error && <p className="animate-fade-in text-center text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
