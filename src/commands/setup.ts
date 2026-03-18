// ---------------------------------------------------------------------------
// Onboarding commands: setup, approve, deposit
// ---------------------------------------------------------------------------

import * as p from "@clack/prompts";
import chalk from "chalk";
import { formatEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { tradingClient, type ClientFlags } from "../client.js";
import { out, fail, getOutputMode, requirePositional, type ParsedArgs } from "../format.js";
import { loadConfig, saveConfig, configPath } from "../config.js";

const MIN_ETH_FOR_GAS = 1_000_000_000_000n; // 0.000001 ETH — just enough for a few txs

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
      fail("Gasless commands moved to: context account gasless-approve");
      return;
    case "gasless-deposit":
      fail("Gasless commands moved to: context account gasless-deposit <amount>");
      return;
    default:
      fail(`Unknown setup subcommand: "${subcommand}"`);
  }
}

// ---------------------------------------------------------------------------
// Shared approve → mint → deposit flow
// ---------------------------------------------------------------------------

/** Dig through error cause chain to find the most useful message */
function formatError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  // Walk the cause chain to find the deepest message
  let deepest = err;
  let current: unknown = err;
  while (current instanceof Error && current.cause) {
    current = current.cause;
    if (current instanceof Error) deepest = current;
  }

  // If there's a body with details (ContextApiError), show that
  const anyErr = err as any;
  if (anyErr.body) {
    const body = anyErr.body;
    if (typeof body === "object" && body.message) return body.message;
    if (typeof body === "string") return body;
  }

  // Use the deepest cause message if it's more specific
  const deepMsg = deepest.message.split("\n")[0];
  const topMsg = err.message.split("\n")[0];
  return deepMsg !== topMsg && deepMsg.length > 5 ? `${topMsg}: ${deepMsg}` : topMsg;
}

/** Check if an error is due to insufficient ETH for gas */
function isInsufficientFundsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("insufficient funds") || msg.includes("exceeds the balance");
}

/**
 * Check ETH balance and wait for funding if needed.
 * Takes pre-fetched status to avoid redundant API calls.
 * Returns true if wallet has enough ETH, false if user opted out.
 */
async function ensureGasFunded(
  ctx: ReturnType<typeof tradingClient>,
  status: { address: string; ethBalance: bigint },
): Promise<boolean> {
  let { ethBalance } = status;
  const { address } = status;

  if (ethBalance >= MIN_ETH_FOR_GAS) {
    p.log.success(`ETH balance: ${formatEther(ethBalance)} ETH`);
    return true;
  }

  p.log.warning("Your wallet needs ETH on Base for gas fees.");
  p.log.info(`Send ETH to: ${chalk.bold(address)}`);
  p.log.info(chalk.dim("Even a small amount (0.001 ETH) is enough for many transactions."));

  while (true) {
    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "check", label: "I've sent ETH — check balance" },
        { value: "skip", label: "Skip for now (set up trading later)" },
      ],
    });

    if (p.isCancel(action) || action === "skip") return false;

    const s = p.spinner();
    s.start("Checking balance...");
    const updated = await ctx.account.status();
    ethBalance = (updated as any).ethBalance as bigint;
    if (ethBalance >= MIN_ETH_FOR_GAS) {
      s.stop(`ETH balance: ${formatEther(ethBalance)} ETH`);
      return true;
    }
    s.stop(`ETH balance: ${formatEther(ethBalance)} ETH — still not enough`);
  }
}

/**
 * Try to approve contracts with retry support.
 * Returns true if approved, false if user skipped.
 */
async function approveWithRetry(ctx: ReturnType<typeof tradingClient>): Promise<boolean> {
  while (true) {
    const s = p.spinner();
    s.start("Approving contracts...");
    try {
      await ctx.account.setup();
      s.stop("Contracts approved");
      return true;
    } catch (err) {
      s.stop("Approval failed");
      p.log.warning(formatError(err));

      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "retry", label: "Retry" },
          { value: "skip", label: "Skip for now" },
        ],
      });

      if (p.isCancel(action) || action === "skip") return false;
    }
  }
}

async function onboardingFlow(ctx: ReturnType<typeof tradingClient>): Promise<boolean> {
  // Single status fetch upfront — used for all checks
  const s = p.spinner();
  s.start("Checking wallet status...");
  const status = await ctx.account.status();
  const address = (status as any).address as string;
  const ethBalance = (status as any).ethBalance as bigint;
  const usdcBalance = (status as any).usdcBalance as bigint;
  const isReady = status.isReady;
  s.stop("Wallet status loaded");

  // If already fully set up, skip to deposit
  if (isReady) {
    p.log.success("Contracts already approved");
  } else {
    // Ask if they want to set up for trading
    const wantTrading = await p.confirm({
      message: "Set up this wallet for trading? (requires ETH on Base for gas)",
    });
    if (p.isCancel(wantTrading)) {
      p.outro("Setup cancelled.");
      process.exit(0);
    }

    if (!wantTrading) {
      p.log.info("You can set up trading later with: context setup");
      return true;
    }

    // Step 1: Ensure wallet has ETH for gas
    const funded = await ensureGasFunded(ctx, { address, ethBalance });
    if (!funded) {
      p.log.info("You can resume setup later with: context setup");
      return false;
    }

    // Step 2: Approve contracts (with retry)
    const approved = await approveWithRetry(ctx);
    if (!approved) {
      p.log.info("You can approve later with: context approve");
      return false;
    }
  }

  // Step 3: Deposit — check USDC balance
  const doDeposit = await p.confirm({
    message: "Deposit USDC to start trading?",
  });
  if (p.isCancel(doDeposit)) {
    p.outro("Setup cancelled.");
    process.exit(0);
  }
  if (doDeposit) {
    let currentUsdcBalance = usdcBalance;

    if (currentUsdcBalance === 0n) {
      p.log.warning("No USDC in your wallet.");
      p.log.info(`Send USDC on Base to: ${chalk.bold(address)}`);
      p.log.info(chalk.dim("You can buy USDC on Coinbase, Binance, or bridge from another chain."));

      let hasUsdc = false;
      while (!hasUsdc) {
        const action = await p.select({
          message: "What would you like to do?",
          options: [
            { value: "check", label: "I've sent USDC — check balance" },
            { value: "skip", label: "Skip for now" },
          ],
        });
        if (p.isCancel(action) || action === "skip") {
          p.log.info("You can deposit later with: context deposit <amount>");
          return false;
        }
        const sp = p.spinner();
        sp.start("Checking USDC balance...");
        const updated = await ctx.account.status();
        currentUsdcBalance = (updated as any).usdcBalance as bigint;
        const formatted = Number(currentUsdcBalance) / 1e6;
        if (currentUsdcBalance > 0n) {
          sp.stop(`USDC balance: $${formatted.toFixed(2)}`);
          hasUsdc = true;
        } else {
          sp.stop("USDC balance: $0.00 — still waiting");
        }
      }
    } else {
      const formatted = Number(currentUsdcBalance) / 1e6;
      p.log.success(`USDC balance: $${formatted.toFixed(2)}`);
    }

    const usdcFormatted = Number(currentUsdcBalance) / 1e6;
    const amount = await p.text({
      message: `How much USDC to deposit? (wallet has $${usdcFormatted.toFixed(2)})`,
      placeholder: String(Math.min(100, usdcFormatted)),
      validate: (v = "") => {
        const n = parseFloat(v);
        if (isNaN(n) || n <= 0) return "Must be a positive number";
        if (n > usdcFormatted) return `You only have $${usdcFormatted.toFixed(2)} USDC`;
      },
    });
    if (p.isCancel(amount)) {
      p.outro("Setup cancelled.");
      process.exit(0);
    }

    let deposited = false;
    while (!deposited) {
      const sp = p.spinner();
      sp.start("Depositing USDC...");
      try {
        await ctx.account.deposit(parseFloat(amount as string));
        sp.stop(`Deposited $${parseFloat(amount as string).toFixed(2)} USDC`);
        deposited = true;
      } catch (err) {
        sp.stop("Deposit failed");
        p.log.warning(formatError(err));

        const action = await p.select({
          message: "What would you like to do?",
          options: [
            { value: "retry", label: "Retry" },
            { value: "skip", label: "Skip for now" },
          ],
        });
        if (p.isCancel(action) || action === "skip") {
          p.log.info("You can deposit later with: context deposit <amount>");
          return false;
        }
      }
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// setup — check wallet status or generate a new wallet
// ---------------------------------------------------------------------------

async function setup(flags: Record<string, string>): Promise<void> {
  // Check config file for existing credentials
  const existingConfig = loadConfig();
  const privateKey =
    flags["private-key"] ?? process.env.CONTEXT_PRIVATE_KEY ?? existingConfig.CONTEXT_PRIVATE_KEY;

  // JSON mode: non-interactive, suitable for agents
  if (getOutputMode() === "json") {
    if (!privateKey) {
      const newKey = generatePrivateKey();
      const account = privateKeyToAccount(newKey);

      // --save: persist to config file automatically
      if (flags["save"] === "true" || flags["yes"]) {
        saveConfig({ CONTEXT_PRIVATE_KEY: newKey });
        if (flags["api-key"]) {
          saveConfig({ CONTEXT_API_KEY: flags["api-key"] });
        }
      }

      out({
        status: "new_wallet",
        address: account.address,
        privateKey: newKey,
        configPath: (flags["save"] === "true" || flags["yes"]) ? configPath() : null,
        nextSteps: [
          "Send ETH to the wallet on Base for gas fees.",
          "Run `context approve --private-key <key> --output json` to approve contracts.",
          "Run `context deposit <amount> --private-key <key> --output json` to deposit USDC.",
        ],
      });
      return;
    }

    const ctx = tradingClient(flags as ClientFlags);
    const walletStatus = await ctx.account.status();

    out({
      status: "existing_wallet",
      ...walletStatus,
      nextSteps: !walletStatus.isReady
        ? [
            "Run `context approve --output json` to approve contracts.",
            "Run `context deposit <amount> --output json` to deposit.",
          ]
        : ["Wallet is fully set up. You can start trading."],
    });
    return;
  }

  // Table mode: interactive wizard
  p.intro(chalk.bold("Context Markets — Setup"));

  if (privateKey) {
    // Wallet already configured
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const source = flags["private-key"]
      ? "--private-key flag"
      : process.env.CONTEXT_PRIVATE_KEY
        ? "CONTEXT_PRIVATE_KEY env"
        : `${configPath()}`;
    p.log.success(`Wallet detected from ${source}`);
    p.log.info(`Address: ${account.address}`);

    const rerun = await p.confirm({
      message: "Continue with existing wallet? (No = start fresh)",
    });
    if (p.isCancel(rerun) || !rerun) {
      const confirm = await p.confirm({
        message: `This will overwrite ${configPath()}. Are you sure?`,
      });
      if (p.isCancel(confirm) || !confirm) {
        p.outro("Setup cancelled.");
        process.exit(0);
      }
      // Fall through to wallet generation by calling setup with cleared key
      return setupNewWallet(flags);
    }

    // Set key in env so tradingClient picks it up
    process.env.CONTEXT_PRIVATE_KEY = privateKey;
    // Also load API key from config if not set
    if (!flags["api-key"] && !process.env.CONTEXT_API_KEY && existingConfig.CONTEXT_API_KEY) {
      process.env.CONTEXT_API_KEY = existingConfig.CONTEXT_API_KEY;
    }

    const ctx = tradingClient(flags as ClientFlags);
    const ok = await onboardingFlow(ctx);
    p.outro(ok
      ? chalk.green("Setup complete! You're ready to trade.")
      : "Setup finished with errors. See above for next steps.");
  } else {
    return setupNewWallet(flags);
  }
}

// ---------------------------------------------------------------------------
// setupNewWallet — generate or import a new wallet
// ---------------------------------------------------------------------------

async function setupNewWallet(flags: Record<string, string>): Promise<void> {
  const hasKey = await p.select({
    message: "Do you have an existing private key?",
    options: [
      { value: "no", label: "No, generate one" },
      { value: "yes", label: "Yes, import one" },
    ],
  });

  if (p.isCancel(hasKey)) {
    p.outro("Setup cancelled.");
    process.exit(0);
  }

  let key: string;

  if (hasKey === "yes") {
    const input = await p.text({
      message: "Enter your private key:",
      placeholder: "0x...",
      validate: (v = "") => {
        if (!v.startsWith("0x") || v.length !== 66)
          return "Invalid private key format (must be 0x + 64 hex chars)";
      },
    });
    if (p.isCancel(input)) {
      p.outro("Setup cancelled.");
      process.exit(0);
    }
    key = input as string;
    const account = privateKeyToAccount(key as `0x${string}`);
    p.log.success("Wallet imported");
    p.log.info(`Address: ${account.address}`);
  } else {
    key = generatePrivateKey();
    const account = privateKeyToAccount(key as `0x${string}`);
    p.log.success("Wallet created");
    p.log.info(`Address: ${account.address}`);
    p.log.warning("Back up your private key! It cannot be recovered.");
  }

  // Offer to save to config file
  const doSave = await p.confirm({
    message: `Save credentials to ${configPath()}?`,
  });
  if (p.isCancel(doSave)) {
    p.outro("Setup cancelled.");
    process.exit(0);
  }
  if (doSave) {
    saveConfig({ CONTEXT_PRIVATE_KEY: key });
    p.log.success(`Saved to ${configPath()} (chmod 600)`);
  } else {
    p.log.info(`Set your key: export CONTEXT_PRIVATE_KEY="${key}"`);
  }

  // Also prompt for API key if not already set
  const existingApiKey = flags["api-key"] ?? process.env.CONTEXT_API_KEY;
  if (!existingApiKey) {
    const apiKey = await p.text({
      message: "Enter your Context API key (get one at context.markets):",
      placeholder: "ctx_...",
      validate: (v = "") => {
        if (!v.trim()) return "API key is required to continue";
      },
    });
    if (p.isCancel(apiKey)) {
      p.outro("Setup cancelled.");
      process.exit(0);
    }
    if (doSave) {
      saveConfig({ CONTEXT_API_KEY: apiKey as string });
      p.log.success("API key saved to config");
    } else {
      p.log.info(`Set your key: export CONTEXT_API_KEY="${apiKey}"`);
    }
    process.env.CONTEXT_API_KEY = apiKey as string;
  }

  process.env.CONTEXT_PRIVATE_KEY = key;

  const ctx = tradingClient(flags as ClientFlags);
  const ok = await onboardingFlow(ctx);
  p.outro(ok
    ? chalk.green("Setup complete! You're ready to trade.")
    : "Setup finished with errors. See above for next steps.");
}

// ---------------------------------------------------------------------------
// approve — approve operator + USDC allowance
// ---------------------------------------------------------------------------

async function approve(flags: Record<string, string>): Promise<void> {
  const ctx = tradingClient(flags as ClientFlags);

  // JSON mode: just try it directly
  if (getOutputMode() === "json") {
    const result = await ctx.account.setup();
    const walletStatus = await ctx.account.status();
    out({
      status: "approved",
      usdcApprovalTx: result.usdcApproval.txHash,
      operatorApprovalTx: result.operatorApproval.txHash,
      wallet: walletStatus,
      nextSteps: [
        "Run `context deposit <amount>` to deposit USDC into the exchange.",
      ],
    });
    return;
  }

  // Interactive mode: check status first, then balance + retry
  p.intro(chalk.bold("Context Markets — Approve"));

  const s = p.spinner();
  s.start("Checking wallet status...");
  const status = await ctx.account.status();
  s.stop("Wallet status loaded");

  if (status.isReady) {
    p.log.success("Contracts already approved — nothing to do.");
    p.outro("Run `context deposit <amount>` to deposit USDC.");
    return;
  }

  const address = (status as any).address as string;
  const ethBalance = (status as any).ethBalance as bigint;
  const funded = await ensureGasFunded(ctx, { address, ethBalance });
  if (!funded) {
    p.outro("Skipped. Run `context approve` when your wallet has ETH.");
    return;
  }

  const approved = await approveWithRetry(ctx);
  p.outro(approved
    ? chalk.green("Contracts approved! Run `context deposit <amount>` to start trading.")
    : "Skipped. Run `context approve` to try again.");
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
    "context deposit <amount>",
  );

  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) {
    fail("Deposit amount must be a positive number.", { received: raw });
  }

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.account.deposit(amount);

  out({
    status: "deposited",
    amount,
    txHash: result.txHash,
  });
}

