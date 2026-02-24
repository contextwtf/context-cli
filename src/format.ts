// ---------------------------------------------------------------------------
// Shared output utilities for context-cli
// ---------------------------------------------------------------------------

import {
  resolveOutputMode,
  printOut,
  printFail,
  type OutputMode,
  type TableConfig,
} from "./ui/output.js";

export type { TableConfig } from "./ui/output.js";

/** BigInt-safe JSON replacer (kept for backward compat if anything imports it) */
const replacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

let _mode: OutputMode = "json";

/** Set the global output mode (called once in cli.ts) */
export function setOutputMode(flags: Record<string, string>): void {
  _mode = resolveOutputMode(flags);
}

/** Get the current output mode */
export function getOutputMode(): OutputMode {
  return _mode;
}

/** Print output (dual-mode: table or JSON based on global mode) */
export function out(data: unknown, config?: TableConfig): void {
  printOut(data, _mode, config);
}

/** Print error and exit (dual-mode) */
export function fail(message: string, details?: unknown): never {
  printFail(message, _mode, details);
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  command: string;
  subcommand: string | undefined;
  positional: string[];
  flags: Record<string, string>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip bun + script path
  const command = args[0] ?? "help";
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        // --key=value
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
        i += 1;
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[key] = next;
          i += 2;
        } else {
          flags[key] = "true";
          i += 1;
        }
      }
    } else if (arg === "-o" && i + 1 < args.length) {
      flags["output"] = args[i + 1];
      i += 2;
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  const subcommand = positional.length > 0 ? positional.shift() : undefined;

  return { command, subcommand, positional, flags };
}

// ---------------------------------------------------------------------------
// Requirement helpers
// ---------------------------------------------------------------------------

/** Require a flag or fail with usage message */
export function requireFlag(
  flags: Record<string, string>,
  key: string,
  usage: string,
): string {
  const value = flags[key];
  if (!value || value === "true") {
    fail(`Missing required flag: --${key}`, { usage });
  }
  return value;
}

/** Require a positional argument or fail with usage message */
export function requirePositional(
  positional: string[],
  index: number,
  name: string,
  usage: string,
): string {
  const value = positional[index];
  if (!value) {
    fail(`Missing required argument: <${name}>`, { usage });
  }
  return value;
}
