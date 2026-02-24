# CLI UX Redesign

Redesign context-cli from JSON-only output to a human-friendly CLI with dual output mode, interactive elements, and a REPL shell. Inspired by Polymarket CLI patterns but built with the Bun/TypeScript ecosystem.

## Output System

Dual-mode output with TTY auto-detection:
- `stdout.isTTY === true` → table mode (default for humans)
- `stdout.isTTY === false` → JSON mode (default for agents/pipes)
- `--output table` / `--output json` / `-o json` overrides auto-detection
- Confirmations are auto-skipped in JSON mode

### Table Mode

List views use `cli-table3` with rounded Unicode borders (`╭╮╰╯│─├┤┬┴┼`). One consistent style everywhere.

Row numbers (`#` column) in all list tables — these feed the `#N` reference system in the shell.

Detail views (single item) use two-column key-value tables with the full ID visible.

### Number Formatting

- Prices: `63¢` (cents with cent sign)
- Money: `$15.0K`, `$1.2M`, `$432.50` (smart abbreviation)
- Addresses: `0x1a2b...3c4d` (first 6 + last 4)
- Questions: truncated at 34-40ch with `...` in lists, full in detail views
- Dates: `Mar 15, 2026` (human-readable)

### Empty States

Plain text messages instead of empty tables: `"No markets found."`, `"No open orders."`, etc.

### Errors

Table mode: `✗ message` on stderr with usage hint below. JSON mode: `{ "error": "...", "details": {...} }` unchanged.

## Interactive Elements

### Setup Wizard (`context setup`)

Multi-step `@clack/prompts` wizard:
1. Detect existing wallet from env vars, or ask: generate new / import existing
2. If new: generate, show address, save config, warn to back up
3. Offer to mint test USDC (1000 default)
4. Offer gasless contract approval
5. Offer gasless USDC deposit (prompt for amount)
6. Show "setup complete" with next-step commands

Each step is a real prompt — user confirms before each action executes.

### Trading Confirmations

Before orders, cancels, and approvals: show a summary box and ask `Confirm? (Y/n)`.

Summary includes: market name, side, price, size, estimated cost.

Skip with `--yes` flag. Auto-skipped in JSON mode.

### REPL Shell (`context shell`)

Interactive shell with readline history. Commands drop the `context` prefix.

Special features:
- `#N` resolves to the full ID of row N from the last list result
- `next` re-runs the last command with the cursor auto-filled
- `help` shows available commands
- `exit` / `quit` / Ctrl+D to leave
- `setup` blocked inside shell (must run outside)
- Always table mode

## Guides Command (`context guides [topic]`)

Renders existing `skills/*.md` files formatted for the terminal.

Without topic: lists available guides with descriptions. With topic: renders the guide with chalk-based formatting (bold headers, preserved code blocks, indentation).

Available guides: onboarding, trading, market-research, market-creation, api-reference.

## Pagination

Table mode: footer line `Showing N of M · Next: --cursor <token>` (only when more pages exist).

JSON mode: cursor in payload (unchanged from current).

Shell: `next` command auto-fills the cursor from last paginated result.

## Architecture

### New Dependencies

- `@clack/prompts` — setup wizard, confirmations, spinners
- `chalk` — colors (status indicators, errors, headers)
- `cli-table3` — rounded Unicode tables

### New Files

```
src/ui/
  output.ts    # out(data, columns) / fail() — dual-mode rendering
  table.ts     # makeTable(), makeDetailTable(), formatters
  prompt.ts    # confirm(), setupWizard() — wraps @clack/prompts
  guides.ts    # renderGuide() — reads skill files, formats for terminal
src/shell.ts   # REPL loop with readline, #N refs, next, history
```

### Integration Pattern

Command modules stay the same structure. The change is at the output boundary:

```ts
// Before
out(result)

// After
out(result, {
  columns: [
    { key: "shortQuestion", label: "Question", width: 34 },
    { key: "outcomePrices[1].currentPrice", label: "Yes", format: "cents" },
    { key: "volume", label: "Volume", format: "money" },
    { key: "status", label: "Status" },
  ]
})
```

Confirmations injected before SDK calls in trading commands:

```ts
await confirmOrder(order, flags);  // no-op if --yes or JSON mode
const result = await ctx.orders.create(order);
```

### What Doesn't Change

- `src/client.ts` — untouched
- Command module structure — same routing, same validation
- All existing flags and arguments — fully backwards compatible
- Environment variable configuration — no config file system

### Backwards Compatibility

- Agents piping output get JSON automatically (TTY detection)
- `--output json` / `-o json` forces JSON explicitly
- All current flags and positional args continue to work
- Error JSON shape unchanged in JSON mode
