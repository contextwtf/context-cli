#!/usr/bin/env node

// ---------------------------------------------------------------------------
// context-cli — CLI wrapper for @contextwtf/sdk
// ---------------------------------------------------------------------------

import { parseArgs, fail, setOutputMode, getOutputMode } from "./format.js";
import { printFail } from "./ui/output.js";

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
  approve                         Approve the operator for gasless trading
  deposit                         Deposit USDC into the exchange
  gasless-approve                 Gasless operator approval via relayer (no gas)
  gasless-deposit <amount>        Gasless USDC deposit via permit (no gas)

Options:
  -o, --output <table|json>       Output format (auto-detects TTY)
  --api-key <key>                 Context API key (or CONTEXT_API_KEY env)
  --private-key <key>             Private key (or CONTEXT_PRIVATE_KEY env)
  --rpc-url <url>                 Base Sepolia RPC URL (or CONTEXT_RPC_URL env)
  --yes                           Skip confirmations (for automation)

Run "context help" for this message, or "context <command> help" for details.`;

// ---------------------------------------------------------------------------
// Error message cleanup — sanitize raw SDK / zod / viem errors for display
// ---------------------------------------------------------------------------

/** Known EVM revert reason hex → human-readable message */
const REVERT_REASONS: Record<string, string> = {
  "5452414e534645525f46524f4d5f4641494c4544": "USDC transfer failed — insufficient wallet balance",
  "494e53554646494349454e545f42414c414e4345": "Insufficient balance",
  "4e4f545f415554484f52495a4544": "Not authorized",
};

function decodeRevertHex(hex: string): string | null {
  // Standard Solidity revert: 0x08c379a0 + offset + length + reason
  const match = hex.match(/08c379a0[0-9a-f]{128}([0-9a-f]+)/i);
  if (!match) return null;
  const reasonHex = match[1].replace(/0+$/, "");
  for (const [known, label] of Object.entries(REVERT_REASONS)) {
    if (reasonHex.toLowerCase().includes(known.toLowerCase())) return label;
  }
  // Try raw ASCII decode
  try {
    const bytes = Buffer.from(reasonHex, "hex");
    const text = bytes.toString("utf8").replace(/[^\x20-\x7E]/g, "");
    if (text.length > 2) return text;
  } catch { /* ignore */ }
  return null;
}

function cleanErrorMessage(raw: string): string {
  // Zod validation errors: "✖ Too big: expected number to be <=50\n  → at limit"
  const zodMatch = raw.match(/✖\s*(.+?)(?:\n\s*→\s*at\s+(\w+))?$/s);
  if (zodMatch) {
    const detail = zodMatch[1].trim();
    const field = zodMatch[2];
    return field ? `Invalid --${field}: ${detail}` : detail;
  }

  // viem "insufficient funds" errors — extract the actionable part
  if (raw.includes("exceeds the balance of the account")) {
    return "Insufficient ETH for gas. Fund your wallet with testnet ETH on Base Sepolia.";
  }

  // EVM revert with hex reason
  const revertMatch = raw.match(/reverted.*?reason:\s*(0x[0-9a-f]+)/i);
  if (revertMatch) {
    const decoded = decodeRevertHex(revertMatch[1]);
    if (decoded) return decoded;
  }

  // UserOperation revert (gasless)
  if (raw.includes("UserOperation reverted")) {
    const hexMatch = raw.match(/(0x[0-9a-f]{64,})/i);
    if (hexMatch) {
      const decoded = decodeRevertHex(hexMatch[1]);
      if (decoded) return decoded;
    }
    return "Transaction reverted — check your wallet balance and approvals.";
  }

  // viem verbose errors: strip docs/version/request details
  if (raw.includes("Docs: https://viem.sh") || raw.includes("Version: viem@")) {
    const detailsMatch = raw.match(/Details:\s*(.+?)(?:\n|$)/);
    if (detailsMatch) return detailsMatch[1].trim();
    // Fall back to first line
    return raw.split("\n")[0].trim();
  }

  return raw;
}

async function main() {
  const parsed = parseArgs(process.argv);
  setOutputMode(parsed.flags);

  // Default to shell mode when no command and running in a TTY
  if (parsed.command === "help" && process.stdout.isTTY && process.stdin.isTTY) {
    const { runShell } = await import("./shell.js");
    await runShell();
    return;
  }

  try {
    switch (parsed.command) {
      case "markets": {
        const mod = await import("./commands/markets.js");
        await mod.default(parsed);
        break;
      }

      case "questions": {
        const mod = await import("./commands/questions.js");
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

      case "setup":
      case "approve":
      case "deposit":
      case "gasless-approve":
      case "gasless-deposit": {
        const mod = await import("./commands/setup.js");
        // Preserve the original subcommand as a positional arg (e.g. "deposit 100" → positional: ["100"])
        const positional = parsed.subcommand
          ? [parsed.subcommand, ...parsed.positional]
          : parsed.positional;
        await mod.default({ ...parsed, subcommand: parsed.command, positional });
        break;
      }

      case "guides": {
        const mod = await import("./commands/guides.js");
        await mod.default(parsed);
        break;
      }

      case "shell": {
        const { runShell } = await import("./shell.js");
        await runShell();
        break;
      }

      case "help":
        console.log(HELP_TEXT);
        break;

      default:
        fail(`Unknown command: "${parsed.command}". Run "context help" for usage.`);
    }
  } catch (err: unknown) {
    // CancelError: user cancelled a prompt — exit silently
    if (err instanceof Error && err.name === "CancelError") {
      process.exit(0);
    }
    // FailError: already printed error message — just exit
    if (err instanceof Error && err.name === "FailError") {
      process.exit(1);
    }
    const raw = err instanceof Error ? err.message : String(err);
    const message = raw.includes("Cannot find module")
      ? `Command module not yet implemented: ${parsed.command}`
      : cleanErrorMessage(raw);
    // Use printFail + exit directly — calling fail() here would throw
    // a new FailError that escapes this catch block as an unhandled rejection.
    printFail(message, getOutputMode());
    process.exit(1);
  }
}

main();
