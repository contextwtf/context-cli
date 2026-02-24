# CLI UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform context-cli from JSON-only output to a dual-mode CLI with human-readable tables, interactive setup wizard, trading confirmations, guides command, and REPL shell.

**Architecture:** New `src/ui/` layer handles all rendering. Commands pass data + column config to a unified `out()` function that auto-detects TTY vs pipe. Interactive elements use `@clack/prompts`. Shell uses Bun's readline. Existing command structure and SDK calls stay unchanged.

**Tech Stack:** Bun, @clack/prompts, chalk, cli-table3, existing @contextwtf/sdk + viem

---

### Task 1: Install Dependencies

**Step 1: Install the three new packages**

Run: `cd /Users/amir/Desktop/projects/context-ecosystem/context-cli && bun add @clack/prompts chalk cli-table3`

**Step 2: Install type definitions for cli-table3**

Run: `bun add -d @types/cli-table3`

**Step 3: Verify installation**

Run: `bunx tsc --noEmit`
Expected: No errors (or same errors as before)

**Step 4: Commit**

```bash
git add package.json bun.lockb
git commit -m "Add @clack/prompts, chalk, cli-table3 for UX redesign"
```

---

### Task 2: Create Number Formatters

**Files:**
- Create: `src/ui/format.ts`
- Test: `src/ui/__tests__/format.test.ts`

**Step 1: Write tests for all formatters**

```ts
// src/ui/__tests__/format.test.ts
import { describe, expect, test } from "bun:test";
import { formatCents, formatMoney, formatAddress, truncate, formatDate } from "../format";

describe("formatCents", () => {
  test("formats integer cents with cent sign", () => {
    expect(formatCents(63)).toBe("63¢");
  });
  test("formats zero", () => {
    expect(formatCents(0)).toBe("0¢");
  });
  test("handles string input", () => {
    expect(formatCents("45")).toBe("45¢");
  });
  test("handles null/undefined", () => {
    expect(formatCents(null)).toBe("—");
    expect(formatCents(undefined)).toBe("—");
  });
});

describe("formatMoney", () => {
  test("formats millions", () => {
    expect(formatMoney(1500000)).toBe("$1.5M");
  });
  test("formats thousands", () => {
    expect(formatMoney(15000)).toBe("$15.0K");
  });
  test("formats hundreds", () => {
    expect(formatMoney(432.5)).toBe("$432.50");
  });
  test("formats zero", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });
  test("handles string input", () => {
    expect(formatMoney("15000.50")).toBe("$15.0K");
  });
  test("handles null/undefined", () => {
    expect(formatMoney(null)).toBe("—");
  });
});

describe("formatAddress", () => {
  test("truncates to first 6 + last 4", () => {
    expect(formatAddress("0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b")).toBe("0x1a2b...9a0b");
  });
  test("returns short addresses unchanged", () => {
    expect(formatAddress("0x1234")).toBe("0x1234");
  });
  test("handles null/undefined", () => {
    expect(formatAddress(null)).toBe("—");
  });
});

describe("truncate", () => {
  test("truncates long strings", () => {
    expect(truncate("Will Bitcoin exceed $100k by March 2026?", 20)).toBe("Will Bitcoin exceed ...");
  });
  test("leaves short strings alone", () => {
    expect(truncate("Short", 20)).toBe("Short");
  });
  test("handles null/undefined", () => {
    expect(truncate(null, 20)).toBe("—");
  });
});

describe("formatDate", () => {
  test("formats ISO date string", () => {
    expect(formatDate("2026-03-15T00:00:00.000Z")).toBe("Mar 15, 2026");
  });
  test("handles null/undefined", () => {
    expect(formatDate(null)).toBe("—");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/amir/Desktop/projects/context-ecosystem/context-cli && bun test src/ui/__tests__/format.test.ts`
Expected: FAIL — module not found

**Step 3: Implement formatters**

```ts
// src/ui/format.ts

/** Format a price in cents: 63 → "63¢" */
export function formatCents(value: unknown): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (isNaN(n)) return "—";
  return `${Math.round(n)}¢`;
}

/** Format a dollar amount: 15000 → "$15.0K", 1500000 → "$1.5M" */
export function formatMoney(value: unknown): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/** Truncate an address: 0x1a2b3c...9a0b */
export function formatAddress(value: unknown): string {
  if (value == null) return "—";
  const s = String(value);
  if (s.length <= 14) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

/** Truncate a string with ellipsis */
export function truncate(value: unknown, maxLen: number): string {
  if (value == null) return "—";
  const s = String(value);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...";
}

/** Format an ISO date: "2026-03-15T..." → "Mar 15, 2026" */
export function formatDate(value: unknown): string {
  if (value == null) return "—";
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/ui/__tests__/format.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/ui/format.ts src/ui/__tests__/format.test.ts
git commit -m "Add number, address, date formatters for table output"
```

---

### Task 3: Create Table Rendering Utilities

**Files:**
- Create: `src/ui/table.ts`
- Test: `src/ui/__tests__/table.test.ts`

**Step 1: Write tests**

```ts
// src/ui/__tests__/table.test.ts
import { describe, expect, test } from "bun:test";
import { makeTable, makeDetailTable } from "../table";

describe("makeTable", () => {
  test("renders a table string with headers and rows", () => {
    const result = makeTable(
      [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }],
      [
        { key: "name", label: "Name" },
        { key: "age", label: "Age" },
      ]
    );
    expect(result).toContain("Name");
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
    expect(result).toContain("╭");  // rounded style
  });

  test("returns empty message for empty data", () => {
    const result = makeTable([], [{ key: "x", label: "X" }], "No items.");
    expect(result).toBe("No items.");
  });

  test("adds row numbers when numbered is true", () => {
    const result = makeTable(
      [{ name: "Alice" }],
      [{ key: "name", label: "Name" }],
      undefined,
      true
    );
    expect(result).toContain("#");
    expect(result).toContain("1");
  });
});

describe("makeDetailTable", () => {
  test("renders key-value pairs", () => {
    const result = makeDetailTable([
      ["Name", "Alice"],
      ["Age", "30"],
    ]);
    expect(result).toContain("Name");
    expect(result).toContain("Alice");
    expect(result).toContain("╭");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/ui/__tests__/table.test.ts`
Expected: FAIL

**Step 3: Implement table utilities**

```ts
// src/ui/table.ts
import Table from "cli-table3";

export interface Column {
  key: string;
  label: string;
  width?: number;
  format?: (value: unknown) => string;
}

/** Get a nested value from an object using dot notation */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: any, part) => {
    if (acc == null) return undefined;
    // Handle array index: "outcomePrices[1]"
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const arr = acc[match[1]];
      return Array.isArray(arr) ? arr[parseInt(match[2], 10)] : undefined;
    }
    return acc[part];
  }, obj);
}

/**
 * Render a list of objects as a rounded Unicode table.
 * Returns the table string (caller prints it).
 */
export function makeTable(
  data: Record<string, unknown>[],
  columns: Column[],
  emptyMessage?: string,
  numbered?: boolean,
): string {
  if (data.length === 0) return emptyMessage || "No results.";

  const head = numbered ? ["#", ...columns.map((c) => c.label)] : columns.map((c) => c.label);
  const colWidths = numbered
    ? [4, ...columns.map((c) => c.width || undefined)]
    : columns.map((c) => c.width || undefined);

  const table = new Table({
    head,
    colWidths: colWidths.some(Boolean) ? colWidths : undefined,
    style: { "padding-left": 1, "padding-right": 1 },
    chars: {
      top: "─", "top-mid": "┬", "top-left": "╭", "top-right": "╮",
      bottom: "─", "bottom-mid": "┴", "bottom-left": "╰", "bottom-right": "╯",
      left: "│", "left-mid": "├", mid: "─", "mid-mid": "┼",
      right: "│", "right-mid": "┤", middle: "│",
    },
  });

  data.forEach((row, i) => {
    const cells = columns.map((col) => {
      const val = getNestedValue(row, col.key);
      return col.format ? col.format(val) : String(val ?? "—");
    });
    table.push(numbered ? [String(i + 1), ...cells] : cells);
  });

  return table.toString();
}

/**
 * Render key-value pairs as a two-column detail table.
 */
export function makeDetailTable(rows: [string, string][]): string {
  const table = new Table({
    style: { "padding-left": 1, "padding-right": 1 },
    chars: {
      top: "─", "top-mid": "┬", "top-left": "╭", "top-right": "╮",
      bottom: "─", "bottom-mid": "┴", "bottom-left": "╰", "bottom-right": "╯",
      left: "│", "left-mid": "├", mid: "─", "mid-mid": "┼",
      right: "│", "right-mid": "┤", middle: "│",
    },
    colWidths: [18, 60],
    wordWrap: true,
  });

  for (const [key, value] of rows) {
    table.push([key, value]);
  }

  return table.toString();
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/ui/__tests__/table.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/ui/table.ts src/ui/__tests__/table.test.ts
git commit -m "Add table rendering utilities with rounded Unicode borders"
```

---

### Task 4: Create Dual-Mode Output System

**Files:**
- Create: `src/ui/output.ts`
- Modify: `src/format.ts:1-22` (replace `out` and `fail`)

This is the core change — the new `out()` and `fail()` that handle both table and JSON modes.

**Step 1: Create output mode detection and the new out/fail functions**

```ts
// src/ui/output.ts
import chalk from "chalk";
import { makeTable, makeDetailTable, type Column } from "./table.js";

/** BigInt-safe JSON replacer */
const replacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

export type OutputMode = "table" | "json";

/** Resolve which output mode to use based on flags and TTY detection */
export function resolveOutputMode(flags: Record<string, string>): OutputMode {
  const explicit = flags["output"] || flags["o"];
  if (explicit === "json") return "json";
  if (explicit === "table") return "table";
  return process.stdout.isTTY ? "table" : "json";
}

export interface TableConfig {
  /** Column definitions for list rendering */
  columns?: Column[];
  /** If true, render as key-value detail table instead of list table */
  detail?: [string, string][];
  /** Message to show when data is empty */
  emptyMessage?: string;
  /** Show row numbers (for #N shell references) */
  numbered?: boolean;
  /** Pagination cursor for footer */
  cursor?: string | null;
  /** Total count for pagination footer */
  total?: number;
}

/**
 * Unified output function. In JSON mode, prints JSON to stdout.
 * In table mode, renders a formatted table.
 */
export function out(
  data: unknown,
  mode: OutputMode,
  config?: TableConfig,
): void {
  if (mode === "json") {
    console.log(JSON.stringify(data, replacer, 2));
    return;
  }

  // Table mode
  if (!config) {
    // Fallback: pretty-print JSON if no table config provided
    console.log(JSON.stringify(data, replacer, 2));
    return;
  }

  if (config.detail) {
    console.log(makeDetailTable(config.detail));
    return;
  }

  if (config.columns) {
    const items = Array.isArray(data) ? data : [data];
    console.log(makeTable(items, config.columns, config.emptyMessage, config.numbered));

    // Pagination footer
    if (config.cursor) {
      const showing = config.total
        ? `Showing ${items.length} of ${config.total}`
        : `Showing ${items.length}`;
      console.log(chalk.dim(`  ${showing} · Next: --cursor ${config.cursor}`));
    }
    return;
  }

  // No columns or detail — fallback to JSON
  console.log(JSON.stringify(data, replacer, 2));
}

/**
 * Print error and exit.
 * Table mode: styled error to stderr.
 * JSON mode: JSON error to stderr.
 */
export function fail(
  message: string,
  mode: OutputMode,
  details?: unknown,
): never {
  if (mode === "json") {
    const payload: Record<string, unknown> = { error: message };
    if (details !== undefined) payload.details = details;
    console.error(JSON.stringify(payload, replacer, 2));
  } else {
    console.error(chalk.red(`✗ ${message}`));
    if (details && typeof details === "object" && "usage" in (details as any)) {
      console.error(chalk.dim(`  Usage: ${(details as any).usage}`));
    }
  }
  process.exit(1);
}
```

**Step 2: Update `src/format.ts` — keep old `out` and `fail` as legacy aliases, add global mode**

The key insight: we need a global output mode that gets set once in `cli.ts` and is available everywhere. We'll add a simple module-level variable.

```ts
// src/format.ts — add at top of file, after existing imports
import { resolveOutputMode, out as uiOut, fail as uiFail, type OutputMode, type TableConfig } from "./ui/output.js";

let _mode: OutputMode = "json"; // default to JSON for safety

/** Set the global output mode (called once in cli.ts) */
export function setOutputMode(flags: Record<string, string>): void {
  _mode = resolveOutputMode(flags);
}

/** Get the current output mode */
export function getOutputMode(): OutputMode {
  return _mode;
}
```

Then update the existing `out` and `fail` functions to delegate:

Replace `src/format.ts:10-22` with:

```ts
/** Print output (dual-mode: table or JSON based on global mode) */
export function out(data: unknown, config?: TableConfig): void {
  uiOut(data, _mode, config);
}

/** Print error and exit (dual-mode) */
export function fail(message: string, details?: unknown): never {
  uiFail(message, _mode, details);
}
```

This means **all existing command modules continue to work unchanged** — their `out(data)` calls now go through the dual-mode system. To add table rendering, commands just pass a second argument: `out(data, { columns: [...] })`.

**Step 3: Update `src/cli.ts` to set the output mode early**

Add after `const parsed = parseArgs(process.argv);`:

```ts
import { setOutputMode } from "./format.js";
// ... in main():
setOutputMode(parsed.flags);
```

**Step 4: Update `parseArgs` to handle `-o` shorthand**

In `src/format.ts`, update the `parseArgs` function to handle single-dash `-o`:

Add handling for `-o` in the arg parsing loop (after `if (arg.startsWith("--"))` block):

```ts
} else if (arg === "-o" && i + 1 < args.length) {
  flags["output"] = args[i + 1];
  i += 2;
```

**Step 5: Type check**

Run: `bunx tsc --noEmit`
Expected: No new errors

**Step 6: Commit**

```bash
git add src/ui/output.ts src/format.ts src/cli.ts
git commit -m "Add dual-mode output system with TTY auto-detection"
```

---

### Task 5: Update Markets Command for Table Output

**Files:**
- Modify: `src/commands/markets.ts`

This is the template for all other commands. Focus on `list`, `get`, and `quotes` — they're the most-used and demonstrate the three patterns (list table, detail table, custom table).

**Step 1: Update `list` to pass column config**

In `src/commands/markets.ts`, replace the `list` function body's `out(result)` call:

```ts
import { formatCents, formatMoney, truncate } from "../ui/format.js";

// In list():
const markets = result.markets || result;
const items = Array.isArray(markets) ? markets : [];

out(result, {
  columns: [
    { key: "shortQuestion", label: "Question", format: (v) => truncate(v, 34) },
    { key: "outcomePrices[1].currentPrice", label: "Yes", format: formatCents },
    { key: "outcomePrices[0].currentPrice", label: "No", format: formatCents },
    { key: "volume", label: "Volume", format: formatMoney },
    { key: "status", label: "Status", format: (v) => String(v ?? "—") },
  ],
  numbered: true,
  emptyMessage: "No markets found.",
  cursor: result.cursor || null,
});
```

Note: `out(result)` still sends the full result object in JSON mode. The `columns` config is only used in table mode.

Wait — we need `out` to know which part of the data to render as a table when the data is a wrapper like `{ markets: [...], cursor: "..." }`. Update the approach: in table mode, the command extracts the array to render. Refactor:

```ts
import { getOutputMode } from "../format.js";

// In list():
if (getOutputMode() === "json") {
  out(result);
} else {
  const items = result.markets || [];
  out(items, {
    columns: [
      { key: "shortQuestion", label: "Question", format: (v) => truncate(v, 34) },
      { key: "outcomePrices[1].currentPrice", label: "Yes", format: formatCents },
      { key: "outcomePrices[0].currentPrice", label: "No", format: formatCents },
      { key: "volume", label: "Volume", format: formatMoney },
      { key: "status", label: "Status", format: (v) => String(v ?? "—") },
    ],
    numbered: true,
    emptyMessage: "No markets found.",
    cursor: result.cursor || null,
  });
}
```

Actually, this is repetitive. Better pattern — let `out` accept a `dataPath` that extracts the array in table mode:

Simpler approach: just have commands call `out` differently per mode. Commands already know their data shape. Use a helper:

```ts
// In list():
out(result, {
  rows: result.markets || [],
  columns: [
    { key: "shortQuestion", label: "Question", format: (v) => truncate(v, 34) },
    { key: "outcomePrices[1].currentPrice", label: "Yes", format: formatCents },
    { key: "outcomePrices[0].currentPrice", label: "No", format: formatCents },
    { key: "volume", label: "Volume", format: formatMoney },
    { key: "status", label: "Status", format: (v) => String(v ?? "—") },
  ],
  numbered: true,
  emptyMessage: "No markets found.",
  cursor: result.cursor || null,
});
```

Add `rows` to the `TableConfig` interface — this is the array to render in table mode while the full `data` object goes to JSON mode.

Update `src/ui/output.ts` `TableConfig`:

```ts
export interface TableConfig {
  /** Rows to render in table mode (full data object always used for JSON) */
  rows?: Record<string, unknown>[];
  // ... rest unchanged
}
```

And update the table mode rendering in `out()`:

```ts
if (config.columns) {
  const items = config.rows || (Array.isArray(data) ? data : [data]);
  // ... rest same
}
```

**Step 2: Update `get` to use detail table**

```ts
import { formatCents, formatMoney, formatAddress, formatDate } from "../ui/format.js";

// In get():
const m = market as any;
out(market, {
  detail: [
    ["ID", String(m.id || "—")],
    ["Question", String(m.question || m.shortQuestion || "—")],
    ["Status", String(m.status || "—")],
    ["Yes", m.outcomePrices?.[1] ? `${formatCents(m.outcomePrices[1].bestBid)} bid / ${formatCents(m.outcomePrices[1].bestAsk)} ask` : "—"],
    ["No", m.outcomePrices?.[0] ? `${formatCents(m.outcomePrices[0].bestBid)} bid / ${formatCents(m.outcomePrices[0].bestAsk)} ask` : "—"],
    ["Volume", formatMoney(m.volume)],
    ["24h Volume", formatMoney(m.volume24h)],
    ["Participants", String(m.participantCount ?? "—")],
    ["Deadline", formatDate(m.deadline)],
    ["Creator", formatAddress(m.metadata?.creator || m.creator)],
  ],
});
```

**Step 3: Update `quotes` to use detail table**

```ts
// In quotes():
const q = result as any;
out(result, {
  detail: [
    ["Market", String(q.marketId || "—")],
    ["Yes", `${formatCents(q.yes?.bid)} bid / ${formatCents(q.yes?.ask)} ask / ${formatCents(q.yes?.last)} last`],
    ["No", `${formatCents(q.no?.bid)} bid / ${formatCents(q.no?.ask)} ask / ${formatCents(q.no?.last)} last`],
    ["Spread", q.spread != null ? `${q.spread}¢` : "—"],
  ],
});
```

**Step 4: Update remaining markets subcommands**

Apply similar patterns to `orderbook`, `simulate`, `activity`, `global-activity`, `oracle`, `oracle-quotes`, `price-history`. Each gets a `detail` or `columns` config. For commands where the data shape is complex or variable, just let `out(data)` fall through to JSON even in table mode — we can iterate later.

**Step 5: Type check and verify**

Run: `bunx tsc --noEmit`
Expected: No new errors

**Step 6: Commit**

```bash
git add src/commands/markets.ts src/ui/output.ts
git commit -m "Add table output to markets command (list, get, quotes)"
```

---

### Task 6: Update Orders Command for Table Output

**Files:**
- Modify: `src/commands/orders.ts`

**Step 1: Update `list` and `mine` with column configs**

```ts
import { formatCents, formatMoney, formatAddress, truncate } from "../ui/format.js";

// In list() and mine():
out(result, {
  rows: result.orders || [],
  columns: [
    { key: "nonce", label: "Nonce", format: (v) => truncate(v, 14) },
    { key: "marketId", label: "Market", format: (v) => truncate(v, 14) },
    { key: "side", label: "Side", format: (v) => String(v ?? "—").toUpperCase() },
    { key: "outcomeIndex", label: "Outcome", format: (v) => v === 1 ? "YES" : "NO" },
    { key: "price", label: "Price", format: formatCents },
    { key: "size", label: "Size" },
    { key: "status", label: "Status" },
    { key: "percentFilled", label: "Filled", format: (v) => v != null ? `${v}%` : "—" },
  ],
  numbered: true,
  emptyMessage: "No orders found.",
  cursor: result.cursor || null,
});
```

**Step 2: Update `get` with detail table**

```ts
// In get():
const o = order as any;
out(order, {
  detail: [
    ["Nonce", String(o.nonce || "—")],
    ["Market", String(o.marketId || "—")],
    ["Status", String(o.status || "—")],
    ["Side", String(o.side ?? "—").toUpperCase()],
    ["Outcome", o.outcomeIndex === 1 ? "YES" : "NO"],
    ["Price", formatCents(o.price)],
    ["Size", String(o.size || "—")],
    ["Filled", o.percentFilled != null ? `${o.percentFilled}%` : "—"],
    ["Trader", formatAddress(o.trader)],
    ["Created", formatDate(o.insertedAt)],
  ],
});
```

where `formatDate` is imported from `../ui/format.js`.

**Step 3: Update `create` and `marketOrder` — show result as detail**

```ts
// In create():
const r = result as any;
out(result, {
  detail: [
    ["Status", r.success ? "✓ Order placed" : "✗ Failed"],
    ["Nonce", String(r.order?.nonce || "—")],
    ["Market", String(r.order?.marketId || "—")],
    ["Type", String(r.order?.type || "—")],
    ["Status", String(r.order?.status || "—")],
    ["Filled", r.order?.percentFilled != null ? `${r.order.percentFilled}%` : "—"],
  ],
});
```

**Step 4: Type check**

Run: `bunx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/commands/orders.ts
git commit -m "Add table output to orders command"
```

---

### Task 7: Update Portfolio Command for Table Output

**Files:**
- Modify: `src/commands/portfolio.ts`

**Step 1: Update `getPortfolio` with columns**

```ts
import { formatCents, formatMoney, truncate } from "../ui/format.js";

// In getPortfolio():
out(result, {
  rows: result.portfolio || [],
  columns: [
    { key: "marketId", label: "Market", format: (v) => truncate(v, 14) },
    { key: "outcomeName", label: "Outcome" },
    { key: "balance", label: "Shares", format: formatMoney },
    { key: "netInvestment", label: "Invested", format: formatMoney },
    { key: "currentValue", label: "Value", format: formatMoney },
  ],
  numbered: true,
  emptyMessage: "No positions found.",
  cursor: result.cursor || null,
});
```

**Step 2: Update `balance` with detail table**

```ts
// In balance():
const b = result as any;
out(result, {
  detail: [
    ["Address", String(b.address || "—")],
    ["USDC Balance", formatMoney(b.usdc?.balance)],
    ["Settlement", formatMoney(b.usdc?.settlementBalance)],
    ["Wallet", formatMoney(b.usdc?.walletBalance)],
  ],
});
```

**Step 3: Update `stats`, `claimable`, `tokenBalance` similarly**

**Step 4: Type check and commit**

```bash
git add src/commands/portfolio.ts
git commit -m "Add table output to portfolio command"
```

---

### Task 8: Update Account Command for Table Output

**Files:**
- Modify: `src/commands/account.ts`

**Step 1: Update `status` with detail table**

```ts
import { formatMoney, formatAddress } from "../ui/format.js";

// In status():
const s = result as any;
out(result, {
  detail: [
    ["Address", String(s.address || "—")],
    ["ETH Balance", s.ethBalance || "—"],
    ["USDC Allowance", s.usdcAllowance ? "✓ Approved" : "✗ None"],
    ["Operator", s.isOperatorApproved ? "✓ Approved" : "✗ Not approved"],
    ["Needs Setup", s.needsApprovals ? "Yes — run `context setup`" : "No"],
  ],
});
```

**Step 2: Update `deposit`, `withdraw`, `mintTestUsdc`, `mintCompleteSets`, `burnCompleteSets` with detail tables showing tx hash and status**

```ts
// In deposit():
out({ status: "deposited", amount_usdc: amount, tx_hash: txHash }, {
  detail: [
    ["Status", "✓ Deposited"],
    ["Amount", formatMoney(amount)],
    ["Tx Hash", formatAddress(txHash)],
  ],
});
```

**Step 3: Type check and commit**

```bash
git add src/commands/account.ts
git commit -m "Add table output to account command"
```

---

### Task 9: Update Questions Command for Table Output

**Files:**
- Modify: `src/commands/questions.ts`

**Step 1: Update `submit` with detail table**

```ts
// In submit():
const r = result as any;
out(result, {
  detail: [
    ["Submission ID", String(r.id || r.submissionId || "—")],
    ["Status", String(r.status || "—")],
    ["Question", String(r.question || "—")],
  ],
});
```

**Step 2: Update `submitAndWait` — add a spinner using @clack/prompts**

```ts
import * as p from "@clack/prompts";
import { getOutputMode } from "../format.js";

// In submitAndWait():
if (getOutputMode() === "table") {
  const s = p.spinner();
  s.start("Submitting question and waiting for AI generation...");
  const result = await ctx.questions.submitAndWait(question, { ... });
  s.stop("Question processed!");
  // Then render detail table
} else {
  const result = await ctx.questions.submitAndWait(question, { ... });
  out(result);
}
```

**Step 3: Type check and commit**

```bash
git add src/commands/questions.ts
git commit -m "Add table output and spinner to questions command"
```

---

### Task 10: Create Trading Confirmations

**Files:**
- Create: `src/ui/prompt.ts`
- Modify: `src/commands/orders.ts` (add confirmations to `create`, `marketOrder`, `cancel`, `cancelReplace`)

**Step 1: Create the confirmation utility**

```ts
// src/ui/prompt.ts
import * as p from "@clack/prompts";
import chalk from "chalk";
import { getOutputMode } from "../format.js";

interface OrderSummary {
  market?: string;
  marketName?: string;
  side: string;
  outcome: string;
  price?: string;
  size?: string;
  estimatedCost?: string;
}

/**
 * Show order summary and ask for confirmation.
 * Auto-skips if: JSON mode, --yes flag, or non-TTY.
 */
export async function confirmOrder(
  summary: OrderSummary,
  flags: Record<string, string>,
): Promise<void> {
  if (getOutputMode() === "json" || flags["yes"] === "true" || !process.stdout.isTTY) {
    return;
  }

  console.log();
  console.log(chalk.bold("  Order Summary"));
  console.log(chalk.dim("  ─────────────"));
  if (summary.marketName) console.log(`  Market:  ${summary.marketName}`);
  else if (summary.market) console.log(`  Market:  ${summary.market}`);
  console.log(`  Side:    ${summary.side.toUpperCase()} ${summary.outcome.toUpperCase()}`);
  if (summary.price) console.log(`  Price:   ${summary.price}`);
  if (summary.size) console.log(`  Size:    ${summary.size} shares`);
  if (summary.estimatedCost) console.log(`  Cost:    ~${summary.estimatedCost}`);
  console.log();

  const confirmed = await p.confirm({
    message: "Place this order?",
  });

  if (p.isCancel(confirmed) || !confirmed) {
    console.log(chalk.dim("  Cancelled."));
    process.exit(0);
  }
}

/**
 * Generic confirmation for destructive actions.
 */
export async function confirmAction(
  message: string,
  flags: Record<string, string>,
): Promise<void> {
  if (getOutputMode() === "json" || flags["yes"] === "true" || !process.stdout.isTTY) {
    return;
  }

  const confirmed = await p.confirm({ message });

  if (p.isCancel(confirmed) || !confirmed) {
    console.log(chalk.dim("  Cancelled."));
    process.exit(0);
  }
}
```

**Step 2: Add confirmation to `orders create`**

In `src/commands/orders.ts`, update `create()`:

```ts
import { confirmOrder } from "../ui/prompt.js";
import { formatCents } from "../ui/format.js";

async function create(flags: Record<string, string>): Promise<void> {
  const usage = "context-cli orders create --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n>";
  const order = parsePlaceOrderFlags(flags, usage);

  await confirmOrder({
    market: order.marketId,
    side: order.side,
    outcome: order.outcome,
    price: formatCents(order.priceCents),
    size: String(order.size),
    estimatedCost: `$${((order.priceCents / 100) * order.size).toFixed(2)} USDC`,
  }, flags);

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.create(order);
  out(result);
}
```

**Step 3: Add confirmation to `cancel`, `marketOrder`, `cancelReplace`**

Same pattern — call `confirmAction` or `confirmOrder` before the SDK call.

**Step 4: Type check and commit**

```bash
git add src/ui/prompt.ts src/commands/orders.ts
git commit -m "Add trading confirmations with --yes bypass"
```

---

### Task 11: Create Interactive Setup Wizard

**Files:**
- Modify: `src/commands/setup.ts`

This replaces the current JSON-dump setup with a multi-step `@clack/prompts` wizard.

**Step 1: Rewrite the `setup` function**

```ts
import * as p from "@clack/prompts";
import chalk from "chalk";
import { getOutputMode } from "../format.js";

async function setup(flags: Record<string, string>): Promise<void> {
  const privateKey = flags["private-key"] ?? process.env.CONTEXT_PRIVATE_KEY;

  // JSON mode: keep existing behavior
  if (getOutputMode() === "json") {
    if (!privateKey) {
      const newKey = generatePrivateKey();
      const account = privateKeyToAccount(newKey);
      out({ status: "new_wallet", address: account.address, privateKey: newKey, nextSteps: [...] });
      return;
    }
    const ctx = tradingClient(flags as ClientFlags);
    const walletStatus = await ctx.account.status();
    out({ status: "existing_wallet", ...walletStatus });
    return;
  }

  // Table mode: interactive wizard
  p.intro(chalk.bold("Context Markets — Setup"));

  // Step 1: Wallet
  if (privateKey) {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    p.log.success(`Wallet detected from ${flags["private-key"] ? "--private-key flag" : "CONTEXT_PRIVATE_KEY env"}`);
    p.log.info(`Address: ${account.address}`);
  } else {
    const hasKey = await p.select({
      message: "Do you have an existing private key?",
      options: [
        { value: false, label: "No, generate one" },
        { value: true, label: "Yes, import one" },
      ],
    });

    if (p.isCancel(hasKey)) { p.outro("Setup cancelled."); process.exit(0); }

    if (hasKey) {
      const key = await p.text({
        message: "Enter your private key:",
        placeholder: "0x...",
        validate: (v) => {
          if (!v.startsWith("0x") || v.length !== 66) return "Invalid private key format";
        },
      });
      if (p.isCancel(key)) { p.outro("Setup cancelled."); process.exit(0); }

      const account = privateKeyToAccount(key as `0x${string}`);
      p.log.success(`Wallet imported`);
      p.log.info(`Address: ${account.address}`);
      p.log.warning(`Set your key: export CONTEXT_PRIVATE_KEY="${key}"`);
    } else {
      const newKey = generatePrivateKey();
      const account = privateKeyToAccount(newKey);
      p.log.success(`Wallet created`);
      p.log.info(`Address: ${account.address}`);
      p.log.warning(`Back up your private key! It cannot be recovered.`);
      p.log.info(`export CONTEXT_PRIVATE_KEY="${newKey}"`);
    }

    p.outro("Set your CONTEXT_PRIVATE_KEY and re-run `context setup` to continue.");
    return;
  }

  // Step 2: Check account status
  const ctx = tradingClient(flags as ClientFlags);
  const status = await ctx.account.status();

  if (status.needsApprovals) {
    const doApprove = await p.confirm({
      message: "Approve contracts for trading? (gasless)",
    });
    if (!p.isCancel(doApprove) && doApprove) {
      const s = p.spinner();
      s.start("Approving contracts...");
      await ctx.account.gaslessSetup();
      s.stop("✓ Contracts approved");
    }
  } else {
    p.log.success("Contracts already approved");
  }

  // Step 3: Mint test USDC
  const doMint = await p.confirm({
    message: "Mint test USDC? (1000 USDC)",
  });
  if (!p.isCancel(doMint) && doMint) {
    const s = p.spinner();
    s.start("Minting test USDC...");
    await ctx.account.mintTestUsdc(1000);
    s.stop("✓ Minted 1,000 USDC");
  }

  // Step 4: Deposit
  const doDeposit = await p.confirm({
    message: "Deposit USDC to start trading?",
  });
  if (!p.isCancel(doDeposit) && doDeposit) {
    const amount = await p.text({
      message: "Enter amount to deposit:",
      placeholder: "500",
      validate: (v) => {
        const n = parseFloat(v);
        if (isNaN(n) || n <= 0) return "Must be a positive number";
      },
    });
    if (!p.isCancel(amount)) {
      const s = p.spinner();
      s.start("Depositing USDC...");
      await ctx.account.gaslessDeposit(parseFloat(amount as string));
      s.stop(`✓ Deposited $${parseFloat(amount as string).toFixed(2)} USDC`);
    }
  }

  p.outro(chalk.green("Setup complete! You're ready to trade."));
  console.log();
  console.log(chalk.dim("  Next steps:"));
  console.log(chalk.dim("    context markets list          Browse markets"));
  console.log(chalk.dim("    context guides trading        Learn to trade"));
  console.log(chalk.dim("    context shell                 Interactive mode"));
  console.log();
}
```

**Step 2: Type check**

Run: `bunx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/commands/setup.ts
git commit -m "Replace JSON setup with interactive wizard using @clack/prompts"
```

---

### Task 12: Create Guides Command

**Files:**
- Create: `src/commands/guides.ts`

**Step 1: Implement the guides command**

```ts
// src/commands/guides.ts
import { readFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import chalk from "chalk";
import { fail, type ParsedArgs } from "../format.js";

const SKILLS_DIR = join(import.meta.dir, "../../skills");

/** Map of guide slug → { title, description, file } */
function loadGuideIndex(): Map<string, { title: string; description: string; file: string }> {
  const guides = new Map();
  let files: string[];
  try {
    files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return guides;
  }

  for (const file of files) {
    const slug = basename(file, ".md");
    const content = readFileSync(join(SKILLS_DIR, file), "utf-8");
    // Extract description from frontmatter
    const descMatch = content.match(/^description:\s*(.+)$/m);
    const description = descMatch ? descMatch[1].trim() : "";
    guides.set(slug, { title: slug, description, file });
  }
  return guides;
}

/** Render markdown with minimal chalk formatting */
function renderMarkdown(content: string): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let inFrontmatter = false;
  let inCodeBlock = false;

  for (const line of lines) {
    // Skip frontmatter
    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;

    // Code blocks
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        output.push(chalk.dim("  ┌─────────────────────────────────────"));
      } else {
        output.push(chalk.dim("  └─────────────────────────────────────"));
      }
      continue;
    }

    if (inCodeBlock) {
      output.push(chalk.dim("  │ ") + line);
      continue;
    }

    // Headers
    if (line.startsWith("# ")) {
      output.push("");
      output.push(chalk.bold(line.slice(2)));
      output.push("");
      continue;
    }
    if (line.startsWith("## ")) {
      output.push("");
      output.push(chalk.bold(line.slice(3)));
      output.push(chalk.dim("─".repeat(line.length - 3)));
      continue;
    }
    if (line.startsWith("### ")) {
      output.push("");
      output.push(chalk.bold.dim(line.slice(4)));
      continue;
    }

    // Regular text
    output.push(line);
  }

  return output.join("\n");
}

export default async function handleGuides(parsed: ParsedArgs): Promise<void> {
  const topic = parsed.subcommand;
  const guides = loadGuideIndex();

  if (!topic) {
    // List all guides
    console.log();
    console.log(chalk.bold("  Available Guides"));
    console.log(chalk.dim("  ────────────────"));
    console.log();
    for (const [slug, info] of guides) {
      console.log(`  ${chalk.bold(slug.padEnd(20))} ${chalk.dim(info.description)}`);
    }
    console.log();
    console.log(chalk.dim("  Usage: context guides <topic>"));
    console.log();
    return;
  }

  const guide = guides.get(topic);
  if (!guide) {
    fail(`Unknown guide: "${topic}". Run "context guides" to see available guides.`);
  }

  const content = readFileSync(join(SKILLS_DIR, guide.file), "utf-8");
  console.log(renderMarkdown(content));
}
```

**Step 2: Wire into `cli.ts`**

Add case to the switch in `main()`:

```ts
case "guides": {
  const mod = await import("./commands/guides.js");
  await mod.default(parsed);
  break;
}
```

**Step 3: Type check and commit**

```bash
git add src/commands/guides.ts src/cli.ts
git commit -m "Add guides command that renders skill docs in terminal"
```

---

### Task 13: Create REPL Shell

**Files:**
- Create: `src/shell.ts`

**Step 1: Implement the shell**

```ts
// src/shell.ts
import * as readline from "readline";
import chalk from "chalk";
import { parseArgs, setOutputMode } from "./format.js";

/** Last result set for #N references */
let lastResults: Record<string, unknown>[] = [];
let lastCursor: string | null = null;
let lastCommand: string | null = null;

/** Store results from the last list command for #N references */
export function setLastResults(results: Record<string, unknown>[], cursor?: string | null): void {
  lastResults = results;
  lastCursor = cursor || null;
}

/** Resolve #N to the ID from the last result set */
function resolveRefs(input: string): string {
  return input.replace(/#(\d+)/g, (match, num) => {
    const idx = parseInt(num, 10) - 1;
    const item = lastResults[idx];
    if (!item) return match;
    // Try common ID fields
    const id = item.id || item.marketId || item.nonce;
    return id ? String(id) : match;
  });
}

/** Split input respecting quoted strings */
function splitArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

export async function runShell(): Promise<void> {
  console.log();
  console.log(chalk.bold("  Context Markets · Interactive Shell"));
  console.log(chalk.dim("  Type 'help' for commands, 'exit' to quit."));
  console.log();

  // Force table mode in shell
  setOutputMode({ output: "table" });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.dim("context> "),
    terminal: true,
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed === "exit" || trimmed === "quit") {
      console.log(chalk.dim("Goodbye!"));
      rl.close();
      process.exit(0);
    }

    if (trimmed === "help") {
      console.log();
      console.log(chalk.bold("  Commands:"));
      console.log("    markets <subcommand>     Browse and search markets");
      console.log("    orders <subcommand>      Manage orders");
      console.log("    portfolio <subcommand>   View positions and balances");
      console.log("    account <subcommand>     Wallet and account operations");
      console.log("    questions <subcommand>   Submit questions for AI markets");
      console.log("    guides [topic]           View usage guides");
      console.log();
      console.log(chalk.bold("  Shell features:"));
      console.log("    #N                       Reference row N from last result");
      console.log("    next                     Load next page of last result");
      console.log("    exit / quit              Leave the shell");
      console.log();
      rl.prompt();
      return;
    }

    // Handle "next" — re-run last command with cursor
    let commandLine = trimmed;
    if (trimmed === "next") {
      if (!lastCommand || !lastCursor) {
        console.log(chalk.dim("  No previous paginated result."));
        rl.prompt();
        return;
      }
      commandLine = `${lastCommand} --cursor ${lastCursor}`;
    }

    // Resolve #N references
    commandLine = resolveRefs(commandLine);

    // Block certain commands in shell
    if (commandLine.startsWith("setup")) {
      console.log(chalk.dim("  Run 'context setup' outside the shell."));
      rl.prompt();
      return;
    }
    if (commandLine.startsWith("shell")) {
      console.log(chalk.dim("  Already in shell mode."));
      rl.prompt();
      return;
    }

    // Parse and execute
    // Prepend dummy args to match parseArgs expectation (bun + script)
    const argv = ["bun", "cli.ts", ...splitArgs(commandLine)];
    const parsed = parseArgs(argv);

    // Save command for "next"
    lastCommand = commandLine.replace(/\s+--cursor\s+\S+/g, "");

    try {
      switch (parsed.command) {
        case "markets": {
          const mod = await import("./commands/markets.js");
          await mod.default(parsed);
          break;
        }
        case "orders": {
          const mod = await import("./commands/orders.js");
          await mod.default(parsed);
          break;
        }
        case "portfolio": {
          const mod = await import("./commands/portfolio.js");
          await mod.default(parsed);
          break;
        }
        case "account": {
          const mod = await import("./commands/account.js");
          await mod.default(parsed);
          break;
        }
        case "questions": {
          const mod = await import("./commands/questions.js");
          await mod.default(parsed);
          break;
        }
        case "guides": {
          const mod = await import("./commands/guides.js");
          await mod.default(parsed);
          break;
        }
        default:
          console.log(chalk.dim(`  Unknown command: "${parsed.command}". Type 'help' for commands.`));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`  Error: ${message}`));
    }

    console.log();
    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
```

**Step 2: Hook `setLastResults` into the output system**

In `src/ui/output.ts`, after rendering a table with numbered rows, call `setLastResults`:

```ts
// At top of out() function, when rendering numbered table:
if (config.numbered) {
  // Lazy import to avoid circular deps
  import("../shell.js").then((shell) => {
    shell.setLastResults(items, config.cursor);
  }).catch(() => {}); // silently fail if not in shell
}
```

Actually, better approach: have shell set a callback. Add to output.ts:

```ts
let _onResults: ((items: Record<string, unknown>[], cursor?: string | null) => void) | null = null;

export function onResults(cb: typeof _onResults): void {
  _onResults = cb;
}

// In out(), after rendering numbered table:
if (config.numbered && _onResults) {
  _onResults(items, config.cursor);
}
```

Then in shell.ts:

```ts
import { onResults } from "./ui/output.js";

// In runShell():
onResults((items, cursor) => {
  lastResults = items;
  lastCursor = cursor || null;
});
```

**Step 3: Wire into `cli.ts`**

Add case:

```ts
case "shell": {
  const { runShell } = await import("./shell.js");
  await runShell();
  break;
}
```

**Step 4: Type check and commit**

```bash
git add src/shell.ts src/ui/output.ts src/cli.ts
git commit -m "Add interactive REPL shell with #N references and pagination"
```

---

### Task 14: Update Help Text and CLI Entry Point

**Files:**
- Modify: `src/cli.ts`

**Step 1: Update HELP_TEXT to include new commands and options**

```ts
const HELP_TEXT = `Usage: context <command> [subcommand] [options]

Commands:
  markets                         Browse and search prediction markets
  orders                          Manage orders (create, cancel, list)
  portfolio                       View positions and balances
  account                         Wallet status, deposits, withdrawals
  questions                       Submit questions for AI market generation
  guides [topic]                  View usage guides
  shell                           Interactive mode

Onboarding:
  setup                           Guided wallet setup wizard

Options:
  -o, --output <table|json>       Output format (auto-detects TTY)
  --api-key <key>                 Context API key (or CONTEXT_API_KEY env)
  --private-key <key>             Private key (or CONTEXT_PRIVATE_KEY env)
  --yes                           Skip confirmations (for automation)

Run "context help" for this message, or "context <command> help" for details.`;
```

**Step 2: Clean up the setup command routing**

The old top-level `approve`, `deposit`, `gasless-approve`, `gasless-deposit` commands should still work but are now secondary to the unified `context setup` wizard. Keep them for backwards compatibility.

**Step 3: Type check**

Run: `bunx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "Update help text with new commands and output options"
```

---

### Task 15: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md to reflect the new dual-mode output**

Add/update the Key Conventions section:

- Update "All output is JSON" → "Default output is human-readable tables in TTY, JSON when piped. Use `-o json` to force JSON."
- Add `--yes` flag documentation
- Add `shell` and `guides` commands
- Update example commands

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md for UX redesign"
```

---

### Task 16: Manual Testing Checklist

Run these commands and verify the output looks correct:

```bash
# Table mode (in terminal)
bun src/cli.ts markets list --query "bitcoin" --limit 5
bun src/cli.ts markets get <some-id>
bun src/cli.ts markets quotes <some-id>
bun src/cli.ts portfolio balance
bun src/cli.ts account status
bun src/cli.ts guides
bun src/cli.ts guides trading

# JSON mode (piped)
bun src/cli.ts markets list --query "bitcoin" | cat
bun src/cli.ts markets list -o json

# Interactive
bun src/cli.ts setup
bun src/cli.ts shell

# Confirmations
bun src/cli.ts orders create --market <id> --outcome yes --side buy --price 50 --size 5
bun src/cli.ts orders create --market <id> --outcome yes --side buy --price 50 --size 5 --yes
```
