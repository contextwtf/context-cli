# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

CLI for trading on Context prediction markets (Base Sepolia testnet). Dual-mode output: human-readable tables in TTY, JSON when piped. Built with Bun, no external CLI framework.

## Commands

```bash
# Run any command
bun src/cli.ts <command> [subcommand] [positional...] [--flag value]

# Force JSON output (for agents/scripting)
bun src/cli.ts markets list -o json

# Interactive setup wizard
bun src/cli.ts setup

# Interactive shell
bun src/cli.ts shell

# View guides
bun src/cli.ts guides trading

# Type check
bunx tsc --noEmit

# Run tests
bun test
```

## Architecture

**Runtime:** Bun (not Node). Uses `#!/usr/bin/env bun` shebang. Package manager is also Bun.

**Entry point:** `src/cli.ts` — dynamic import dispatcher that lazy-loads command modules via `await import()`. Sets output mode early via `setOutputMode(parsed.flags)`.

**Command modules** (`src/commands/`): Each file exports a default async function receiving `ParsedArgs`. Eight modules: `markets`, `orders`, `questions`, `portfolio`, `account`, `setup`, `guides`. Each handles its own subcommand routing and help text.

**Client factory** (`src/client.ts`): Two factories — `readClient(flags)` for read-only ops (needs `CONTEXT_API_KEY`) and `tradingClient(flags)` for signing/trading (also needs `CONTEXT_PRIVATE_KEY`). Flag values override env vars.

**Shared utilities** (`src/format.ts`): Custom arg parser (`parseArgs`), dual-mode output (`out`), error exit (`fail`), validation helpers (`requireFlag`, `requirePositional`), output mode management (`setOutputMode`, `getOutputMode`).

**UI layer** (`src/ui/`):
- `output.ts` — dual-mode rendering engine (`printOut`, `printFail`, `resolveOutputMode`)
- `table.ts` — rounded Unicode table rendering (`makeTable`, `makeDetailTable`)
- `format.ts` — number/address/date formatters (`formatCents`, `formatMoney`, `formatAddress`, `truncate`, `formatDate`)
- `prompt.ts` — trading confirmations (`confirmOrder`, `confirmAction`)

**REPL shell** (`src/shell.ts`): Interactive shell with readline, `#N` row references, and `next` pagination.

## Key Conventions

- **Dual-mode output.** Table by default in TTY, JSON when piped or with `-o json`. `out(data, config?)` for success, `fail(message, details?)` for errors.
- **Trading confirmations.** Orders/cancels show a summary and ask `Confirm? (Y/n)` in table mode. Skip with `--yes` or `-o json`.
- **No external CLI framework.** Custom `parseArgs()` handles `--key=value`, `--key value`, and `-o` shorthand.
- **BigInt values** are serialized as strings in JSON output via custom replacer.
- **Prices are in cents** (1-99), sizes in shares (>=1).
- **Dual client pattern:** Read-only commands use `readClient`, trading commands use `tradingClient`.
- **Validation at entry:** Commands validate required flags/positionals immediately and fail with usage hints.

## Environment Variables

```
CONTEXT_API_KEY       # Required for all commands
CONTEXT_PRIVATE_KEY   # Required for trading/account commands
CONTEXT_RPC_URL       # Optional, defaults to Base Sepolia
CONTEXT_BASE_URL      # Optional, API base URL override
```

## Dependencies

- `@contextwtf/sdk` — Context platform API client
- `viem` (^2.23.2) — Ethereum accounts, signing, utilities
- `@clack/prompts` — Interactive prompts (setup wizard, confirmations)
- `chalk` — Terminal colors (errors, status indicators)
- `cli-table3` — Rounded Unicode table rendering

## Skills Directory

`skills/` contains usage guides (onboarding, trading, market-research, market-creation, api-reference). Accessible via `context guides [topic]`.
