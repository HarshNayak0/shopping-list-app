// Small inline icons reused across modals, dropdowns, and list rows —
// centralized so the same glyph isn't hand-copied as inline SVG everywhere.

export function XIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({
  className = "h-4 w-4",
  strokeWidth = "1.8",
}: {
  className?: string;
  strokeWidth?: string;
}) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M4 10.5L8 14.5L16 6"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
