import * as readline from "readline";
import chalk from "chalk";
import { parseArgs, setOutputMode } from "./format.js";
import { onResults } from "./ui/output.js";

let lastResults: Record<string, unknown>[] = [];
let lastCursor: string | null = null;
let lastCommand: string | null = null;

/** Resolve #N to the ID from the last result set */
function resolveRefs(input: string): string {
  return input.replace(/#(\d+)/g, (match, num) => {
    const idx = parseInt(num, 10) - 1;
    const item = lastResults[idx];
    if (!item) return match;
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
  console.log(chalk.bold("  Context Markets \u00b7 Interactive Shell"));
  console.log(chalk.dim("  Type 'help' for commands, 'exit' to quit."));
  console.log();

  // Force table mode in shell
  setOutputMode({ output: "table" });

  // Track results for #N references
  onResults((items, cursor) => {
    lastResults = items;
    lastCursor = cursor || null;
  });

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

    // Handle "next"
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

    // Block certain commands
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

    // Save command for "next" (strip existing cursor)
    lastCommand = commandLine.replace(/\s+--cursor\s+\S+/g, "");

    // Parse: prepend dummy args to match parseArgs expectation
    const argv = ["bun", "cli.ts", ...splitArgs(commandLine)];
    const parsed = parseArgs(argv);

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
          console.log(
            chalk.dim(
              `  Unknown command: "${parsed.command}". Type 'help' for commands.`,
            ),
          );
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
