"use client";

import { XIcon } from "./icons";

// Shared shell for the app's modals (backdrop, panel, title bar with a
// close button) — StoreManager, ImportReceipt, and BudgetManager all used
// to duplicate this markup verbatim.
export default function Modal({
  title,
  onClose,
  maxWidth = "max-w-md",
  children,
}: {
  title: string;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} animate-scale-in space-y-5 rounded-[28px] bg-white/90 p-6 shadow-2xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-xl dark:bg-neutral-900/90 dark:ring-white/10`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-neutral-500 transition-all duration-150 hover:bg-black/10 active:scale-90 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
          >
            <XIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
