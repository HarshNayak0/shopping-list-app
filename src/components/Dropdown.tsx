"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon } from "./icons";

export type DropdownOption = { value: string; label: string; color?: string };

// Matches the panel's max-h-72 (18rem) — used to decide whether it should
// open upward instead of downward when there isn't room below the button.
const PANEL_MAX_HEIGHT = 288;
const GAP = 8;

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
  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    openUpward: boolean;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openDropdown() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow;
    setPosition({
      top: openUpward ? undefined : rect.bottom + GAP,
      bottom: openUpward ? window.innerHeight - rect.top + GAP : undefined,
      left: align === "left" ? rect.left : undefined,
      right: align === "right" ? window.innerWidth - rect.right : undefined,
      openUpward,
    });
    setOpen(true);
  }

  // Rendered via a portal (see below), so a dropdown's own overflow-hidden
  // list container or fixed-position parent can never clip the panel — it
  // was, before this used a portal: any card with rounded corners (which
  // relies on overflow-hidden) or the bottom add-item bar would cut the
  // panel off instead of letting it float above everything else.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Scrolling or resizing would leave the panel visually detached from
    // its button, since position is computed once at open time — simplest
    // correct behavior is to close it rather than track position live.
    function handleDismiss() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
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

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              right: position.right,
            }}
            className={
              panelClassName ??
              `z-30 max-h-72 min-w-[11rem] overflow-y-auto rounded-2xl border border-black/5 bg-white/90 p-1.5 shadow-xl shadow-black/10 backdrop-blur-xl animate-scale-in dark:border-white/10 dark:bg-neutral-800/90 ${
                position.openUpward ? "origin-bottom" : "origin-top"
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
          </div>,
          document.body
        )}
    </>
  );
}
