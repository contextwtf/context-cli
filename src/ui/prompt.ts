// ---------------------------------------------------------------------------
// Trading confirmation prompts — skipped in JSON mode, --yes, or non-TTY
// ---------------------------------------------------------------------------

import * as p from "@clack/prompts";
import chalk from "chalk";
import { getOutputMode } from "../format.js";

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
