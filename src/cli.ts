#!/usr/bin/env bun

// ---------------------------------------------------------------------------
// context-cli — CLI wrapper for @contextwtf/sdk
// ---------------------------------------------------------------------------

import { parseArgs, fail, setOutputMode } from "./format.js";

const HELP_TEXT = `Usage: context-cli <command> [subcommand] [options]

Modules:
  markets                         Browse and search prediction markets
  questions                       Submit questions for AI market generation
  orders                          Manage orders (create, cancel, list)
  portfolio                       View positions and balances
  account                         Wallet status, operator approval, deposits

Onboarding:
  setup                           Check wallet status and fund if needed
  approve                         Approve the operator for gasless trading
  deposit                         Deposit USDC into the exchange
  gasless-approve                 Gasless operator approval via relayer (no gas)
  gasless-deposit <amount>        Gasless USDC deposit via permit (no gas)

Options:
  --api-key <key>                 Context API key (or CONTEXT_API_KEY env)
  --private-key <key>             Private key for signing (or CONTEXT_PRIVATE_KEY env)
  --rpc-url <url>                 Base Sepolia RPC URL (or CONTEXT_RPC_URL env)

Run "context-cli help" for this message, or "context-cli <module> help" for module-specific commands.`;

async function main() {
  const parsed = parseArgs(process.argv);
  setOutputMode(parsed.flags);

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

      case "help":
        console.log(HELP_TEXT);
        break;

      default:
        fail(`Unknown command: "${parsed.command}". Run "context-cli help" for usage.`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Cannot find module")) {
      fail(`Command module not yet implemented: ${parsed.command}`);
    }
    fail(message);
  }
}

main();
