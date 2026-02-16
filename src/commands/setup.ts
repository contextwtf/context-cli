// ---------------------------------------------------------------------------
// Onboarding commands: setup, approve, deposit
// ---------------------------------------------------------------------------

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { tradingClient, type ClientFlags } from "../client.js";
import { out, fail, requirePositional, type ParsedArgs } from "../format.js";

export default async function handleSetup(parsed: ParsedArgs): Promise<void> {
  const { subcommand, positional, flags } = parsed;

  switch (subcommand) {
    case "setup":
      return setup(flags);
    case "approve":
      return approve(flags);
    case "deposit":
      return deposit(positional, flags);
    case "gasless-approve":
      return gaslessApprove(flags);
    case "gasless-deposit":
      return gaslessDeposit(positional, flags);
    default:
      fail(`Unknown setup subcommand: "${subcommand}"`);
  }
}

// ---------------------------------------------------------------------------
// setup — check wallet status or generate a new wallet
// ---------------------------------------------------------------------------

async function setup(flags: Record<string, string>): Promise<void> {
  const privateKey =
    flags["private-key"] ?? process.env.CONTEXT_PRIVATE_KEY;

  if (!privateKey) {
    // No key configured — generate a fresh wallet for the user
    const newKey = generatePrivateKey();
    const account = privateKeyToAccount(newKey);

    out({
      status: "new_wallet",
      address: account.address,
      privateKey: newKey,
      nextSteps: [
        "Save the private key securely — it cannot be recovered.",
        "Export it: export CONTEXT_PRIVATE_KEY=<key>",
        "Fund the wallet with testnet ETH and USDC on Base Sepolia.",
        "Run `context-cli approve` to approve contracts for trading.",
        "Run `context-cli deposit <amount>` to deposit USDC into the exchange.",
      ],
    });
    return;
  }

  // Key is available — show wallet status
  const ctx = tradingClient(flags as ClientFlags);
  const walletStatus = await ctx.account.status();

  out({
    status: "existing_wallet",
    ...walletStatus,
    nextSteps: walletStatus.needsApprovals
      ? [
          "Run `context-cli approve` to approve contracts for gasless trading.",
          "Run `context-cli deposit <amount>` to deposit USDC.",
        ]
      : ["Wallet is fully set up. You can start trading."],
  });
}

// ---------------------------------------------------------------------------
// approve — approve operator + USDC allowance
// ---------------------------------------------------------------------------

async function approve(flags: Record<string, string>): Promise<void> {
  const ctx = tradingClient(flags as ClientFlags);

  const result = await ctx.account.setup();
  const walletStatus = await ctx.account.status();

  out({
    status: "approved",
    usdcApprovalTx: result.usdcApprovalTx,
    operatorApprovalTx: result.operatorApprovalTx,
    wallet: walletStatus,
    nextSteps: [
      "Run `context-cli deposit <amount>` to deposit USDC into the exchange.",
    ],
  });
}

// ---------------------------------------------------------------------------
// deposit — deposit USDC into the exchange
// ---------------------------------------------------------------------------

async function deposit(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const raw = requirePositional(
    positional,
    0,
    "amount",
    "context-cli deposit <amount>",
  );

  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) {
    fail("Deposit amount must be a positive number.", { received: raw });
  }

  const ctx = tradingClient(flags as ClientFlags);
  const txHash = await ctx.account.deposit(amount);

  out({
    status: "deposited",
    amount,
    txHash,
  });
}

// ---------------------------------------------------------------------------
// gasless-approve — gasless operator approval via relayer (no gas needed)
// ---------------------------------------------------------------------------

async function gaslessApprove(flags: Record<string, string>): Promise<void> {
  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.account.gaslessSetup();
  out(result);
}

// ---------------------------------------------------------------------------
// gasless-deposit — gasless deposit via USDC permit + relayer (no gas needed)
// ---------------------------------------------------------------------------

async function gaslessDeposit(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const raw = requirePositional(
    positional,
    0,
    "amount",
    "context-cli gasless-deposit <amount>",
  );

  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) {
    fail("Deposit amount must be a positive number.", { received: raw });
  }

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.account.gaslessDeposit(amount);
  out(result);
}
