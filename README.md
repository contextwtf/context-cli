<p align="center">
  <img src="https://mainnet.contextcdn.com/ced823d63df9dff0390d9ad0a4e1ad3905dd199a6c50758c18a5c92a203adbd7" alt="Context" width="100%" />
</p>

<h1 align="center">Context CLI</h1>
<p align="center">CLI for trading on <a href="https://context.markets">Context Markets</a> prediction markets. Works interactively or as JSON for AI agents.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/context-markets-cli"><img src="https://img.shields.io/npm/v/context-markets-cli" alt="npm" /></a>
  <a href="https://github.com/contextwtf/context-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT" /></a>
  <a href="https://discord.gg/RVmzZsAyM4"><img src="https://img.shields.io/badge/Discord-Join-7289da" alt="Discord" /></a>
</p>

> **🤖 Agents: If you're reading this, start with [Agent Onboarding](#agent-onboarding) below.** It walks you through setting up a wallet, approving contracts, and placing your first trade — all non-interactive via JSON.

## Install

```bash
npm install -g context-markets-cli
```

This installs the `context` command globally.

Or run without installing:

```bash
npx context-markets-cli <command>
```

## Getting Started

The fastest way to get set up:

```bash
context setup
```

This walks you through:

1. **Wallet** — generate a new wallet or import an existing private key
2. **Save credentials** — persists to `~/.config/context/config.env` (chmod 600)
3. **API key** — prompts for your Context API key (get one at [context.markets](https://context.markets))
4. **Approve contracts** — checks ETH balance, approves on-chain (requires ETH on Base for gas)
5. **Deposit USDC** — checks USDC balance, deposits into the exchange

If anything fails (no ETH, rate limit, etc.), you can re-run `context setup` — it detects your existing config and picks up where you left off.

### Manual setup

If you prefer to configure manually:

```bash
# Option 1: Environment variables
export CONTEXT_API_KEY="your-api-key"
export CONTEXT_PRIVATE_KEY="0x..."

# Option 2: Config file (created by `context setup`)
# ~/.config/context/config.env
```

Credentials are loaded in order: CLI flags > env vars > config file.

Need an API key? Visit [context.markets](https://context.markets) or join our [Discord](https://discord.gg/RVmzZsAyM4).

## Quick Start

```bash
# Browse markets
context markets list --status active --limit 5

# Search for a market
context markets search "march madness"

# Get a link to a market
context markets link <market-id>

# View the orderbook
context markets orderbook <market-id>

# Place a limit order
context orders create --market <id> --outcome yes --side buy --price 45 --size 10

# Check your portfolio
context portfolio overview

# Interactive shell
context shell
```

## Agent Onboarding

**This section is for AI agents and automated systems.** All commands below produce structured JSON and require no interactive input.

### Step 1: Install and generate a wallet

```bash
npm install -g context-markets-cli

# Generate a wallet and save credentials to ~/.config/context/config.env
context setup --output json --save --api-key <YOUR_API_KEY>
# → { "status": "new_wallet", "address": "0x...", "privateKey": "0x...", "configPath": "..." }
```

### Step 2: Fund the wallet

Send ETH and USDC to the wallet address on **Base** (chain ID 8453):
- **ETH** — needed for gas fees (0.001 ETH is enough for many transactions)
- **USDC** — the trading currency

### Step 3: Approve contracts and deposit

```bash
# Approve the exchange contracts (requires ETH for gas)
context approve --output json
# → { "status": "approved", "usdcApprovalTx": "0x...", "operatorApprovalTx": "0x..." }

# Deposit USDC into the exchange
context deposit 100 --output json
# → { "status": "deposited", "amount": 100, "txHash": "0x..." }
```

### Step 4: Trade

```bash
# Browse active markets
context markets list --status active --output json

# Get quotes for a market
context markets quotes <market-id> --output json

# Place a limit order
context orders create --market <id> --outcome yes --side buy --price 45 --size 10 --output json

# Check positions
context portfolio overview --output json
```

All commands accept `--output json` for structured output. When piped (non-TTY), JSON is the default.

### Using with Claude Code

Add the MCP server for full agent integration:

```bash
claude mcp add context-markets -- npx context-markets-mcp
```

## Commands

**Markets** — `markets list` · `markets search` · `markets get` · `markets link` · `markets quotes` · `markets orderbook` · `markets simulate` · `markets price-history` · `markets oracle` · `markets oracle-quotes` · `markets request-oracle-quote` · `markets activity` · `markets global-activity` · `markets create`

**Orders** — `orders list` · `orders mine` · `orders get` · `orders recent` · `orders simulate` · `orders create` · `orders market` · `orders cancel` · `orders cancel-replace` · `orders bulk-create` · `orders bulk-cancel` · `orders bulk`

**Portfolio** — `portfolio overview` · `portfolio get` · `portfolio claimable` · `portfolio stats` · `portfolio balance` · `portfolio token-balance`

**Account** — `account status` · `account setup` · `account deposit` · `account withdraw` · `account mint-test-usdc` · `account mint-complete-sets` · `account burn-complete-sets` · `account gasless-approve` · `account gasless-deposit`

**Questions** — `questions submit` · `questions status` · `questions submit-and-wait` · `questions agent-submit` · `questions agent-submit-and-wait`

**Other** — `setup` · `approve` · `deposit` · `guides` · `ecosystem` · `shell`

Run `context <command> help` or `context <command> --help` for details on any command.

## Key Concepts

- **Prices** are in cents (1–99). A price of 65 means $0.65 per share.
- **Outcomes** are `yes` or `no`. Each market is a binary question.
- **Output** auto-detects: tables in a terminal, JSON when piped. Override with `--output json` or `--output table`.
- **Read-only commands** only need `CONTEXT_API_KEY`. **Trading commands** also need `CONTEXT_PRIVATE_KEY`.
- **Interactive shell** (`context shell`) supports `#N` row references, `next`/`back` pagination, and all commands.

## Guides

Built-in guides are available in the CLI:

```bash
context guides              # List available guides
context guides trading      # View the trading guide
```

## Documentation

- **[Command Reference](https://docs.context.markets/agents/cli/commands)** — full list of commands with flags and response shapes
- **[CLI Guide](https://docs.context.markets/agents/cli)** — setup, authentication, and workflows
- **[Agent Workflows](https://docs.context.markets/agents/cli/workflows)** — common patterns for AI agent integration

## Ecosystem

| Package | Description |
|---------|-------------|
| **[context-markets](https://github.com/contextwtf/context-sdk)** | TypeScript SDK for trading |
| **[context-markets-react](https://github.com/contextwtf/context-react)** | React hooks for market data and trading |
| **[context-markets-mcp](https://github.com/contextwtf/context-mcp)** | MCP server for AI agents |
| **[context-markets-cli](https://github.com/contextwtf/context-cli)** | CLI for trading from the terminal |
| **[context-skills](https://github.com/contextwtf/context-skills)** | AI agent skill files |
| **[context-plugin](https://github.com/contextwtf/context-plugin)** | Claude Code plugin |

## License

MIT — see [LICENSE](./LICENSE) for details.
