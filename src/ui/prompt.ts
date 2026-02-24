// ---------------------------------------------------------------------------
// Trading confirmation prompts — skipped in JSON mode, --yes, or non-TTY
// ---------------------------------------------------------------------------

import * as readline from "readline";
import chalk from "chalk";
import { getOutputMode } from "../format.js";

/** Thrown when user cancels a confirmation prompt */
export class CancelError extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "CancelError";
  }
}

// ---------------------------------------------------------------------------
// Shared readline — set by shell.ts so confirm reuses the same interface
// ---------------------------------------------------------------------------

let _shellRl: readline.Interface | null = null;

export function setShellReadline(rl: readline.Interface | null): void {
  _shellRl = rl;
}

/**
 * Simple Y/n confirm. Reuses the shell readline if available,
 * otherwise creates a temporary one (CLI mode).
 */
function confirm(message: string): Promise<boolean> {
  const prompt = chalk.cyan(`  ? ${message} ${chalk.dim("(Y/n)")} `);

  if (_shellRl) {
    // Shell mode: use the existing readline (avoids stdin conflicts)
    return new Promise((resolve) => {
      _shellRl!.question(prompt, (answer) => {
        const trimmed = answer.trim().toLowerCase();
        resolve(trimmed === "" || trimmed === "y" || trimmed === "yes");
      });
    });
  }

  // CLI mode: create a temporary readline
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === "" || trimmed === "y" || trimmed === "yes");
    });
  });
}

interface OrderSummary {
  market?: string;
  side: string;
  outcome: string;
  price?: string;
  size?: string;
  estimatedCost?: string;
}

/**
 * Show order summary and ask for confirmation.
 * Auto-skips if: JSON mode, --yes flag, or non-TTY.
 * Throws CancelError if user declines (caught by shell or cli.ts).
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
  if (summary.market) console.log(`  Market:  ${summary.market}`);
  console.log(`  Side:    ${summary.side.toUpperCase()} ${summary.outcome.toUpperCase()}`);
  if (summary.price) console.log(`  Price:   ${summary.price}`);
  if (summary.size) console.log(`  Size:    ${summary.size} shares`);
  if (summary.estimatedCost) console.log(`  Cost:    ~${summary.estimatedCost}`);
  console.log();

  const confirmed = await confirm("Place this order?");

  if (!confirmed) {
    console.log(chalk.dim("  Cancelled."));
    throw new CancelError();
  }
}

/**
 * Generic confirmation for destructive actions.
 * Throws CancelError if user declines.
 */
export async function confirmAction(
  message: string,
  flags: Record<string, string>,
): Promise<void> {
  if (getOutputMode() === "json" || flags["yes"] === "true" || !process.stdout.isTTY) {
    return;
  }

  const confirmed = await confirm(message);

  if (!confirmed) {
    console.log(chalk.dim("  Cancelled."));
    throw new CancelError();
  }
}
