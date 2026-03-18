// ---------------------------------------------------------------------------
// Onboarding commands: setup, approve, deposit
// ---------------------------------------------------------------------------

import * as p from "@clack/prompts";
import chalk from "chalk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { tradingClient, type ClientFlags } from "../client.js";
import { out, fail, getOutputMode, requirePositional, type ParsedArgs } from "../format.js";
import { saveConfig, configPath } from "../config.js";

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
// Shared approve → mint → deposit flow
// ---------------------------------------------------------------------------

async function onboardingFlow(ctx: ReturnType<typeof tradingClient>): Promise<void> {
  const status = await ctx.account.status();

  if (!status.isReady) {
    const doApprove = await p.confirm({
      message: "Approve contracts for trading? (gasless)",
    });
    if (p.isCancel(doApprove)) {
      p.outro("Setup cancelled.");
      process.exit(0);
    }
    if (doApprove) {
      const s = p.spinner();
      s.start("Approving contracts...");
      await ctx.account.gaslessSetup();
      s.stop("Contracts approved");
    }
  } else {
    p.log.success("Contracts already approved");
  }

  // Mint step — graceful failure
  const doMint = await p.confirm({
    message: "Mint test USDC? (1000 USDC)",
  });
  if (p.isCancel(doMint)) {
    p.outro("Setup cancelled.");
    process.exit(0);
  }
  if (doMint) {
    const s = p.spinner();
    s.start("Minting test USDC...");
    try {
      await ctx.account.mintTestUsdc(1000);
      s.stop("Minted 1,000 USDC");
    } catch (err) {
      s.stop("Minting failed");
      const msg = err instanceof Error ? err.message : String(err);
      p.log.warning(`Could not mint test USDC: ${msg.split("\n")[0]}`);
      p.log.info("You can try again later with: context account mint-test-usdc");
    }
  }

  // Deposit step
  const doDeposit = await p.confirm({
    message: "Deposit USDC to start trading?",
  });
  if (p.isCancel(doDeposit)) {
    p.outro("Setup cancelled.");
    process.exit(0);
  }
  if (doDeposit) {
    const amount = await p.text({
      message: "Enter amount to deposit:",
      placeholder: "500",
      validate: (v = "") => {
        const n = parseFloat(v);
        if (isNaN(n) || n <= 0) return "Must be a positive number";
      },
    });
    if (p.isCancel(amount)) {
      p.outro("Setup cancelled.");
      process.exit(0);
    }
    const s = p.spinner();
    s.start("Depositing USDC...");
    await ctx.account.gaslessDeposit(parseFloat(amount as string));
    s.stop(`Deposited $${parseFloat(amount as string).toFixed(2)} USDC`);
  }
}

// ---------------------------------------------------------------------------
// setup — check wallet status or generate a new wallet
// ---------------------------------------------------------------------------

async function setup(flags: Record<string, string>): Promise<void> {
  const privateKey =
    flags["private-key"] ?? process.env.CONTEXT_PRIVATE_KEY;

  // JSON mode: keep existing behavior exactly
  if (getOutputMode() === "json") {
    if (!privateKey) {
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
          "Run `context approve` to approve contracts for trading.",
          "Run `context deposit <amount>` to deposit USDC into the exchange.",
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
            "Run `context approve` to approve contracts.",
            "Run `context deposit <amount>` to deposit.",
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
    p.log.success(
      `Wallet detected from ${flags["private-key"] ? "--private-key flag" : "CONTEXT_PRIVATE_KEY env"}`,
    );
    p.log.info(`Address: ${account.address}`);

    const ctx = tradingClient(flags as ClientFlags);
    await onboardingFlow(ctx);
    p.outro(chalk.green("Setup complete! You're ready to trade."));
  } else {
    // No wallet configured — generate or import
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
      // Set in env so tradingClient picks it up for the rest of this session
      process.env.CONTEXT_API_KEY = apiKey as string;
    }

    // Set key in env so tradingClient picks it up for the rest of this session
    process.env.CONTEXT_PRIVATE_KEY = key;

    // Continue with approve → mint → deposit flow
    const ctx = tradingClient(flags as ClientFlags);
    await onboardingFlow(ctx);
    p.outro(chalk.green("Setup complete! You're ready to trade."));
  }
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
    usdcApprovalTx: result.usdcApproval.txHash,
    operatorApprovalTx: result.operatorApproval.txHash,
    wallet: walletStatus,
    nextSteps: [
      "Run `context deposit <amount>` to deposit USDC into the exchange.",
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
    "context gasless-deposit <amount>",
  );

  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) {
    fail("Deposit amount must be a positive number.", { received: raw });
  }

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.account.gaslessDeposit(amount);
  out(result);
}
