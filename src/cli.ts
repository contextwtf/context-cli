#!/usr/bin/env node

// ---------------------------------------------------------------------------
// context-cli — CLI wrapper for context-markets
// ---------------------------------------------------------------------------

import { parseArgs, fail, setOutputMode, getOutputMode } from "./format.js";
import { printFail } from "./ui/output.js";
import { cleanErrorMessage } from "./error.js";
import chalk from "chalk";

const HELP_TEXT = `Usage: context <command> [subcommand] [options]

Commands:
  markets                         Browse and search prediction markets
  orders                          Manage orders (create, cancel, list)
  portfolio                       View positions and balances
  account                         Wallet status, deposits, withdrawals
  questions                       Submit questions for AI market generation
  guides [topic]                  View usage guides
  ecosystem                       Show ecosystem repos and links
  shell                           Interactive mode

Onboarding:
  setup                           Guided wallet setup wizard
  approve                         Approve contracts for trading
  deposit <amount>                Deposit USDC into the exchange

Options:
  -o, --output <table|json>       Output format (auto-detects TTY)
  --api-key <key>                 Context API key
  --private-key <key>             Private key for trading
  --rpc-url <url>                 Custom RPC URL
  --chain <chain>                 Target chain (default: mainnet)
  --yes                           Skip confirmations (for automation)
  --help                          Show help for a command

Config:
  Credentials are loaded from (highest priority first):
    1. CLI flags (--api-key, --private-key)
    2. Environment variables (CONTEXT_API_KEY, CONTEXT_PRIVATE_KEY)
    3. Config file (~/.config/context/config.env)

  Run "context setup" to create a wallet and save credentials automatically.

Run "context <command> help" or "context <command> --help" for command details.`;

async function main() {
  const parsed = parseArgs(process.argv);
  setOutputMode(parsed.flags);

  // "context --help" → parseArgs sets command to "--help", fix it
  if (parsed.command === "--help" || parsed.command === "-h") {
    parsed.command = "help";
  }

  // --help flag on any command → treat as "context <command> help"
  if (parsed.flags["help"] === "true") {
    if (parsed.command === "help") {
      console.log(HELP_TEXT);
      return;
    }
    parsed.subcommand = "help";
  }

  // Default to shell mode when no command and running in a TTY
  if (
    parsed.command === "help" &&
    parsed.positional.length === 0 &&
    process.argv.slice(2).length === 0 &&
    process.stdout.isTTY &&
    process.stdin.isTTY
  ) {
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

      case "gasless-approve":
      case "gasless-deposit": {
        // Redirect to account subcommands
        const gaslessSubcmd = parsed.command;
        parsed.command = "account";
        parsed.subcommand = gaslessSubcmd;
        const accountMod = await import("./commands/account.js");
        await accountMod.default(parsed);
        break;
      }

      case "setup":
      case "approve":
      case "deposit": {
        // "context setup help" → show setup help, not run the wizard
        if (parsed.subcommand === "help" || parsed.flags["help"] === "true") {
          console.log(`Usage: context ${parsed.command} [options]

${parsed.command === "setup" ? "Guided wallet setup wizard. Generates or imports a wallet, approves contracts,\nand deposits — all in one step." :
  parsed.command === "approve" ? "Approve the operator and USDC allowance for on-chain trading." :
  "Deposit USDC into the exchange.\n\nUsage: context deposit <amount>"}

Options:
  --api-key <key>       Context API key
  --private-key <key>   Private key
  --chain <chain>       Target chain (default: mainnet)
  --yes                 Skip confirmations
  --save                Save wallet to config file (for --output json)
                       (always on in --output json mode)

Agent workflow (non-interactive):
  context setup --output json                  Generate wallet, save to config
  context approve --output json                Approve contracts
  context deposit <amount> --output json       Deposit USDC`);
          break;
        }
        const mod = await import("./commands/setup.js");
        // Preserve the original subcommand as a positional arg (e.g. "deposit 100" → positional: ["100"])
        const positional = parsed.subcommand
          ? [parsed.subcommand, ...parsed.positional]
          : parsed.positional;
        await mod.default({ ...parsed, subcommand: parsed.command, positional });
        break;
      }

      case "ecosystem": {
        console.log(`
${chalk.bold("Context Markets Ecosystem")}
${chalk.dim("────────────────────────────")}

  ${chalk.bold("SDK")}             TypeScript SDK for Context Markets
                    ${chalk.cyan("https://github.com/contextwtf/context-sdk")}
                    ${chalk.dim("npm: context-markets")}

  ${chalk.bold("CLI")}             Command-line interface (this tool)
                    ${chalk.cyan("https://github.com/contextwtf/context-cli")}
                    ${chalk.dim("npm: context-markets-cli")}

  ${chalk.bold("MCP Server")}      Model Context Protocol server for AI agents
                    ${chalk.cyan("https://github.com/contextwtf/context-mcp")}
                    ${chalk.dim("npm: context-markets-mcp")}

  ${chalk.bold("React")}           React hooks and components
                    ${chalk.cyan("https://github.com/contextwtf/context-react")}
                    ${chalk.dim("npm: context-markets-react")}

  ${chalk.bold("Skills")}          Agent skills and prompt templates
                    ${chalk.cyan("https://github.com/contextwtf/context-skills")}

  ${chalk.bold("Docs")}            ${chalk.cyan("https://docs.context.markets")}
`);
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
