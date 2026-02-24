// ---------------------------------------------------------------------------
// Portfolio commands — positions, balances, claimable winnings, stats
// ---------------------------------------------------------------------------

import type { Address } from "viem";
import { readClient, tradingClient, type ClientFlags } from "../client.js";
import { out, fail, requirePositional, type ParsedArgs } from "../format.js";
import { formatMoney, truncate, formatAddress } from "../ui/format.js";

const HELP = `Usage: context-cli portfolio <subcommand> [options]

Subcommands:
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
      fail(`Unknown portfolio subcommand: "${subcommand}". Run "context-cli portfolio help" for usage.`);
  }
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
    kind: (flags["kind"] as any) || undefined,
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
      { key: "balance", label: "Shares", format: formatMoney },
      { key: "netInvestment", label: "Invested", format: formatMoney },
      { key: "currentValue", label: "Value", format: formatMoney },
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

  const result = await ctx.portfolio.claimable(address);
  const c = result as any;
  out(result, {
    detail: [
      ["Total Claimable", formatMoney(c.totalClaimable)],
      ["Positions", String((c.positions || []).length)],
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

  const result = await ctx.portfolio.balance(address);
  const b = result as any;
  out(result, {
    detail: [
      ["Address", String(b.address || "—")],
      ["USDC Balance", formatMoney(b.usdc?.balance)],
      ["Settlement", formatMoney(b.usdc?.settlementBalance)],
      ["Wallet", formatMoney(b.usdc?.walletBalance)],
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
  const usage = "context-cli portfolio token-balance <address> <token-address>";
  const address = requirePositional(positional, 0, "address", usage) as Address;
  const tokenAddress = requirePositional(positional, 1, "token-address", usage) as Address;

  const ctx = readClient(flags as ClientFlags);
  const result = await ctx.portfolio.tokenBalance(address, tokenAddress);
  const tb = result as any;
  out(result, {
    detail: [
      ["Address", formatAddress(tb.address || tb.owner)],
      ["Token", formatAddress(tb.token || tb.tokenAddress)],
      ["Balance", String(tb.balance ?? "—")],
    ],
  });
}
