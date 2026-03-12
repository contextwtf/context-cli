<p align="center">
  <img src="https://mainnet.contextcdn.com/ced823d63df9dff0390d9ad0a4e1ad3905dd199a6c50758c18a5c92a203adbd7" alt="Context" width="100%" />
</p>

<h1 align="center">Context CLI</h1>
<p align="center">CLI for trading on <a href="https://context.markets">Context Markets</a> prediction markets.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@contextwtf/cli"><img src="https://img.shields.io/npm/v/@contextwtf/cli" alt="npm" /></a>
  <a href="https://github.com/contextwtf/context-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT" /></a>
  <a href="https://discord.gg/RVmzZsAyM4"><img src="https://img.shields.io/badge/Discord-Join-7289da" alt="Discord" /></a>
</p>

## Install

```bash
npx @contextwtf/cli <command>
```

Or install globally:

```bash
npm install -g @contextwtf/cli
context <command>
```

## Setup

```bash
export CONTEXT_API_KEY="your-api-key"
export CONTEXT_PRIVATE_KEY="0x..."   # required for trading/account commands
```

Need an API key? Visit [context.markets](https://context.markets) or join our [Discord](https://discord.gg/RVmzZsAyM4).

## Quick Start

If this is a fresh wallet, read [`skills/onboarding.md`](skills/onboarding.md) first. The entire setup is gasless (no ETH needed).

## Commands

| Command | Description | Requires signer |
|---|---|---|
| `context markets list` | Search/browse markets | No |
| `context markets get <id>` | Get a single market | No |
| `context markets quotes <id>` | Current best prices | No |
| `context markets orderbook <id>` | Full orderbook (YES + NO) | No |
| `context markets simulate <id>` | Simulate a trade | No |
| `context markets price-history <id>` | Historical prices | No |
| `context markets oracle <id>` | Oracle resolution info | No |
| `context markets oracle-quotes <id>` | Oracle probability estimates | No |
| `context markets request-oracle-quote <id>` | Request fresh oracle estimate | No |
| `context markets activity <id>` | Market activity feed | No |
| `context markets create <questionId>` | Create market from generated question | Yes |
| `context markets global-activity` | Global activity feed | No |
| `context questions submit <question>` | Submit question for AI market generation | Yes |
| `context questions status <submissionId>` | Check question submission status | Yes |
| `context questions submit-and-wait <question>` | Submit and poll until complete | Yes |
| `context orders list` | List orders | No (with `--trader`) |
| `context orders mine` | Your open orders | Yes |
| `context orders get <id>` | Get a single order | No |
| `context orders recent` | Recent orders | Yes |
| `context orders simulate` | Simulate an order | No |
| `context orders create` | Place a limit order | Yes |
| `context orders market` | Place a market order | Yes |
| `context orders cancel <nonce>` | Cancel an order | Yes |
| `context orders cancel-replace <nonce>` | Atomic cancel + new order | Yes |
| `context orders bulk-create` | Create multiple orders | Yes |
| `context orders bulk-cancel` | Cancel multiple orders | Yes |
| `context orders bulk` | Atomic create + cancel batch | Yes |
| `context portfolio get` | Positions | No (with `--address`) |
| `context portfolio claimable` | Claimable winnings | No (with `--address`) |
| `context portfolio stats` | Portfolio statistics | No (with `--address`) |
| `context portfolio balance` | USDC + token balances | No (with `--address`) |
| `context portfolio token-balance` | Any ERC-20 balance | No |
| `context account status` | Wallet status + approvals | Yes |
| `context account setup` | Approve contracts (needs gas) | Yes |
| `context account mint-test-usdc` | Mint testnet USDC | Yes |
| `context account deposit <amount>` | Deposit USDC to exchange | Yes |
| `context account withdraw <amount>` | Withdraw USDC from exchange | Yes |
| `context account mint-complete-sets` | Mint YES+NO token pairs | Yes |
| `context account burn-complete-sets` | Burn token pairs back to USDC | Yes |
| `context setup` | Generate wallet or check status | Yes |
| `context gasless-approve` | Approve contracts (no gas) | Yes |
| `context gasless-deposit <amount>` | Deposit USDC (no gas) | Yes |

## Skills

Detailed guides with example responses for each workflow:

| Skill | When to read |
|---|---|
| [`skills/onboarding.md`](skills/onboarding.md) | First time setup — wallet generation, funding, approvals (all gasless) |
| [`skills/trading.md`](skills/trading.md) | Placing orders, cancelling, bulk operations, market-making |
| [`skills/market-research.md`](skills/market-research.md) | Finding markets, checking prices, orderbooks, oracle data |
| [`skills/market-creation.md`](skills/market-creation.md) | Submit questions and create new markets via AI |
| [`skills/api-reference.md`](skills/api-reference.md) | Full command reference with all flags and response shapes |

## Key Concepts

- **Prices** are in cents (1-99). A price of 65 means $0.65 per share.
- **Outcomes** are `yes` or `no`. Each market is a binary question.
- **Size** is number of shares (minimum 1).
- **All output is JSON** to stdout. Errors are JSON to stderr with exit code 1.
- **Read-only commands** only need `CONTEXT_API_KEY`.
- **Trading commands** also need `CONTEXT_PRIVATE_KEY`.

## Global Flags

These work on any command:

- `--api-key <key>` — override `CONTEXT_API_KEY`
- `--private-key <key>` — override `CONTEXT_PRIVATE_KEY`
- `--rpc-url <url>` — override `CONTEXT_RPC_URL`
- `--base-url <url>` — override `CONTEXT_BASE_URL`

## Error Format

```json
{
  "error": "Missing required flag: --market",
  "details": { "usage": "context orders create --market <id> ..." }
}
```

## Documentation

Full command reference and workflow guides at **[docs.context.markets](https://docs.context.markets/agents/cli)**.

## Ecosystem

| Package | Description |
|---------|-------------|
| **[context-markets](https://github.com/contextwtf/context-sdk)** | TypeScript SDK for trading |
| **[@contextwtf/react](https://github.com/contextwtf/context-react)** | React hooks for market data and trading |
| **[@contextwtf/mcp](https://github.com/contextwtf/context-mcp)** | MCP server for AI agents |
| **[@contextwtf/cli](https://github.com/contextwtf/context-cli)** | CLI for trading from the terminal |
| **[context-skills](https://github.com/contextwtf/context-skills)** | AI agent skill files |
| **[context-plugin](https://github.com/contextwtf/context-plugin)** | Claude Code plugin |

## License

MIT — see [LICENSE](./LICENSE) for details.
