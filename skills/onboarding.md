---
name: context-onboarding
description: Set up a new wallet for trading on Context prediction markets. Gasless — no ETH required.
---

# Onboarding

Get from zero to trading-ready. The entire flow is gasless — you do not need ETH.

## Prerequisites

```bash
export CONTEXT_API_KEY="your-api-key"
```

## Step 1: Generate a wallet

If you don't have a private key yet:

```bash
bun src/cli.ts setup
```

```json
{
  "status": "new_wallet",
  "address": "0xYourNewAddress",
  "privateKey": "0xYourNewPrivateKey",
  "nextSteps": [
    "Save the private key securely — it cannot be recovered.",
    "Export it: export CONTEXT_PRIVATE_KEY=<key>",
    "Fund the wallet with testnet ETH and USDC on Base Sepolia.",
    "Run `context-cli approve` to approve contracts for trading.",
    "Run `context-cli deposit <amount>` to deposit USDC into the exchange."
  ]
}
```

Export it immediately:

```bash
export CONTEXT_PRIVATE_KEY="0xYourNewPrivateKey"
```

If you already have a key, just export it and skip to step 2.

## Step 2: Mint test USDC

```bash
bun src/cli.ts account mint-test-usdc --amount 1000
```

This mints 1000 USDC to your wallet on Base Sepolia. You can call this multiple times.

## Step 3: Approve contracts (gasless)

Use the gasless relayer — no ETH needed:

```bash
bun src/cli.ts gasless-approve
```

```json
{
  "success": true,
  "txHash": "0x...",
  "user": "0xYourAddress",
  "operator": "0x...",
  "relayer": "0x..."
}
```

This approves the operator contract to execute trades on your behalf.

## Step 4: Deposit USDC (gasless)

```bash
bun src/cli.ts gasless-deposit 500
```

```json
{
  "success": true,
  "txHash": "0x...",
  "user": "0xYourAddress",
  "token": "0x...",
  "amount": "500000000",
  "relayer": "0x..."
}
```

This moves USDC from your wallet into the exchange (settlement balance). You can only trade with deposited USDC.

## Step 5: Verify everything

```bash
bun src/cli.ts account status
```

```json
{
  "address": "0xYourAddress",
  "ethBalance": "0",
  "usdcBalance": "1000000000",
  "usdcAllowance": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
  "isOperatorApproved": true,
  "needsUsdcApproval": false,
  "needsOperatorApproval": false,
  "isReady": true
}
```

You're ready to trade when:
- `isReady` is `true`

Confirm you have USDC deposited:

```bash
bun src/cli.ts portfolio balance
```

```json
{
  "address": "0xYourAddress",
  "usdc": {
    "tokenAddress": "0x...",
    "balance": "500000000",
    "settlementBalance": "500000000",
    "walletBalance": "0"
  },
  "outcomeTokens": []
}
```

`settlementBalance` is your trading balance. You're ready — see `skills/trading.md`.

## Topping up later

To add more USDC at any time:

```bash
bun src/cli.ts account mint-test-usdc --amount 1000
bun src/cli.ts gasless-deposit 1000
```

## Withdrawing

To move USDC from the exchange back to your wallet:

```bash
bun src/cli.ts account withdraw 100
```

```json
{
  "status": "withdrawn",
  "amount_usdc": 100,
  "tx_hash": "0x..."
}
```

## Non-gasless alternatives

If you have ETH for gas, you can use the on-chain versions instead:

| Gasless | On-chain (needs ETH) |
|---|---|
| `gasless-approve` | `approve` |
| `gasless-deposit <amount>` | `deposit <amount>` |

The gasless commands are recommended. They use a relayer and require only a signature.
