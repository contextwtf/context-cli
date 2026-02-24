// ---------------------------------------------------------------------------
// Table rendering utilities — rounded Unicode borders via cli-table3
// ---------------------------------------------------------------------------

import Table from "cli-table3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Column {
  /** Property key on row objects. Supports dot notation and array indexing,
   *  e.g. "outcomePrices[1].currentPrice" */
  key: string;
  /** Header label displayed in the table */
  label: string;
  /** Optional fixed column width (characters) */
  width?: number;
  /** Optional formatter applied to the resolved cell value */
  format?: (value: unknown) => string;
}

// ---------------------------------------------------------------------------
// Rounded Unicode border characters
// ---------------------------------------------------------------------------

const ROUNDED_CHARS: Record<string, string> = {
  top: "\u2500",
  "top-mid": "\u252C",
  "top-left": "\u256D",
  "top-right": "\u256E",
  bottom: "\u2500",
  "bottom-mid": "\u2534",
  "bottom-left": "\u2570",
  "bottom-right": "\u256F",
  left: "\u2502",
  "left-mid": "\u251C",
  mid: "\u2500",
  "mid-mid": "\u253C",
  right: "\u2502",
  "right-mid": "\u2524",
  middle: "\u2502",
};

// ---------------------------------------------------------------------------
// Deep value accessor
// ---------------------------------------------------------------------------

/**
 * Resolve a dot-notation / bracket-indexed path against an object.
 *
 * Examples:
 *   getByPath(obj, "name")                       -> obj.name
 *   getByPath(obj, "user.name")                  -> obj.user.name
 *   getByPath(obj, "items[0]")                   -> obj.items[0]
 *   getByPath(obj, "outcomePrices[1].currentPrice")
 */
function getByPath(obj: unknown, path: string): unknown {
  // Split "foo[0].bar[1].baz" into tokens: ["foo", "0", "bar", "1", "baz"]
  const tokens = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: unknown = obj;
  for (const token of tokens) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

// ---------------------------------------------------------------------------
// makeTable
// ---------------------------------------------------------------------------

/**
 * Render an array of objects as a rounded-border Unicode table string.
 *
 * @param data       Array of row objects
 * @param columns    Column definitions
 * @param emptyMessage  Returned when data is empty (default "No results.")
 * @param numbered   If true, prepend a `#` column with 1-based row numbers
 * @returns The rendered table as a string
 */
export function makeTable(
  data: Record<string, unknown>[],
  columns: Column[],
  emptyMessage?: string,
  numbered?: boolean,
): string {
  if (data.length === 0) {
    return emptyMessage ?? "No results.";
  }

  // Build head row and colWidths
  const head: string[] = [];
  const colWidths: (number | null)[] = [];

  if (numbered) {
    head.push("#");
    colWidths.push(null);
  }

  for (const col of columns) {
    head.push(col.label);
    colWidths.push(col.width ?? null);
  }

  const table = new Table({
    head,
    chars: ROUNDED_CHARS,
    colWidths,
    style: { head: [], border: [] },
  });

  for (let i = 0; i < data.length; i++) {
    const row: string[] = [];
    if (numbered) {
      row.push(String(i + 1));
    }
    for (const col of columns) {
      const raw = getByPath(data[i], col.key);
      if (col.format) {
        row.push(col.format(raw));
      } else {
        row.push(raw == null ? "" : String(raw));
      }
    }
    table.push(row);
  }

  return table.toString();
}

// ---------------------------------------------------------------------------
// makeDetailTable
// ---------------------------------------------------------------------------

/**
 * Render key-value pairs as a two-column rounded-border Unicode table.
 *
 * @param rows Array of [label, value] tuples
 * @returns The rendered table as a string
 */
export function makeDetailTable(rows: [string, string][]): string {
  const table = new Table({
    chars: ROUNDED_CHARS,
    style: { head: [], border: [] },
  });

  for (const [label, value] of rows) {
    table.push([label, value]);
  }

  return table.toString();
}
