"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";

export type DropdownOption = { value: string; label: string; color?: string };

export default function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  align = "left",
  buttonClassName,
  panelClassName,
  renderTrigger,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  align?: "left" | "right";
  buttonClassName?: string;
  panelClassName?: string;
  renderTrigger?: (selected: DropdownOption | undefined) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          buttonClassName ??
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-700 transition-all duration-150 hover:bg-black/5 active:scale-95 dark:text-neutral-200 dark:hover:bg-white/10"
        }
      >
        {renderTrigger ? (
          renderTrigger(selected)
        ) : (
          <>
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <ChevronDownIcon
              className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          className={
            panelClassName ??
            `absolute z-30 mt-2 max-h-72 min-w-[11rem] overflow-y-auto rounded-2xl border border-black/5 bg-white/90 p-1.5 shadow-xl shadow-black/10 backdrop-blur-xl animate-scale-in dark:border-white/10 dark:bg-neutral-800/90 ${
              align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
            }`
          }
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-neutral-800 transition-colors duration-100 hover:bg-black/5 dark:text-neutral-100 dark:hover:bg-white/10"
            >
              {o.color && (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />
              )}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.value === value && (
                <CheckIcon className="h-4 w-4 shrink-0 text-neutral-900 dark:text-neutral-50" />
              )}
            </button>
          ))}
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-neutral-400">No options</p>
          )}
        </div>
      )}
    </div>
  );
}
