import * as readline from "readline";
import chalk from "chalk";
import { parseArgs, setOutputMode } from "./format.js";
import { onResults } from "./ui/output.js";
import { setShellReadline } from "./ui/prompt.js";

let lastResults: Record<string, unknown>[] = [];
let lastCursor: string | null = null;
let lastCommand: string | null = null;
let cursorHistory: string[] = []; // stack of previous cursors for "back"

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

const BANNER = [
  "  ██████╗  ██████╗  ███╗   ██╗ ████████╗ ███████╗ ██╗  ██╗ ████████╗",
  " ██╔════╝ ██╔═══██╗ ████╗  ██║ ╚══██╔══╝ ██╔════╝ ╚██╗██╔╝ ╚══██╔══╝",
  " ██║      ██║   ██║ ██╔██╗ ██║    ██║    █████╗    ╚███╔╝     ██║   ",
  " ██║      ██║   ██║ ██║╚██╗██║    ██║    ██╔══╝    ██╔██╗     ██║   ",
  " ╚██████╗ ╚██████╔╝ ██║ ╚████║    ██║    ███████╗ ██╔╝ ██╗    ██║   ",
  "  ╚═════╝  ╚═════╝  ╚═╝  ╚═══╝    ╚═╝    ╚══════╝ ╚═╝  ╚═╝    ╚═╝   ",
];

const GRADIENT = [
  "#a78bfa", // violet-400
  "#818cf8", // indigo-400
  "#6366f1", // indigo-500
  "#4f46e5", // indigo-600
  "#4338ca", // indigo-700
  "#3730a3", // indigo-800
];

export async function runShell(): Promise<void> {
  console.log();
  for (let i = 0; i < BANNER.length; i++) {
    console.log(chalk.hex(GRADIENT[i])(BANNER[i]));
  }
  console.log();
  console.log(chalk.bold("  Prediction Markets") + chalk.dim("  ·  Interactive Shell"));
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

  // Share readline with prompt.ts so confirms don't create a second interface
  setShellReadline(rl);

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
      console.log("    ecosystem                Show ecosystem repos and links");
      console.log();
      console.log(chalk.bold("  Shell features:"));
      console.log("    #N                       Reference row N from last result");
      console.log("    next                     Load next page of last result");
      console.log("    back                     Go back to previous page");
      console.log("    exit / quit              Leave the shell");
      console.log();
      rl.prompt();
      return;
    }

    // Handle "next" and "back"
    let commandLine = trimmed;
    if (trimmed === "next") {
      if (!lastCommand || !lastCursor) {
        console.log(chalk.dim("  No previous paginated result."));
        rl.prompt();
        return;
      }
      // Push current cursor onto history before advancing
      const currentCursor = commandLine.match(/--cursor\s+(\S+)/)?.[1];
      if (currentCursor) cursorHistory.push(currentCursor);
      else if (lastCursor) cursorHistory.push("__first__"); // mark first page
      commandLine = `${lastCommand} --cursor ${lastCursor}`;
    } else if (trimmed === "back" || trimmed === "prev") {
      if (!lastCommand || cursorHistory.length === 0) {
        console.log(chalk.dim("  No previous page."));
        rl.prompt();
        return;
      }
      const prevCursor = cursorHistory.pop()!;
      if (prevCursor === "__first__") {
        commandLine = lastCommand;
      } else {
        commandLine = `${lastCommand} --cursor ${prevCursor}`;
      }
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
    const baseCommand = commandLine.replace(/\s+--cursor\s+\S+/g, "");
    if (baseCommand !== lastCommand) {
      // New command — reset pagination history
      cursorHistory = [];
    }
    lastCommand = baseCommand;

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
        case "ecosystem": {
          // Re-use the same inline display from cli.ts
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
        default:
          console.log(
            chalk.dim(
              `  Unknown command: "${parsed.command}". Type 'help' for commands.`,
            ),
          );
      }
    } catch (err: unknown) {
      // CancelError: user cancelled a prompt — already printed
      // FailError: validation error — already printed by fail()
      if (err instanceof Error && (err.name === "CancelError" || err.name === "FailError")) {
        // Already handled, just return to prompt
      } else {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`  Error: ${message}`));
      }
    }

    console.log();
    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
