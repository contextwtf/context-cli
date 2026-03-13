<p align="center">
  <img src="https://mainnet.contextcdn.com/ced823d63df9dff0390d9ad0a4e1ad3905dd199a6c50758c18a5c92a203adbd7" alt="Context" width="100%" />
</p>

<h1 align="center">Context CLI</h1>
<p align="center">CLI for trading on <a href="https://context.markets">Context Markets</a> prediction markets. All output is JSON. Designed for AI agents.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/context-markets-cli"><img src="https://img.shields.io/npm/v/context-markets-cli" alt="npm" /></a>
  <a href="https://github.com/contextwtf/context-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT" /></a>
  <a href="https://discord.gg/RVmzZsAyM4"><img src="https://img.shields.io/badge/Discord-Join-7289da" alt="Discord" /></a>
</p>

## Install

```bash
npx context-markets-cli <command>
```

Or install globally:

```bash
npm install -g context-markets-cli
```

## Setup

```bash
export CONTEXT_API_KEY="your-api-key"
export CONTEXT_PRIVATE_KEY="0x..."   # required for trading/account commands
```

Need an API key? Visit [context.markets](https://context.markets) or join our [Discord](https://discord.gg/RVmzZsAyM4).

## Quick Start

```bash
# Browse markets
context markets list --status active --limit 5

# Get quotes for a market
context markets quotes <market-id>

# Place a limit order
context orders create --market <id> --outcome yes --side buy --price 45 --size 10

# Check your portfolio
context portfolio get
```

## Commands

**Markets** — `markets list` · `markets get` · `markets quotes` · `markets orderbook` · `markets simulate` · `markets price-history` · `markets oracle` · `markets oracle-quotes` · `markets activity` · `markets create` · `markets global-activity`

**Orders** — `orders list` · `orders mine` · `orders get` · `orders recent` · `orders simulate` · `orders create` · `orders market` · `orders cancel` · `orders cancel-replace` · `orders bulk-create` · `orders bulk-cancel` · `orders bulk`

**Portfolio** — `portfolio get` · `portfolio claimable` · `portfolio stats` · `portfolio balance` · `portfolio token-balance`

**Account** — `account status` · `account setup` · `account mint-test-usdc` · `account deposit` · `account withdraw`

**Questions** — `questions submit` · `questions status` · `questions submit-and-wait`

**Gasless** — `setup` · `gasless-approve` · `gasless-deposit`

## Key Concepts

- **Prices** are in cents (1–99). A price of 65 means $0.65 per share.
- **Outcomes** are `yes` or `no`. Each market is a binary question.
- **All output is JSON** to stdout. Errors are JSON to stderr with exit code 1.
- **Read-only commands** only need `CONTEXT_API_KEY`. **Trading commands** also need `CONTEXT_PRIVATE_KEY`.

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
