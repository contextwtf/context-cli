// ---------------------------------------------------------------------------
// Shared output utilities for context-cli
// ---------------------------------------------------------------------------

/** BigInt-safe JSON replacer */
const replacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

/** Print JSON to stdout */
export function out(data: unknown): void {
  console.log(JSON.stringify(data, replacer, 2));
}

/** Print JSON error to stderr and exit */
export function fail(message: string, details?: unknown): never {
  const payload: Record<string, unknown> = { error: message };
  if (details !== undefined) {
    payload.details = details;
  }
  console.error(JSON.stringify(payload, replacer, 2));
  process.exit(1);
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
