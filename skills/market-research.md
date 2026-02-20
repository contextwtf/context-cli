---
name: context-market-research
description: Find and analyze prediction markets — search, prices, orderbooks, oracle data, and activity feeds.
---

# Market Research

All commands in this skill are read-only. You only need `CONTEXT_API_KEY`.

## Finding markets

```bash
bun src/cli.ts markets list --query "bitcoin" --status active --sort-by volume --sort desc --limit 10
```

```json
{
  "markets": [
    {
      "id": "0xMarketId",
      "question": "Will Bitcoin exceed $100k by March 2026?",
      "shortQuestion": "BTC > $100k?",
      "status": "active",
      "volume": "15000.50",
      "volume24h": "3200.00",
      "participantCount": 42,
      "outcomePrices": [
        { "outcomeIndex": 0, "bestBid": 35, "bestAsk": 38, "midPrice": 36, "currentPrice": 36 },
        { "outcomeIndex": 1, "bestBid": 62, "bestAsk": 65, "midPrice": 63, "currentPrice": 63 }
      ],
      "resolutionStatus": "none",
      "deadline": "2026-03-15T00:00:00.000Z",
      "resolutionCriteria": "Resolves YES if Bitcoin spot price exceeds $100,000 on any major exchange.",
      "metadata": {
        "slug": "will-bitcoin-exceed-100k",
        "categories": ["crypto"],
        "shortSummary": "Bitcoin price prediction for March 2026"
      }
    }
  ],
  "cursor": "nextPageToken"
}
```

`outcomeIndex 0` = NO, `outcomeIndex 1` = YES. Prices are in cents (63 = $0.63 per share).

Search flags:
- `--query <text>` — full-text search
- `--status <active|pending|resolved|closed>`
- `--sort-by <new|volume|trending|ending|chance>`
- `--sort <asc|desc>`
- `--limit <n>` — max results
- `--cursor <token>` — pagination (use `cursor` from previous response)
- `--visibility <visible|hidden|all>`
- `--resolution-status <value>`
- `--creator <address>`
- `--category <slug>`

## Getting a single market

```bash
bun src/cli.ts markets get 0xMarketId
```

Returns the same `Market` object shape as list results.

## Checking current prices

```bash
bun src/cli.ts markets quotes 0xMarketId
```

```json
{
  "marketId": "0xMarketId",
  "yes": { "bid": 62, "ask": 65, "last": 63 },
  "no": { "bid": 35, "ask": 38, "last": 37 },
  "spread": 3,
  "timestamp": "2026-02-18T12:00:00.000Z"
}
```

- `bid` = best price someone will buy at
- `ask` = best price someone will sell at
- `spread` = ask - bid (lower = more liquid)

## Orderbook depth

```bash
bun src/cli.ts markets orderbook 0xMarketId --depth 5
```

```json
{
  "marketId": "0xMarketId",
  "yes": {
    "bids": [{ "price": 62, "size": 100 }, { "price": 61, "size": 50 }],
    "asks": [{ "price": 65, "size": 80 }, { "price": 66, "size": 120 }]
  },
  "no": {
    "bids": [{ "price": 35, "size": 80 }, { "price": 34, "size": 120 }],
    "asks": [{ "price": 38, "size": 100 }, { "price": 39, "size": 50 }]
  },
  "timestamp": "2026-02-18T12:00:00.000Z"
}
```

Use this to assess liquidity before placing large orders.

## Simulating a trade

Estimate cost and slippage before trading:

```bash
bun src/cli.ts markets simulate 0xMarketId --side yes --amount 100 --amount-type usd
```

```json
{
  "marketId": "0xMarketId",
  "side": "yes",
  "amount": 100,
  "amountType": "usd",
  "estimatedContracts": 153.8,
  "estimatedAvgPrice": 0.65,
  "estimatedSlippage": 0.02
}
```

Flags:
- `--side <yes|no>` — (required)
- `--amount <n>` — (required)
- `--amount-type <usd|contracts>` — default: usd
- `--trader <address>` — optional

## Price history

```bash
bun src/cli.ts markets price-history 0xMarketId --timeframe 1d
```

```json
{
  "prices": [
    { "time": 1739836800, "price": 60 },
    { "time": 1739840400, "price": 62 },
    { "time": 1739844000, "price": 58 }
  ],
  "startTime": 1739836800,
  "endTime": 1739923200,
  "interval": 3600
}
```

Timeframes: `1h`, `6h`, `1d`, `1w`, `1M`, `all`

## Oracle data

The oracle monitors external sources to evaluate market resolution.

### Oracle summary

```bash
bun src/cli.ts markets oracle 0xMarketId
```

```json
{
  "oracle": {
    "lastCheckedAt": "2026-02-18T10:00:00.000Z",
    "confidenceLevel": "high",
    "evidenceCollected": { "postsCount": 15, "relevantPosts": ["..."] },
    "sourcesMonitored": ["twitter", "official-sources"],
    "summary": {
      "decision": "pending",
      "shortSummary": "No definitive outcome yet.",
      "expandedSummary": "Monitoring ongoing. Multiple sources suggest..."
    }
  }
}
```

### Oracle probability estimates

```bash
bun src/cli.ts markets oracle-quotes 0xMarketId
```

```json
{
  "quotes": [
    {
      "id": 1,
      "status": "completed",
      "probability": 0.65,
      "confidence": "medium",
      "reasoning": "Based on current evidence and market indicators...",
      "referenceMarketsCount": 3,
      "createdAt": "2026-02-18T08:00:00.000Z",
      "completedAt": "2026-02-18T08:01:00.000Z"
    }
  ]
}
```

### Request a fresh estimate

```bash
bun src/cli.ts markets request-oracle-quote 0xMarketId
```

```json
{
  "id": 2,
  "status": "pending",
  "createdAt": "2026-02-18T12:05:00.000Z"
}
```

Poll `oracle-quotes` to see the result once `status` changes to `completed`.

## Activity feeds

### Market-specific activity

```bash
bun src/cli.ts markets activity 0xMarketId --limit 10
```

```json
{
  "marketId": "0xMarketId",
  "activity": [
    { "type": "trade", "timestamp": "2026-02-18T11:30:00.000Z", "data": {} }
  ],
  "pagination": { "cursor": "nextToken", "hasMore": true }
}
```

### Global activity

```bash
bun src/cli.ts markets global-activity --limit 10
```

Same shape, `marketId` is `null`.

## Workflow: Evaluate a market before trading

```bash
# 1. Find interesting markets
bun src/cli.ts markets list --status active --sort-by trending --limit 10

# 2. Read the market details
bun src/cli.ts markets get 0xMarketId

# 3. Check current prices and spread
bun src/cli.ts markets quotes 0xMarketId

# 4. Look at price history for trends
bun src/cli.ts markets price-history 0xMarketId --timeframe 1w

# 5. Check oracle's probability estimate
bun src/cli.ts markets oracle-quotes 0xMarketId

# 6. Assess orderbook liquidity
bun src/cli.ts markets orderbook 0xMarketId --depth 10

# 7. Simulate your planned trade
bun src/cli.ts markets simulate 0xMarketId --side yes --amount 50 --amount-type usd
```
