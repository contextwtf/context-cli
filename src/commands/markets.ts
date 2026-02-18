// ---------------------------------------------------------------------------
// Markets commands — read-only market data (list, get, quotes, orderbook, …)
// ---------------------------------------------------------------------------

import { readClient, type ClientFlags } from "../client.js";
import {
  out,
  fail,
  requirePositional,
  requireFlag,
  type ParsedArgs,
} from "../format.js";

const HELP = `Usage: context-cli markets <subcommand> [options]

Subcommands:
  list                              Search / browse markets
    --query <text>                    Full-text search
    --status <status>                 Filter by status
    --limit <n>                       Max results
    --sort-by <field>                 Sort field
    --sort <asc|desc>                 Sort direction
    --visibility <value>              Visibility filter
    --resolution-status <value>       Resolution status filter
    --creator <address>               Filter by creator
    --category <slug>                 Filter by category
    --cursor <token>                  Pagination cursor

  get <id>                          Get a single market by ID
  quotes <id>                       Current quotes for a market
  orderbook <id>                    Full orderbook (YES and NO sides)
    --depth <n>                       Number of price levels

  simulate <id>                     Simulate a trade
    --side <yes|no>                   (required) Trade side
    --amount <n>                      (required) Trade amount
    --amount-type <usd|contracts>     Amount type (default: usd)
    --trader <address>                Trader address

  price-history <id>                Price history for a market
    --timeframe <1h|6h|1d|1w|1M|all> Timeframe

  oracle <id>                       Oracle info for a market
  oracle-quotes <id>                Oracle quotes for a market
  request-oracle-quote <id>         Request a new oracle quote

  activity <id>                     Activity feed for a market
    --limit <n>                       Max results
    --cursor <token>                  Pagination cursor

  global-activity                   Global activity feed
    --limit <n>                       Max results
    --cursor <token>                  Pagination cursor

  help                              Show this help text

Global options:
  --api-key <key>                   Context API key (or CONTEXT_API_KEY env)`;

export default async function handleMarkets(
  parsed: ParsedArgs,
): Promise<void> {
  const { subcommand, positional, flags } = parsed;

  switch (subcommand) {
    case "list":
      return list(flags);
    case "get":
      return get(positional, flags);
    case "quotes":
      return quotes(positional, flags);
    case "orderbook":
      return orderbook(positional, flags);
    case "simulate":
      return simulate(positional, flags);
    case "price-history":
      return priceHistory(positional, flags);
    case "oracle":
      return oracle(positional, flags);
    case "oracle-quotes":
      return oracleQuotes(positional, flags);
    case "request-oracle-quote":
      return requestOracleQuote(positional, flags);
    case "activity":
      return activity(positional, flags);
    case "global-activity":
      return globalActivity(flags);
    case "help":
    case undefined:
      console.log(HELP);
      return;
    default:
      fail(`Unknown markets subcommand: "${subcommand}". Run "context-cli markets help" for usage.`);
  }
}

// ---------------------------------------------------------------------------
// list — search / browse markets
// ---------------------------------------------------------------------------

async function list(flags: Record<string, string>): Promise<void> {
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.list({
    query: flags["query"] || undefined,
    status: flags["status"] || undefined,
    sortBy: flags["sort-by"] || undefined,
    sort: flags["sort"] || undefined,
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
    cursor: flags["cursor"] || undefined,
    visibility: flags["visibility"] || undefined,
    resolutionStatus: flags["resolution-status"] || undefined,
    creator: flags["creator"] || undefined,
    category: flags["category"] || undefined,
  });

  out(result);
}

// ---------------------------------------------------------------------------
// get — single market by ID
// ---------------------------------------------------------------------------

async function get(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli markets get <id>");
  const ctx = readClient(flags as ClientFlags);

  const market = await ctx.markets.get(id);
  out(market);
}

// ---------------------------------------------------------------------------
// quotes — current quotes for a market
// ---------------------------------------------------------------------------

async function quotes(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli markets quotes <id>");
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.quotes(id);
  out(result);
}

// ---------------------------------------------------------------------------
// orderbook — orderbook for a market
// ---------------------------------------------------------------------------

async function orderbook(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli markets orderbook <id>");
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.fullOrderbook(id, {
    depth: flags["depth"] ? parseInt(flags["depth"], 10) : undefined,
  });

  out(result);
}

// ---------------------------------------------------------------------------
// simulate — simulate a trade
// ---------------------------------------------------------------------------

async function simulate(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli markets simulate <id> --side <yes|no> --amount <n>");
  const side = requireFlag(flags, "side", "context-cli markets simulate <id> --side <yes|no> --amount <n>");
  const amountRaw = requireFlag(flags, "amount", "context-cli markets simulate <id> --side <yes|no> --amount <n>");

  if (side !== "yes" && side !== "no") {
    fail("--side must be 'yes' or 'no'", { received: side });
  }

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) {
    fail("--amount must be a positive number", { received: amountRaw });
  }

  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.simulate(id, {
    side: side as "yes" | "no",
    amount,
    amountType:
      flags["amount-type"] === "contracts" ? "contracts" : "usd",
    trader: flags["trader"] || undefined,
  });

  out(result);
}

// ---------------------------------------------------------------------------
// price-history — price history for a market
// ---------------------------------------------------------------------------

async function priceHistory(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli markets price-history <id>");
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.priceHistory(id, {
    timeframe: (flags["timeframe"] as any) || undefined,
  });

  out(result);
}

// ---------------------------------------------------------------------------
// oracle — oracle info for a market
// ---------------------------------------------------------------------------

async function oracle(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli markets oracle <id>");
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.oracle(id);
  out(result);
}

// ---------------------------------------------------------------------------
// oracle-quotes — oracle quotes for a market
// ---------------------------------------------------------------------------

async function oracleQuotes(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli markets oracle-quotes <id>");
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.oracleQuotes(id);
  out(result);
}

// ---------------------------------------------------------------------------
// request-oracle-quote — request a new oracle quote
// ---------------------------------------------------------------------------

async function requestOracleQuote(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli markets request-oracle-quote <id>");
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.requestOracleQuote(id);
  out(result);
}

// ---------------------------------------------------------------------------
// activity — activity feed for a market
// ---------------------------------------------------------------------------

async function activity(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli markets activity <id>");
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.activity(id, {
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
    cursor: flags["cursor"] || undefined,
  });

  out(result);
}

// ---------------------------------------------------------------------------
// global-activity — global activity feed
// ---------------------------------------------------------------------------

async function globalActivity(
  flags: Record<string, string>,
): Promise<void> {
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.globalActivity({
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
    cursor: flags["cursor"] || undefined,
  });

  out(result);
}
