// ---------------------------------------------------------------------------
// Display formatters for CLI table output
// ---------------------------------------------------------------------------

const DASH = "\u2014";

type Nullable = null | undefined;

// ---------------------------------------------------------------------------
// formatCents — 63 → "63¢"
// ---------------------------------------------------------------------------

export function formatCents(value: number | string | Nullable): string {
  if (value === null || value === undefined) return DASH;
  const n = typeof value === "string" ? Number(value) : value;
  return `${n}\u00A2`;
}

// ---------------------------------------------------------------------------
// formatMoney — 1500000 → "$1.5M", 15000 → "$15.0K", 432.5 → "$432.50"
// ---------------------------------------------------------------------------

export function formatMoney(value: number | string | Nullable): string {
  if (value === null || value === undefined) return DASH;
  const n = typeof value === "string" ? Number(value) : value;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// formatAddress — "0x1a2b3c...7e8f9a0b" → "0x1a2b...9a0b"
// ---------------------------------------------------------------------------

export function formatAddress(value: string | Nullable): string {
  if (value === null || value === undefined) return DASH;
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// truncate — clip string to maxLen with "..."
// ---------------------------------------------------------------------------

export function truncate(value: string | Nullable, maxLen: number): string {
  if (value === null || value === undefined) return DASH;
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen - 3) + "...";
}

// ---------------------------------------------------------------------------
// formatDate — ISO string → "Mar 15, 2026"
// ---------------------------------------------------------------------------

export function formatDate(value: string | Nullable): string {
  if (value === null || value === undefined) return DASH;
  const d = new Date(value);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
