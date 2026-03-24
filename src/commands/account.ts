// ---------------------------------------------------------------------------
// Account commands — wallet status, setup, deposits, withdrawals, minting
// ---------------------------------------------------------------------------

import type { AccountStatus, Balance } from "context-markets";
import { formatEther } from "viem";
import { tradingClient, type ClientFlags } from "../client.js";
import { out, fail, requirePositional, type ParsedArgs } from "../format.js";
import { formatMoney, formatVolume, formatAddress, truncate } from "../ui/format.js";
import { confirmAction } from "../ui/prompt.js";

const HELP = `Usage: context account <subcommand> [options]

Subcommands:
  status                            Check wallet status (balances, approvals)
  setup                             Approve contracts for gasless trading
  mint-test-usdc                    Mint test USDC on testnet
    --amount <n>                      Amount to mint (default: 1000)

  deposit <amount>                  Deposit USDC into the exchange
  withdraw <amount>                 Withdraw USDC from the exchange

  gasless-approve                   Approve contracts via relayer (no gas needed)
  gasless-deposit <amount>          Deposit via USDC permit + relayer (no gas needed)

  mint-complete-sets <market-id> <amount>
                                    Mint complete sets of outcome tokens
  burn-complete-sets <market-id> <amount>
                                    Burn complete sets of outcome tokens
    --credit-internal <true|false>    Credit internal balance (default: true)

  help                              Show this help text

All account commands require a signer (--private-key or CONTEXT_PRIVATE_KEY).

Global options:
  --api-key <key>                   Context API key (or CONTEXT_API_KEY env)
  --private-key <key>               Private key for signing (or CONTEXT_PRIVATE_KEY env)`;

export default async function handleAccount(
  parsed: ParsedArgs,
): Promise<void> {
  const { subcommand, positional, flags } = parsed;

  switch (subcommand) {
    case "status":
      return status(flags);
    case "setup":
      return setup(flags);
    case "mint-test-usdc":
      return mintTestUsdc(flags);
    case "deposit":
      return deposit(positional, flags);
    case "withdraw":
      return withdraw(positional, flags);
    case "mint-complete-sets":
      return mintCompleteSets(positional, flags);
    case "burn-complete-sets":
      return burnCompleteSets(positional, flags);
    case "gasless-approve":
      return gaslessApprove(flags);
    case "gasless-deposit":
      return gaslessDeposit(positional, flags);
    case "relay-operator-approval":
      return fail(
        "Use `context account gasless-approve` for gasless operator approval.",
      );
    case "relay-deposit":
      return fail(
        "Use `context account gasless-deposit <amount>` for gasless deposit.",
      );
    case "help":
    case undefined:
      console.log(HELP);
      return;
    default:
      fail(
        `Unknown account subcommand: "${subcommand}". Run "context account help" for usage.`,
      );
  }
}

// ---------------------------------------------------------------------------
// status — check wallet status (balances, approvals)
// ---------------------------------------------------------------------------

interface MintTestUsdcResult {
  amount?: number | string;
  hash?: string;
  txHash?: string;
  tx_hash?: string;
}

function normalizeMintTestUsdcResult(result: unknown): MintTestUsdcResult {
  if (!result || typeof result !== "object") return {};

  const value = result as Record<string, unknown>;
  return {
    amount: typeof value.amount === "number" || typeof value.amount === "string"
      ? value.amount
      : undefined,
    hash: typeof value.hash === "string" ? value.hash : undefined,
    txHash: typeof value.txHash === "string" ? value.txHash : undefined,
    tx_hash: typeof value.tx_hash === "string" ? value.tx_hash : undefined,
  };
}

async function status(flags: Record<string, string>): Promise<void> {
  const ctx = tradingClient(flags as ClientFlags);

  // Fetch account status and portfolio balance in parallel
  const [result, balanceResult]: [AccountStatus, Balance] = await Promise.all([
    ctx.account.status(),
    ctx.portfolio.balance(),
  ]);

  // Format ETH balance from wei to human-readable
  const ethFormatted = result.ethBalance != null
    ? `${formatEther(result.ethBalance)} ETH`
    : "\u2014";

  out(result, {
    detail: [
      ["Address", formatAddress(result.address)],
      ["ETH Balance", ethFormatted],
      ["Total Balance", formatVolume(balanceResult.usdc?.balance)],
      ["Settlement", formatVolume(balanceResult.usdc?.settlementBalance)],
      ["Wallet", formatVolume(balanceResult.usdc?.walletBalance)],
      ["USDC Allowance", result.usdcAllowance ? "\u2713 Approved" : "\u2717 None"],
      ["Operator", result.isOperatorApproved ? "\u2713 Approved" : "\u2717 Not approved"],
      ["Needs Setup", result.isReady ? "No" : "Yes \u2014 run `context setup`"],
    ],
  });
}

// ---------------------------------------------------------------------------
// setup — approve contracts for gasless trading
// ---------------------------------------------------------------------------

async function setup(flags: Record<string, string>): Promise<void> {
  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.account.setup();
  out(result, {
    detail: [
      ["Status", "\u2713 Contracts approved"],
    ],
  });
}

// ---------------------------------------------------------------------------
// mint-test-usdc — mint test USDC on testnet
// ---------------------------------------------------------------------------

async function mintTestUsdc(flags: Record<string, string>): Promise<void> {
  const amountRaw = flags["amount"];
  let amount: number | undefined;

  if (amountRaw) {
    amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount <= 0) {
      fail("--amount must be a positive number", { received: amountRaw });
    }
  }

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.account.mintTestUsdc(amount);
  const r = normalizeMintTestUsdcResult(result);
  out(result, {
    detail: [
      ["Status", "\u2713 Minted"],
      ["Amount", formatMoney(r.amount ?? amount)],
      ["Tx Hash", formatAddress(r.txHash || r.tx_hash || r.hash)],
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
    "context account deposit <amount>",
  );

  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) {
    fail("Deposit amount must be a positive number", { received: raw });
  }

  const ctx = tradingClient(flags as ClientFlags);
  await confirmAction(`Deposit ${amount} USDC?`, flags);
  const result = await ctx.account.deposit(amount);

  out({ status: "deposited", amount_usdc: amount, tx_hash: result.txHash }, {
    detail: [
      ["Status", "\u2713 Deposited"],
      ["Amount", formatMoney(amount)],
      ["Tx Hash", formatAddress(result.txHash)],
    ],
  });
}

// ---------------------------------------------------------------------------
// withdraw — withdraw USDC from the exchange
// ---------------------------------------------------------------------------

async function withdraw(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const raw = requirePositional(
    positional,
    0,
    "amount",
    "context account withdraw <amount>",
  );

  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) {
    fail("Withdraw amount must be a positive number", { received: raw });
  }

  const ctx = tradingClient(flags as ClientFlags);
  await confirmAction(`Withdraw ${amount} USDC?`, flags);
  const txHash = await ctx.account.withdraw(amount);

  out({ status: "withdrawn", amount_usdc: amount, tx_hash: txHash }, {
    detail: [
      ["Status", "\u2713 Withdrawn"],
      ["Amount", formatMoney(amount)],
      ["Tx Hash", formatAddress(txHash)],
    ],
  });
}

// ---------------------------------------------------------------------------
// mint-complete-sets — mint complete sets of outcome tokens
// ---------------------------------------------------------------------------

async function mintCompleteSets(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const usage = "context account mint-complete-sets <market-id> <amount>";
  const marketId = requirePositional(positional, 0, "market-id", usage);
  const amountRaw = requirePositional(positional, 1, "amount", usage);

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) {
    fail("Amount must be a positive number", { received: amountRaw });
  }

  const ctx = tradingClient(flags as ClientFlags);
  await confirmAction(`Mint ${amount} complete sets for ${truncate(marketId, 20)}?`, flags);
  const txHash = await ctx.account.mintCompleteSets(marketId, amount);

  out({ status: "minted", market_id: marketId, amount, tx_hash: txHash }, {
    detail: [
      ["Status", "\u2713 Minted complete sets"],
      ["Market", truncate(marketId, 20)],
      ["Amount", String(amount)],
      ["Tx Hash", formatAddress(txHash)],
    ],
  });
}

// ---------------------------------------------------------------------------
// burn-complete-sets — burn complete sets of outcome tokens
// ---------------------------------------------------------------------------

async function burnCompleteSets(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const usage = "context account burn-complete-sets <market-id> <amount>";
  const marketId = requirePositional(positional, 0, "market-id", usage);
  const amountRaw = requirePositional(positional, 1, "amount", usage);

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) {
    fail("Amount must be a positive number", { received: amountRaw });
  }

  // --credit-internal defaults to true; only disable if explicitly set to "false"
  const creditInternalRaw = flags["credit-internal"];
  const creditInternal = creditInternalRaw !== "false";

  const ctx = tradingClient(flags as ClientFlags);
  await confirmAction(`Burn ${amount} complete sets for ${truncate(marketId, 20)}?`, flags);
  const txHash = await ctx.account.burnCompleteSets(
    marketId,
    amount,
    creditInternal,
  );

  out({ status: "burned", market_id: marketId, amount, credit_internal: creditInternal, tx_hash: txHash }, {
    detail: [
      ["Status", "\u2713 Burned complete sets"],
      ["Market", truncate(marketId, 20)],
      ["Amount", String(amount)],
      ["Credit Internal", String(creditInternal)],
      ["Tx Hash", formatAddress(txHash)],
    ],
  });
}

// ---------------------------------------------------------------------------
// gasless-approve — approve contracts via relayer (no gas needed)
// ---------------------------------------------------------------------------

async function gaslessApprove(flags: Record<string, string>): Promise<void> {
  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.account.gaslessSetup();
  out(result);
}

// ---------------------------------------------------------------------------
// gasless-deposit — deposit via USDC permit + relayer (no gas needed)
// ---------------------------------------------------------------------------

async function gaslessDeposit(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const raw = requirePositional(
    positional,
    0,
    "amount",
    "context account gasless-deposit <amount>",
  );

  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) {
    fail("Deposit amount must be a positive number.", { received: raw });
  }

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.account.gaslessDeposit(amount);
  out(result);
}
