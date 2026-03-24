// ---------------------------------------------------------------------------
// Portfolio commands — positions, balances, claimable winnings, stats
// ---------------------------------------------------------------------------

import type {
  Balance,
  ClaimableResponse,
  GetPortfolioParams,
  Portfolio,
  PortfolioStats,
  TokenBalance,
} from "context-markets";
import type { Address } from "viem";
import chalk from "chalk";
import { readClient, tradingClient, type ClientFlags } from "../client.js";
import { out, fail, getOutputMode, requirePositional, type ParsedArgs } from "../format.js";
import { formatVolume, truncate, formatAddress } from "../ui/format.js";

const PORTFOLIO_KINDS: NonNullable<GetPortfolioParams["kind"]>[] = ["all", "active", "won", "lost", "claimable"];

function parsePortfolioKind(raw?: string): GetPortfolioParams["kind"] | undefined {
  if (!raw) return undefined;
  if (PORTFOLIO_KINDS.includes(raw as NonNullable<GetPortfolioParams["kind"]>)) {
    return raw as GetPortfolioParams["kind"];
  }

  fail("--kind must be one of all, active, won, lost, claimable", { received: raw });
}

const HELP = `Usage: context portfolio <subcommand> [options]

Subcommands:
  overview                          Full portfolio snapshot (balance + stats + positions)
    --address <addr>                  Query a specific address (read-only)

  get                               Get portfolio positions
    --address <addr>                  Query a specific address (read-only)
    --kind <all|active|won|lost|claimable>  Filter by position kind
    --market <id>                     Filter by market
    --cursor <token>                  Pagination cursor
    --page-size <n>                   Results per page

  claimable                         Get claimable winnings
    --address <addr>                  Query a specific address (read-only)

  stats                             Get portfolio statistics
    --address <addr>                  Query a specific address (read-only)

  balance                           Get account balance
    --address <addr>                  Query a specific address (read-only)

  token-balance <address> <token-address>
                                    Get token balance for an address (read-only)

  help                              Show this help text

Client behaviour:
  If --address is given the command uses a read-only client (no signer needed).
  Otherwise the trading client is used and the signer's own address is implied.

Global options:
  --api-key <key>                   Context API key (or CONTEXT_API_KEY env)
  --private-key <key>               Private key for signing (or CONTEXT_PRIVATE_KEY env)`;

export default async function handlePortfolio(
  parsed: ParsedArgs,
): Promise<void> {
  const { subcommand, positional, flags } = parsed;

  switch (subcommand) {
    case "overview":
      return overview(flags);
    case "get":
      return getPortfolio(flags);
    case "claimable":
      return claimable(flags);
    case "stats":
      return stats(flags);
    case "balance":
      return balance(flags);
    case "token-balance":
      return tokenBalance(positional, flags);
    case "help":
    case undefined:
      console.log(HELP);
      return;
    default:
      fail(`Unknown portfolio subcommand: "${subcommand}". Run "context portfolio help" for usage.`);
  }
}

// ---------------------------------------------------------------------------
// overview — full portfolio snapshot
// ---------------------------------------------------------------------------

async function overview(flags: Record<string, string>): Promise<void> {
  const ctx = clientFor(flags);
  const address = addressFlag(flags);

  // Fetch balance, stats, and active positions in parallel
  const [balanceResult, statsResult, positionsResult]: [Balance, PortfolioStats, Portfolio] = await Promise.all([
    ctx.portfolio.balance(address),
    ctx.portfolio.stats(address),
    ctx.portfolio.get(address, { kind: "active", pageSize: 10 }),
  ]);

  const positions = positionsResult.portfolio || [];

  // JSON mode: return combined data
  if (getOutputMode() === "json") {
    out({ balance: balanceResult, stats: statsResult, activePositions: positions });
    return;
  }

  // Table mode: formatted snapshot
  console.log();
  console.log(chalk.bold("  Portfolio Overview"));
  console.log(chalk.dim("  ─────────────────────────────────────"));

  // Balance section
  console.log();
  console.log(chalk.bold("  Balance"));
  console.log(`    USDC Balance     ${formatVolume(balanceResult.usdc?.balance)}`);
  console.log(`    Settlement       ${formatVolume(balanceResult.usdc?.settlementBalance)}`);
  console.log(`    Wallet           ${formatVolume(balanceResult.usdc?.walletBalance)}`);

  // Stats section
  if (statsResult) {
    console.log();
    console.log(chalk.bold("  Stats"));
    const statKeys = Object.keys(statsResult) as Array<keyof PortfolioStats>;
    for (const key of statKeys) {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).padEnd(18);
      const value = statsResult[key];
      const val = typeof value === "number" ? formatVolume(value) : String(value ?? "—");
      console.log(`    ${label} ${val}`);
    }
  }

  // Active positions
  console.log();
  if (positions.length === 0) {
    console.log(chalk.dim("  No active positions."));
  } else {
    console.log(chalk.bold("  Active Positions"));
    out(positionsResult, {
      rows: positions,
      columns: [
        { key: "marketId", label: "Market", format: (v) => truncate(v as string, 14) },
        { key: "outcomeName", label: "Outcome", format: (v) => String(v ?? "—") },
        { key: "balance", label: "Shares", format: formatVolume },
        { key: "netInvestment", label: "Invested", format: formatVolume },
        { key: "currentValue", label: "Value", format: formatVolume },
      ],
      numbered: true,
      emptyMessage: "No positions found.",
    });
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pick the right client based on whether --address was provided.
 * When an explicit address is given we only need a read-only client;
 * otherwise we need the trading client so the SDK can derive the signer's
 * own address.
 */
function clientFor(flags: Record<string, string>) {
  return flags["address"]
    ? readClient(flags as ClientFlags)
    : tradingClient(flags as ClientFlags);
}

/** Return the --address flag cast to Address | undefined */
function addressFlag(flags: Record<string, string>): Address | undefined {
  return (flags["address"] || undefined) as Address | undefined;
}

// ---------------------------------------------------------------------------
// get — portfolio positions
// ---------------------------------------------------------------------------

async function getPortfolio(flags: Record<string, string>): Promise<void> {
  const ctx = clientFor(flags);
  const address = addressFlag(flags);

  const result = await ctx.portfolio.get(address, {
    kind: parsePortfolioKind(flags["kind"]),
    marketId: flags["market"] || undefined,
    cursor: flags["cursor"] || undefined,
    pageSize: flags["page-size"]
      ? parseInt(flags["page-size"], 10)
      : undefined,
  });

  out(result, {
    rows: result.portfolio || [],
    columns: [
      { key: "marketId", label: "Market", format: (v) => truncate(v as string, 14) },
      { key: "outcomeName", label: "Outcome", format: (v) => String(v ?? "—") },
      { key: "balance", label: "Shares", format: formatVolume },
      { key: "netInvestment", label: "Invested", format: formatVolume },
      { key: "currentValue", label: "Value", format: formatVolume },
    ],
    numbered: true,
    emptyMessage: "No positions found.",
    cursor: result.cursor || null,
  });
}

// ---------------------------------------------------------------------------
// claimable — claimable winnings
// ---------------------------------------------------------------------------

async function claimable(flags: Record<string, string>): Promise<void> {
  const ctx = clientFor(flags);
  const address = addressFlag(flags);

  const result: ClaimableResponse = await ctx.portfolio.claimable(address);
  out(result, {
    detail: [
      ["Total Claimable", formatVolume(result.totalClaimable)],
      ["Positions", String((result.positions || []).length)],
    ],
  });
}

// ---------------------------------------------------------------------------
// stats — portfolio statistics
// ---------------------------------------------------------------------------

async function stats(flags: Record<string, string>): Promise<void> {
  const ctx = clientFor(flags);
  const address = addressFlag(flags);

  const result = await ctx.portfolio.stats(address);
  out(result);
}

// ---------------------------------------------------------------------------
// balance — account balance
// ---------------------------------------------------------------------------

async function balance(flags: Record<string, string>): Promise<void> {
  const ctx = clientFor(flags);
  const address = addressFlag(flags);

  const result: Balance = await ctx.portfolio.balance(address);
  out(result, {
    detail: [
      ["Address", String(result.address || "—")],
      ["USDC Balance", formatVolume(result.usdc?.balance)],
      ["Settlement", formatVolume(result.usdc?.settlementBalance)],
      ["Wallet", formatVolume(result.usdc?.walletBalance)],
    ],
  });
}

// ---------------------------------------------------------------------------
// token-balance — token balance for an address (read-only)
// ---------------------------------------------------------------------------

async function tokenBalance(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const usage = "context portfolio token-balance <address> <token-address>";
  const address = requirePositional(positional, 0, "address", usage) as Address;
  const tokenAddress = requirePositional(positional, 1, "token-address", usage) as Address;

  const ctx = readClient(flags as ClientFlags);
  const result: TokenBalance = await ctx.portfolio.tokenBalance(address, tokenAddress);
  out(result, {
    detail: [
      ["Address", formatAddress(address)],
      ["Token", formatAddress(tokenAddress)],
      ["Balance", String(result.balance ?? "—")],
      ["Symbol", String(result.symbol ?? "—")],
    ],
  });
}
