---
name: context-market-creation
description: Submit questions and create new prediction markets via AI generation — submit, poll, and deploy markets on-chain.
---

# Market Creation

Submit a question in natural language. The AI generates market specifications (resolution criteria, oracle sources, deadlines). Then deploy one on-chain.

All commands require `CONTEXT_API_KEY` and `CONTEXT_PRIVATE_KEY`. All output is JSON.

## Quick flow: Submit, wait, create

```bash
# 1. Submit a question and wait for AI generation
bun src/cli.ts questions submit-and-wait "Will Bitcoin hit $200k by end of 2026?"

# 2. Pick a question ID from the response
# 3. Create the market on-chain
bun src/cli.ts markets create 0xQuestionId
```

## Step-by-step flow

### 1. Submit a question

```bash
bun src/cli.ts questions submit "Will Ethereum flip Bitcoin by market cap in 2026?"
```

```json
{
  "submissionId": "kF7bcVMOqRITbiQXRq8ir",
  "questions": [],
  "status": "pending",
  "statusUpdates": [],
  "pollUrl": "http://api-testnet.context.markets/public/v2/questions/submissions/kF7bcVMOqRITbiQXRq8ir"
}
```

Save the `submissionId`.

### 2. Poll for completion

```bash
bun src/cli.ts questions status kF7bcVMOqRITbiQXRq8ir
```

The `status` field progresses: `pending` → `processing` → `completed` (or `failed`).

While processing, `statusUpdates` shows what the AI is doing:

```json
{
  "status": "processing",
  "statusUpdates": [
    { "tool": "check_asset_price", "status": "Checking BTC price", "timestamp": "..." },
    { "tool": "select_accounts", "status": "Picking resolution sources", "timestamp": "..." }
  ]
}
```

Once completed, `questions` contains the generated markets:

```json
{
  "status": "completed",
  "questions": [
    {
      "id": "0x5bb7547a...",
      "text": "Will Ethereum's market cap exceed Bitcoin's market cap?",
      "shortText": "Will Ethereum flip Bitcoin's market cap?",
      "criteria": "Resolves YES if the market capitalization of Ethereum (ETH) exceeds...",
      "explanation": "Short-term market cap flip",
      "endTime": 1772771880,
      "sources": ["x.com/coindesk", "x.com/cointelegraph"]
    },
    {
      "id": "0x5bb7547a...",
      "text": "Will Ethereum outperform Bitcoin by price percentage change?",
      "shortText": "Will ETH outperform BTC in percentage terms?",
      "criteria": "Resolves YES if Ethereum (ETH) has a higher percentage price increase...",
      "explanation": "Close price gap performance",
      "endTime": 1772771880,
      "sources": ["x.com/coindesk", "x.com/cointelegraph"]
    }
  ],
  "qualityExplanation": "I checked the current prices of BTC and ETH..."
}
```

### 3. Create a market

Pick a question `id` from the response and deploy it:

```bash
bun src/cli.ts markets create 0x5bb7547ad70232d934458522ea2530d67447aaf26ff318b64c48e6da9c09e5c3
```

```json
{
  "marketId": "0xNewMarketId",
  "txHash": "0x..."
}
```

## Using submit-and-wait (recommended)

Combines submit + polling into one command:

```bash
bun src/cli.ts questions submit-and-wait "Will Bitcoin hit $200k by end of 2026?" --poll-interval 2000 --max-attempts 45
```

This blocks until the submission completes (or fails/times out), then returns the full result with all generated questions.

Flags:
- `--poll-interval <ms>` — polling interval (default: 2000ms)
- `--max-attempts <n>` — max polls before timeout (default: 45)

## Workflow: Create and trade on your own market

```bash
# 1. Generate market questions
bun src/cli.ts questions submit-and-wait "Will the Fed cut rates at the March 2026 meeting?"

# 2. Create the market (use question id from step 1)
bun src/cli.ts markets create 0xQuestionId

# 3. Check the new market
bun src/cli.ts markets get 0xNewMarketId

# 4. Place an opening order
bun src/cli.ts orders create --market 0xNewMarketId --outcome yes --side buy --price 55 --size 20
```
