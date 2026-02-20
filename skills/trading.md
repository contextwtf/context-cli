---
name: context-trading
description: Place and manage orders on Context prediction markets — limit orders, market orders, bulk operations, and position management.
---

# Trading

All trading commands require `CONTEXT_API_KEY` and `CONTEXT_PRIVATE_KEY`. All output is JSON.

## Placing a limit order

```bash
bun src/cli.ts orders create \
  --market 0xMarketId \
  --outcome yes \
  --side buy \
  --price 65 \
  --size 10
```

```json
{
  "success": true,
  "order": {
    "nonce": "0xOrderNonce",
    "marketId": "0xMarketId",
    "trader": "0xYourAddress",
    "outcomeIndex": 1,
    "side": 0,
    "price": "650000",
    "size": "10000000",
    "type": "limit",
    "status": "open",
    "insertedAt": "2026-02-18T12:10:00.000Z",
    "filledSize": "0",
    "remainingSize": "10000000",
    "percentFilled": 0,
    "voidedAt": null,
    "voidReason": null
  }
}
```

**Save the `nonce`** — you'll need it to cancel or replace the order.

Flags:
- `--market <id>` — (required) market ID
- `--outcome <yes|no>` — (required)
- `--side <buy|sell>` — (required)
- `--price <1-99>` — (required) price in cents
- `--size <n>` — (required) number of shares, minimum 1
- `--expiry-seconds <n>` — auto-expire after N seconds
- `--inventory-mode <any|hold|mint>` — `any` (default), `hold` (require existing tokens), `mint` (mint new tokens on fill)
- `--maker-role <any|taker>` — `any` (default), `taker` (fill immediately or void). **Never use `maker`** — it breaks settlement.

## Placing a market order

Fills immediately at the best available price:

```bash
bun src/cli.ts orders market \
  --market 0xMarketId \
  --outcome yes \
  --side buy \
  --max-price 70 \
  --max-size 10
```

```json
{
  "success": true,
  "order": {
    "nonce": "0xOrderNonce",
    "marketId": "0xMarketId",
    "type": "market",
    "status": "filled",
    "filledSize": "10000000",
    "remainingSize": "0",
    "percentFilled": 100
  }
}
```

If the order can't fill completely, the unfilled portion is voided with `voidReason: "UNFILLED_MARKET_ORDER"`.

Flags:
- `--market <id>` — (required)
- `--outcome <yes|no>` — (required)
- `--side <buy|sell>` — (required)
- `--max-price <1-99>` — (required) worst price you'll accept
- `--max-size <n>` — (required) maximum shares to buy

## Simulating before trading

Always simulate before placing large orders:

```bash
bun src/cli.ts orders simulate \
  --market 0xMarketId \
  --trader 0xYourAddress \
  --outcome yes \
  --side bid \
  --price 65 \
  --size 10
```

```json
{
  "levels": [
    {
      "price": "650000",
      "sizeAvailable": "5000000",
      "cumulativeSize": "5000000",
      "takerFee": "32500",
      "collateralRequired": "3250000",
      "makerCount": 2
    }
  ],
  "summary": {
    "fillSize": "10000000",
    "fillCost": "6500000",
    "takerFee": "65000",
    "weightedAvgPrice": "650000",
    "totalLiquidityAvailable": "50000000",
    "percentFillable": 100,
    "slippageBps": 0
  },
  "collateral": {
    "balance": "500000000",
    "outcomeTokenBalance": "0",
    "requiredForFill": "6565000",
    "isSufficient": true
  },
  "warnings": []
}
```

Check `collateral.isSufficient` before placing the order. Check `summary.percentFillable` to see how much will fill.

## Cancelling orders

Cancel a single order by nonce:

```bash
bun src/cli.ts orders cancel 0xOrderNonce
```

```json
{
  "success": true,
  "alreadyCancelled": false
}
```

## Cancel and replace

Atomically cancel an old order and place a new one:

```bash
bun src/cli.ts orders cancel-replace 0xOldNonce \
  --market 0xMarketId \
  --outcome yes \
  --side buy \
  --price 62 \
  --size 15
```

```json
{
  "cancel": { "success": true, "trader": "0x...", "nonce": "0xOldNonce", "alreadyCancelled": false },
  "create": { "success": true, "order": { "nonce": "0xNewNonce", "status": "open" } }
}
```

## Bulk operations

### Create multiple orders at once

```bash
bun src/cli.ts orders bulk-create --orders '[
  {"marketId":"0xId","outcome":"yes","side":"buy","priceCents":60,"size":10},
  {"marketId":"0xId","outcome":"no","side":"buy","priceCents":35,"size":10}
]'
```

Returns an array of `{ success, order }` results.

### Cancel multiple orders

```bash
bun src/cli.ts orders bulk-cancel --nonces 0xNonce1,0xNonce2,0xNonce3
```

### Atomic create + cancel

Create new orders and cancel old ones in a single call:

```bash
bun src/cli.ts orders bulk \
  --creates '[{"marketId":"0xId","outcome":"yes","side":"buy","priceCents":62,"size":10}]' \
  --cancels 0xOldNonce1,0xOldNonce2
```

```json
{
  "results": [
    { "type": "create", "success": true, "order": { "nonce": "0xNewNonce" } },
    { "type": "cancel", "success": true, "nonce": "0xOldNonce1", "alreadyCancelled": false },
    { "type": "cancel", "success": true, "nonce": "0xOldNonce2", "alreadyCancelled": false }
  ]
}
```

## Checking your orders

List your open orders:

```bash
bun src/cli.ts orders mine --market 0xMarketId
```

Recent orders (all statuses):

```bash
bun src/cli.ts orders recent --window-seconds 3600 --limit 20
```

Both return:

```json
{
  "orders": [ { "nonce": "0x...", "status": "open", "percentFilled": 0, "..." : "..." } ],
  "markets": { "0xMarketId": { "shortQuestion": "X by Y?", "slug": "..." } },
  "cursor": null
}
```

## Checking your portfolio

Positions:

```bash
bun src/cli.ts portfolio get --kind active
```

```json
{
  "portfolio": [
    {
      "outcomeIndex": 1,
      "outcomeName": "Yes",
      "marketId": "0xMarketId",
      "balance": "10000000",
      "netInvestment": "6500000",
      "currentValue": "7200000"
    }
  ],
  "marketIds": ["0xMarketId"],
  "cursor": null
}
```

Balance:

```bash
bun src/cli.ts portfolio balance
```

```json
{
  "address": "0xYourAddress",
  "usdc": {
    "balance": "500000000",
    "settlementBalance": "450000000",
    "walletBalance": "50000000"
  },
  "outcomeTokens": [ { "outcomeName": "Yes", "marketId": "0x...", "balance": "10000000" } ]
}
```

`settlementBalance` = available for trading. `walletBalance` = in wallet, not deposited.

## Claiming winnings

After a market resolves:

```bash
bun src/cli.ts portfolio claimable
```

```json
{
  "positions": [
    { "outcomeName": "Yes", "marketId": "0x...", "claimableAmount": "10000000" }
  ],
  "totalClaimable": "10000000"
}
```

## Workflow: Market-making both sides

```bash
# 1. Check the orderbook
bun src/cli.ts markets orderbook 0xMarketId --depth 10

# 2. Place bids on both sides
bun src/cli.ts orders bulk-create --orders '[
  {"marketId":"0xId","outcome":"yes","side":"buy","priceCents":60,"size":10},
  {"marketId":"0xId","outcome":"no","side":"buy","priceCents":35,"size":10}
]'

# 3. Monitor fills
bun src/cli.ts orders mine --market 0xMarketId

# 4. Refresh quotes — cancel old, place new
bun src/cli.ts orders bulk \
  --creates '[{"marketId":"0xId","outcome":"yes","side":"buy","priceCents":61,"size":10}]' \
  --cancels 0xOldYesNonce
```

## Workflow: Create a market and trade it

```bash
# 1. Generate a market from a question
bun src/cli.ts questions submit-and-wait "Will the Fed cut rates at the March 2026 meeting?"

# 2. Create the market on-chain (use question id from step 1)
bun src/cli.ts markets create 0xQuestionId

# 3. Place the first order
bun src/cli.ts orders create --market 0xNewMarketId --outcome yes --side buy --price 55 --size 20
```

See [`skills/market-creation.md`](market-creation.md) for the full market creation guide.

## Workflow: Buy and hold

```bash
# 1. Find a market
bun src/cli.ts markets list --query "bitcoin" --status active --limit 5

# 2. Check the price
bun src/cli.ts markets quotes 0xMarketId

# 3. Buy YES shares
bun src/cli.ts orders create --market 0xMarketId --outcome yes --side buy --price 65 --size 20

# 4. Check position later
bun src/cli.ts portfolio get --kind active --market 0xMarketId
```

## Common errors

| Error | Fix |
|---|---|
| `A private key is required for trading operations` | Export `CONTEXT_PRIVATE_KEY` |
| `--price must be between 1 and 99` | Prices are in cents (1–99) |
| `--size must be >= 1` | Minimum 1 share |
| `makerRoleConstraint=1 ... breaks settlement` | Use `--maker-role any` or `taker`, never `maker` |
| `collateral.isSufficient: false` | Deposit more USDC before trading |
