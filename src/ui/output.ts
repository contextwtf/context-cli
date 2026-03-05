// ---------------------------------------------------------------------------
// Dual-mode output system — auto-detects TTY for table vs JSON rendering
// ---------------------------------------------------------------------------

import chalk from "chalk";
import { makeTable, makeDetailTable, type Column } from "./table.js";

const replacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

export type OutputMode = "table" | "json";

export function resolveOutputMode(flags: Record<string, string>): OutputMode {
  const explicit = flags["output"] || flags["o"];
  if (explicit === "json") return "json";
  if (explicit === "table") return "table";
  return process.stdout.isTTY ? "table" : "json";
}

export interface TableConfig {
  rows?: Record<string, unknown>[];
  columns?: Column[];
  detail?: [string, string][];
  emptyMessage?: string;
  numbered?: boolean;
  cursor?: string | null;
  total?: number;
}

// Callback for shell to track results
let _onResults:
  | ((items: Record<string, unknown>[], cursor?: string | null) => void)
  | null = null;
export function onResults(cb: typeof _onResults): void {
  _onResults = cb;
}

export function printOut(
  data: unknown,
  mode: OutputMode,
  config?: TableConfig,
): void {
  if (mode === "json") {
    console.log(JSON.stringify(data, replacer, 2));
    return;
  }

  if (!config) {
    // Fallback: pretty-print JSON if no table config
    console.log(JSON.stringify(data, replacer, 2));
    return;
  }

  if (config.detail) {
    console.log(makeDetailTable(config.detail));
    return;
  }

  if (config.columns) {
    const items = config.rows ||
      ((Array.isArray(data) ? data : [data]) as Record<string, unknown>[]);
    console.log(
      makeTable(items, config.columns, config.emptyMessage, config.numbered),
    );

    if (config.numbered && _onResults) {
      _onResults(items, config.cursor);
    }

    if (config.cursor) {
      const showing = config.total
        ? `Showing ${items.length} of ${config.total}`
        : `Showing ${items.length}`;
      console.log(chalk.dim(`  ${showing} · Next: --cursor ${config.cursor}`));
    }
    return;
  }

  console.log(JSON.stringify(data, replacer, 2));
}

/** Thrown by fail() — caught by cli.ts (exits) and shell.ts (continues) */
export class FailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FailError";
  }
}

/**
 * Print an error message to stderr (does NOT throw).
 * Use `fail()` from format.ts when you also want to throw FailError.
 */
export function printFail(
  message: string,
  mode: OutputMode,
  details?: unknown,
): void {
  if (mode === "json") {
    const payload: Record<string, unknown> = { error: message };
    if (details !== undefined) payload.details = details;
    console.error(JSON.stringify(payload, replacer, 2));
  } else {
    console.error(chalk.red(`\u2717 ${message}`));
    if (
      details &&
      typeof details === "object" &&
      details !== null &&
      "usage" in details
    ) {
      console.error(
        chalk.dim(`  Usage: ${(details as Record<string, unknown>).usage}`),
      );
    }
  }
}
