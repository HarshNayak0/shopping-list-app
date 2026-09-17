"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 dark:bg-black">
      <div className="w-full max-w-sm animate-fade-slide-in space-y-7 rounded-[28px] bg-white/80 p-8 shadow-xl shadow-black/5 ring-1 ring-black/5 backdrop-blur-xl dark:bg-neutral-900/80 dark:ring-white/10">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path
                d="M7 8h10l-1 10.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5L7 8z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Shopping List
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Sign in with a magic link — no password needed.
          </p>
        </div>

        {status === "sent" ? (
          <p className="animate-fade-in rounded-2xl bg-green-500/10 p-4 text-center text-sm text-green-700 dark:text-green-400">
            Check <strong>{email}</strong> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm text-neutral-900 outline-none transition-all duration-150 placeholder:text-neutral-400 focus:border-neutral-900/30 focus:bg-white focus:ring-4 focus:ring-neutral-900/5 dark:border-white/10 dark:bg-white/5 dark:text-neutral-50 dark:focus:border-white/30 dark:focus:bg-white/10 dark:focus:ring-white/5"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && (
              <p className="animate-fade-in text-center text-sm text-red-500">{error}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
