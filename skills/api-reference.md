---
name: context-api-reference
description: Complete command reference for the context CLI with all flags and response types.
---

# API Reference

All commands output JSON to stdout. Errors output JSON to stderr with exit code 1.

## markets

### markets list

```
context markets list [flags]
```

| Flag | Required | Description |
|---|---|---|
| `--status <value>` | | `active`, `pending`, `resolved`, `closed` |
| `--sort-by <field>` | | `new`, `volume`, `trending`, `ending`, `chance` |
| `--sort <dir>` | | `asc`, `desc` |
| `--limit <n>` | | Max results |
| `--cursor <token>` | | Pagination cursor |
| `--visibility <value>` | | `visible`, `hidden`, `all` |
| `--resolution-status <value>` | | Resolution status filter |
| `--creator <address>` | | Filter by creator |
| `--category <slug>` | | Filter by category |

Response: `MarketList`

```json
{
  "markets": [{
    "id": "string",
    "question": "string",
    "shortQuestion": "string",
    "oracle": "string",
    "outcomeTokens": ["string"],
    "outcomePrices": [{
      "outcomeIndex": 0,
      "bestBid": 35,
      "bestAsk": 38,
      "spread": 3,
      "midPrice": 36,
      "lastPrice": 36,
      "currentPrice": 36
    }],
    "creator": "string",
    "creatorProfile": { "username": "string|null", "avatarUrl": "string|null" },
    "volume": "string",
    "volume24h": "string",
    "participantCount": 42,
    "resolutionStatus": "none|pending|resolved",
    "status": "active|pending|resolved|closed",
    "createdAt": "ISO8601",
    "deadline": "ISO8601",
    "resolutionCriteria": "string",
    "resolvedAt": "ISO8601|null",
    "payoutPcts": [0, 100],
    "metadata": {
      "slug": "string|null",
      "criteria": "string",
      "startTime": 0,
      "endTime": 0,
      "shortSummary": "string|null",
      "categories": ["string"]
    },
    "outcome": "number|null",
    "contractAddress": "string|null"
  }],
  "cursor": "string|null"
}
```

### markets search

```
context markets search <query> [--limit <n>] [--offset <n>]
```

Response: `MarketSearchResult`

### markets get

```
context markets get <id>
```

Response: single `Market` object (same shape as list items).

### markets quotes

```
context markets quotes <id>
```

Response: `Quotes`

```json
{
  "marketId": "string",
  "yes": { "bid": 62, "ask": 65, "last": 63 },
  "no": { "bid": 35, "ask": 38, "last": 37 },
  "spread": 3,
  "timestamp": "ISO8601"
}
```

### markets orderbook

```
context markets orderbook <id> [--depth <n>]
```

Response: `FullOrderbook`

```json
{
  "marketId": "string",
  "yes": {
    "bids": [{ "price": 62, "size": 100 }],
    "asks": [{ "price": 65, "size": 80 }]
  },
  "no": {
    "bids": [{ "price": 35, "size": 80 }],
    "asks": [{ "price": 38, "size": 100 }]
  },
  "timestamp": "ISO8601"
}
```

### markets simulate

```
context markets simulate <id> --side <yes|no> --amount <n> [--amount-type <usd|contracts>] [--trader <addr>]
```

Response: `SimulateResult`

```json
{
  "marketId": "string",
  "side": "string",
  "amount": 100,
  "amountType": "usd",
  "estimatedContracts": 153.8,
  "estimatedAvgPrice": 0.65,
  "estimatedSlippage": 0.02
}
```

### markets price-history

```
context markets price-history <id> [--timeframe <1h|6h|1d|1w|1M|all>]
```

Response: `PriceHistory`

```json
{
  "prices": [{ "time": 1739836800, "price": 60 }],
  "startTime": 1739836800,
  "endTime": 1739923200,
  "interval": 3600
}
```

### markets oracle

```
context markets oracle <id>
```

Response: `OracleResponse`

```json
{
  "oracle": {
    "lastCheckedAt": "ISO8601|null",
    "confidenceLevel": "string|null",
    "evidenceCollected": { "postsCount": 0, "relevantPosts": [] },
    "sourcesMonitored": ["string"],
    "summary": {
      "decision": "string",
      "shortSummary": "string",
      "expandedSummary": "string"
    }
  }
}
```

### markets oracle-quotes

```
context markets oracle-quotes <id>
```

Response: `OracleQuotesResponse`

```json
{
  "quotes": [{
    "id": 1,
    "status": "completed",
    "probability": 0.65,
    "confidence": "low|medium|high|null",
    "reasoning": "string|null",
    "referenceMarketsCount": 3,
    "createdAt": "ISO8601",
    "completedAt": "ISO8601|null"
  }]
}
```

### markets request-oracle-quote

```
context markets request-oracle-quote <id>
```

Response: `OracleQuoteRequestResult`

```json
{ "id": 1, "status": "pending", "createdAt": "ISO8601" }
```

### markets activity

```
context markets activity <id> [--limit <n>] [--cursor <token>]
```

Response: `ActivityResponse`

```json
{
  "marketId": "string",
  "activity": [{ "type": "string", "timestamp": "ISO8601", "data": {} }],
  "pagination": { "cursor": "string|null", "hasMore": true }
}
```

### markets create

```
context markets create <questionId>
```

Requires signer. Creates an on-chain market from a generated question ID (obtained via `questions submit-and-wait`).

Response: `CreateMarketResult`

```json
{
  "marketId": "string",
  "txHash": "0xHex"
}
```

### markets global-activity

```
context markets global-activity [--limit <n>] [--cursor <token>]
```

Response: same as `activity`, `marketId` is `null`.

---

## questions

All questions commands require a signer.

### questions submit

```
context questions submit <question>
```

Submits a question for AI-powered market generation.

Response: `SubmitQuestionResult`

```json
{
  "submissionId": "string",
  "questions": [],
  "status": "pending",
  "statusUpdates": [],
  "pollUrl": "string"
}
```

### questions status

```
context questions status <submissionId>
```

Polls the status of a question submission.

Response: `QuestionSubmission`

```json
{
  "submissionId": "string",
  "status": "pending|processing|completed|failed",
  "questions": [{
    "id": "0xHex",
    "text": "string",
    "shortText": "string",
    "criteria": "string",
    "explanation": "string",
    "endTime": 1772728140
  }],
  "statusUpdates": [{
    "tool": "string",
    "status": "string",
    "timestamp": "ISO8601"
  }]
}
```

### questions submit-and-wait

```
context questions submit-and-wait <question> [--poll-interval <ms>] [--max-attempts <n>]
```

Submits a question and polls until completion. Returns the final `QuestionSubmission` (same shape as `questions status` with `status: "completed"`).

| Flag | Default | Description |
|---|---|---|
| `--poll-interval <ms>` | 2000 | Polling interval in milliseconds |
| `--max-attempts <n>` | 45 | Max polling attempts before timeout |

---

## orders

### orders list

```
context orders list [--trader <addr>] [--market <id>] [--status <value>] [--cursor <token>] [--limit <n>]
```

Uses read-only client if `--trader` given, trading client otherwise.

Response: `OrderList`

```json
{
  "orders": [{
    "nonce": "0xHex",
    "marketId": "string",
    "trader": "0xAddress",
    "outcomeIndex": 1,
    "side": 0,
    "price": "string",
    "size": "string",
    "type": "limit|market",
    "status": "open|filled|cancelled|expired|voided",
    "insertedAt": "ISO8601",
    "filledSize": "string",
    "remainingSize": "string",
    "percentFilled": 0,
    "voidedAt": "ISO8601|null",
    "voidReason": "UNFILLED_MARKET_ORDER|UNDER_COLLATERALIZED|MISSING_OPERATOR_APPROVAL|null"
  }],
  "markets": { "marketId": { "shortQuestion": "string", "slug": "string" } },
  "cursor": "string|null"
}
```

### orders mine

```
context orders mine [--market <id>]
```

Requires signer. Response: same as `orders list`.

### orders get

```
context orders get <id>
```

Response: single `Order` object.

### orders recent

```
context orders recent [--trader <addr>] [--market <id>] [--status <value>] [--limit <n>] [--window-seconds <n>]
```

Requires signer. Response: same as `orders list`.

### orders simulate

```
context orders simulate --market <id> --trader <addr> --size <n> --price <n> [--outcome <yes|no>] [--side <bid|ask>]
```

Response: `OrderSimulateResult`

```json
{
  "levels": [{
    "price": "string",
    "sizeAvailable": "string",
    "cumulativeSize": "string",
    "takerFee": "string",
    "cumulativeTakerFee": "string",
    "collateralRequired": "string",
    "cumulativeCollateral": "string",
    "makerCount": 2
  }],
  "summary": {
    "fillSize": "string",
    "fillCost": "string",
    "takerFee": "string",
    "weightedAvgPrice": "string",
    "totalLiquidityAvailable": "string",
    "percentFillable": 100,
    "slippageBps": 0
  },
  "collateral": {
    "balance": "string",
    "outcomeTokenBalance": "string",
    "requiredForFill": "string",
    "isSufficient": true
  },
  "warnings": ["string"]
}
```

### orders create

```
context orders create --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n> [--expiry-seconds <n>] [--inventory-mode <any|hold|mint>] [--maker-role <any|taker>]
```

Requires signer. Response: `CreateOrderResult`

```json
{ "success": true, "order": { "...Order fields..." } }
```

### orders market

```
context orders market --market <id> --outcome <yes|no> --side <buy|sell> --max-price <1-99> --max-size <n> [--expiry-seconds <n>]
```

Requires signer. Response: `CreateOrderResult` (same as create).

### orders cancel

```
context orders cancel <nonce>
```

Requires signer. Response: `CancelResult`

```json
{ "success": true, "alreadyCancelled": false }
```

### orders cancel-replace

```
context orders cancel-replace <nonce> --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n>
```

Requires signer. Response: `CancelReplaceResult`

```json
{
  "cancel": { "success": true, "trader": "string", "nonce": "string", "alreadyCancelled": false },
  "create": { "success": true, "order": { "...Order fields..." } }
}
```

### orders bulk-create

```
context orders bulk-create --orders '<JSON array of PlaceOrderRequest>'
```

PlaceOrderRequest: `{ marketId, outcome, side, priceCents, size, expirySeconds?, inventoryModeConstraint?, makerRoleConstraint? }`

Requires signer. Response: array of `CreateOrderResult`.

### orders bulk-cancel

```
context orders bulk-cancel --nonces <hex,hex,...>
```

Requires signer. Response: array of `CancelResult`.

### orders bulk

```
context orders bulk [--creates '<JSON array>'] [--cancels <hex,hex,...>]
```

At least one of `--creates` or `--cancels` required. Requires signer. Response: `BulkResult`

```json
{
  "results": [
    { "type": "create", "success": true, "order": {} },
    { "type": "cancel", "success": true, "trader": "string", "nonce": "string", "alreadyCancelled": false }
  ]
}
```

---

## portfolio

All portfolio commands use a read-only client if `--address` is given, trading client otherwise.

### portfolio get

```
context portfolio get [--address <addr>] [--kind <all|active|won|lost|claimable>] [--market <id>] [--cursor <token>] [--page-size <n>]
```

Response: `Portfolio`

```json
{
  "portfolio": [{
    "tokenAddress": "string",
    "balance": "string",
    "settlementBalance": "string",
    "walletBalance": "string",
    "outcomeIndex": 1,
    "outcomeName": "string",
    "marketId": "string",
    "netInvestment": "string",
    "currentValue": "string",
    "tokensRedeemed": "string"
  }],
  "marketIds": ["string"],
  "cursor": "string|null"
}
```

### portfolio claimable

```
context portfolio claimable [--address <addr>]
```

Response: `ClaimableResponse`

```json
{
  "positions": [{
    "tokenAddress": "string",
    "balance": "string",
    "settlementBalance": "string",
    "walletBalance": "string",
    "outcomeIndex": 1,
    "outcomeName": "string|null",
    "marketId": "string",
    "netInvestment": "string",
    "claimableAmount": "string"
  }],
  "markets": [{
    "id": "string",
    "outcomeTokens": ["string"],
    "outcomeNames": ["string"],
    "payoutPcts": ["string"]
  }],
  "totalClaimable": "string"
}
```

### portfolio stats

```
context portfolio stats [--address <addr>]
```

Response: `PortfolioStats`

```json
{ "currentPortfolioValue": "string", "currentPortfolioPercentChange": 12.5 }
```

### portfolio balance

```
context portfolio balance [--address <addr>]
```

Response: `Balance`

```json
{
  "address": "0xAddress",
  "usdc": {
    "tokenAddress": "string",
    "balance": "string",
    "settlementBalance": "string",
    "walletBalance": "string"
  },
  "outcomeTokens": [{
    "tokenAddress": "string",
    "marketId": "string",
    "outcomeIndex": 1,
    "outcomeName": "string",
    "balance": "string",
    "settlementBalance": "string",
    "walletBalance": "string"
  }]
}
```

### portfolio token-balance

```
context portfolio token-balance <address> <token-address>
```

Response: `TokenBalance`

```json
{ "balance": "string", "decimals": 6, "symbol": "USDC" }
```

---

## account

All account commands require a signer.

### account status

```
context account status
```

Response: `AccountStatus`

```json
{
  "address": "0xAddress",
  "ethBalance": "bigint as string",
  "usdcBalance": "bigint as string",
  "usdcAllowance": "bigint as string",
  "isOperatorApproved": true,
  "needsUsdcApproval": false,
  "needsOperatorApproval": false,
  "isReady": true
}
```

### account setup

```
context account setup
```

Response: `SetupResult`

```json
{
  "usdcApproval": { "needed": false, "txHash": null },
  "operatorApproval": { "needed": false, "txHash": null }
}
```

### account mint-test-usdc

```
context account mint-test-usdc [--amount <n>]
```

Default amount: 1000.

### account deposit

```
context account deposit <amount>
```

Response:

```json
{ "status": "deposited", "amount_usdc": 500, "tx_hash": "0xHex" }
```

### account withdraw

```
context account withdraw <amount>
```

Response:

```json
{ "status": "withdrawn", "amount_usdc": 100, "tx_hash": "0xHex" }
```

### account mint-complete-sets

```
context account mint-complete-sets <market-id> <amount>
```

Response:

```json
{ "status": "minted", "market_id": "string", "amount": 10, "tx_hash": "0xHex" }
```

### account burn-complete-sets

```
context account burn-complete-sets <market-id> <amount> [--credit-internal <true|false>]
```

Response:

```json
{ "status": "burned", "market_id": "string", "amount": 10, "credit_internal": true, "tx_hash": "0xHex" }
```

---

## Onboarding shortcuts

```
context setup                     # Generate wallet or check status
context gasless-approve           # Approve contracts (no gas)
context gasless-deposit <amount>  # Deposit USDC (no gas)
context approve                   # Approve contracts (needs ETH)
context deposit <amount>          # Deposit USDC (needs ETH)
```

### setup (no key)

Response:

```json
{
  "status": "new_wallet",
  "address": "0xAddress",
  "privateKey": "(saved to ~/.config/context/config.env)",
  "nextSteps": ["string"]
}
```

### setup (with key)

Response:

```json
{
  "status": "existing_wallet",
  "address": "0xAddress",
  "ethBalance": "bigint",
  "isOperatorApproved": true,
  "isReady": true,
  "nextSteps": ["string"]
}
```

### gasless-approve

Response: `GaslessOperatorResult`

```json
{ "success": true, "txHash": "0xHex", "user": "0xAddr", "operator": "0xAddr", "relayer": "0xAddr" }
```

### gasless-deposit

Response: `GaslessDepositResult`

```json
{ "success": true, "txHash": "0xHex", "user": "0xAddr", "token": "0xAddr", "amount": "string", "relayer": "0xAddr" }
```

---

## Error format

```json
{
  "error": "Error message",
  "details": { "usage": "string", "hint": "string" }
}
```

Exit code: 1. Output: stderr.

## Global flags

| Flag | Env var | Description |
|---|---|---|
| `--api-key <key>` | `CONTEXT_API_KEY` | API key (required for all commands) |
| `--private-key <key>` | `CONTEXT_PRIVATE_KEY` | Private key (required for trading) |
| `--rpc-url <url>` | `CONTEXT_RPC_URL` | Custom RPC URL |
| `--base-url <url>` | `CONTEXT_BASE_URL` | API base URL |
