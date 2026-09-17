"use client";

import { CheckIcon } from "./icons";

export default function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150 active:scale-90 ${
        checked
          ? "border-neutral-900 bg-neutral-900 dark:border-neutral-50 dark:bg-neutral-50"
          : "border-neutral-300 bg-transparent hover:border-neutral-400 dark:border-neutral-600 dark:hover:border-neutral-400"
      }`}
    >
      {checked && (
        <CheckIcon
          className="h-3 w-3 animate-check-pop text-white dark:text-neutral-900"
          strokeWidth="2.4"
        />
      )}
    </button>
  );
}
