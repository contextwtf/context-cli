// ---------------------------------------------------------------------------
// Display formatters for CLI table output
// ---------------------------------------------------------------------------

const DASH = "\u2014";

type Nullable = null | undefined;

// ---------------------------------------------------------------------------
// formatCents — 63 → "63¢" (for values already in cents, e.g. user-facing prices)
// ---------------------------------------------------------------------------

export function formatCents(value: number | string | Nullable): string {
  if (value === null || value === undefined) return DASH;
  const n = typeof value === "string" ? Number(value) : value;
  return `${n}\u00A2`;
}

// ---------------------------------------------------------------------------
// formatPrice — API micro-units to cents: 950000 → "95¢", 50000 → "5¢"
// API prices use 1000000 = $1.00, so divide by 10000 to get cents
// ---------------------------------------------------------------------------

export function formatPrice(value: number | string | Nullable): string {
  if (value === null || value === undefined) return DASH;
  const n = typeof value === "string" ? Number(value) : value;
  if (n === 0) return DASH;
  const cents = n / 10000;
  return `${cents.toFixed(cents % 1 === 0 ? 0 : 1)}\u00A2`;
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
// formatVolume — API micro-USDC to dollars: 14706679085 → "$14.7K"
// API volume uses 1000000 = $1.00
// ---------------------------------------------------------------------------

export function formatVolume(value: number | string | Nullable): string {
  if (value === null || value === undefined) return DASH;
  const n = typeof value === "string" ? Number(value) : value;
  const dollars = n / 1_000_000;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  if (dollars > 0) return `$${dollars.toFixed(2)}`;
  return "$0.00";
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
