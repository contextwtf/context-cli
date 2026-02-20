# context-cli

CLI for trading on [Context](https://context.markets) prediction markets (Base Sepolia testnet). All output is JSON. Designed for use by AI agents.

## Setup

```bash
bun install
```

```bash
export CONTEXT_API_KEY="your-api-key"
export CONTEXT_PRIVATE_KEY="0x..."   # required for trading/account commands
```

Run commands:

```bash
bun src/cli.ts <command> [subcommand] [options]
```

## Quick Start

If this is a fresh wallet, read [`skills/onboarding.md`](skills/onboarding.md) first. The entire setup is gasless (no ETH needed).

## Commands

| Command | Description | Requires signer |
|---|---|---|
| `markets list` | Search/browse markets | No |
| `markets get <id>` | Get a single market | No |
| `markets quotes <id>` | Current best prices | No |
| `markets orderbook <id>` | Full orderbook (YES + NO) | No |
| `markets simulate <id>` | Simulate a trade | No |
| `markets price-history <id>` | Historical prices | No |
| `markets oracle <id>` | Oracle resolution info | No |
| `markets oracle-quotes <id>` | Oracle probability estimates | No |
| `markets request-oracle-quote <id>` | Request fresh oracle estimate | No |
| `markets activity <id>` | Market activity feed | No |
| `markets create <questionId>` | Create market from generated question | Yes |
| `markets global-activity` | Global activity feed | No |
| `questions submit <question>` | Submit question for AI market generation | Yes |
| `questions status <submissionId>` | Check question submission status | Yes |
| `questions submit-and-wait <question>` | Submit and poll until complete | Yes |
| `orders list` | List orders | No (with `--trader`) |
| `orders mine` | Your open orders | Yes |
| `orders get <id>` | Get a single order | No |
| `orders recent` | Recent orders | Yes |
| `orders simulate` | Simulate an order | No |
| `orders create` | Place a limit order | Yes |
| `orders market` | Place a market order | Yes |
| `orders cancel <nonce>` | Cancel an order | Yes |
| `orders cancel-replace <nonce>` | Atomic cancel + new order | Yes |
| `orders bulk-create` | Create multiple orders | Yes |
| `orders bulk-cancel` | Cancel multiple orders | Yes |
| `orders bulk` | Atomic create + cancel batch | Yes |
| `portfolio get` | Positions | No (with `--address`) |
| `portfolio claimable` | Claimable winnings | No (with `--address`) |
| `portfolio stats` | Portfolio statistics | No (with `--address`) |
| `portfolio balance` | USDC + token balances | No (with `--address`) |
| `portfolio token-balance` | Any ERC-20 balance | No |
| `account status` | Wallet status + approvals | Yes |
| `account setup` | Approve contracts (needs gas) | Yes |
| `account mint-test-usdc` | Mint testnet USDC | Yes |
| `account deposit <amount>` | Deposit USDC to exchange | Yes |
| `account withdraw <amount>` | Withdraw USDC from exchange | Yes |
| `account mint-complete-sets` | Mint YES+NO token pairs | Yes |
| `account burn-complete-sets` | Burn token pairs back to USDC | Yes |
| `setup` | Generate wallet or check status | Yes |
| `gasless-approve` | Approve contracts (no gas) | Yes |
| `gasless-deposit <amount>` | Deposit USDC (no gas) | Yes |

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

- **Prices** are in cents (1–99). A price of 65 means $0.65 per share.
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
  "details": { "usage": "context-cli orders create --market <id> ..." }
}
```
