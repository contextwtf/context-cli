---
name: context-onboarding
description: Set up a new wallet for trading on Context prediction markets, including the guided setup flow and gasless alternatives.
---

# Onboarding

Get from zero to trading-ready. `context setup` uses the on-chain approval/deposit flow, so you should expect to fund the wallet with ETH on Base before continuing. If you specifically want relayed flows, use the separate gasless commands below.

## Prerequisites

```bash
export CONTEXT_API_KEY="your-api-key"
```

## Step 1: Generate a wallet

If you don't have a private key yet:

**Interactive mode** (`context setup`): The CLI generates a new wallet and displays the private key **once** with a warning. You'll be asked to confirm you've backed it up. If you say no, the key is automatically saved to `~/.config/context/config.env`. You can also import an existing key (entered via masked password prompt — never echoed back).

**JSON mode** (`context setup --output json`): The key is always saved to the config file automatically, since agents can't manually back up keys. The key is never included in JSON output.

```bash
context setup --output json
```

```json
{
  "status": "new_wallet",
  "address": "0xYourNewAddress",
  "saved": true,
  "configPath": "~/.config/context/config.env",
  "nextSteps": [
    "Send ETH to the wallet on Base for gas fees.",
    "Run `context approve --output json` to approve contracts.",
    "Run `context deposit <amount> --output json` to deposit USDC."
  ]
}
```

If you already have a key, just export it and skip to step 2.

## Step 2: Mint test USDC

```bash
context account mint-test-usdc --amount 1000
```

This mints 1000 USDC to your wallet on Base Sepolia. You can call this multiple times.

## Step 3: Choose approval flow

Default guided setup:

```bash
context approve
```

This is the same on-chain approval flow that `context setup` walks through, and it needs ETH for gas.

Gasless alternative:

```bash
context gasless-approve
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

Both variants approve the operator contract to execute trades on your behalf.

## Step 4: Choose deposit flow

```bash
context deposit 500
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

Gasless alternative:

```bash
context gasless-deposit 500
```

## Step 5: Verify everything

```bash
context account status
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
context portfolio balance
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
context account mint-test-usdc --amount 1000
context deposit 1000
```

## Withdrawing

To move USDC from the exchange back to your wallet:

```bash
context account withdraw 100
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

Use the gasless commands when you specifically want relayed approvals/deposits without funding ETH first.
