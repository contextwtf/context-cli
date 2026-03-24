// ---------------------------------------------------------------------------
// Markets commands — read-only market data (list, get, quotes, orderbook, …)
// ---------------------------------------------------------------------------

import chalk from "chalk";
import type {
  ActivityResponse,
  CreateMarketResult,
  FullOrderbook,
  Market,
  MarketList,
  PriceTimeframe,
  Quotes,
  SimulateResult,
} from "context-markets";
import { readClient, tradingClient, type ClientFlags } from "../client.js";
import {
  out,
  fail,
  getOutputMode,
  requirePositional,
  requireFlag,
  type ParsedArgs,
} from "../format.js";
import {
  formatPrice,
  formatVolume,
  formatAddress,
  formatDate,
  truncate,
} from "../ui/format.js";

const PRICE_TIMEFRAMES: PriceTimeframe[] = ["1h", "6h", "1d", "1w", "1M", "all"];

function parsePriceTimeframe(raw?: string): PriceTimeframe | undefined {
  if (!raw) return undefined;
  if (PRICE_TIMEFRAMES.includes(raw as PriceTimeframe)) {
    return raw as PriceTimeframe;
  }

  fail("--timeframe must be one of 1h, 6h, 1d, 1w, 1M, all", { received: raw });
}

const HELP = `Usage: context markets <subcommand> [options]

Subcommands:
  list                              Browse markets
    --status <status>                 Filter by status
    --limit <n>                       Max results
    --sort-by <field>                 Sort field
    --sort <asc|desc>                 Sort direction
    --visibility <value>              Visibility filter
    --resolution-status <value>       Resolution status filter
    --creator <address>               Filter by creator
    --category <slug>                 Filter by category
    --cursor <token>                  Pagination cursor

  search <query>                    Search markets by text
    --limit <n>                       Max results (default: 10)
    --offset <n>                      Offset for pagination

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

  link <id>                         Get link to market on context.markets

  activity <id>                     Activity feed for a market
    --limit <n>                       Max results
    --cursor <token>                  Pagination cursor

  global-activity                   Global activity feed
    --limit <n>                       Max results
    --cursor <token>                  Pagination cursor

  create <questionId>               Create a market from a generated question ID

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
    case "search":
      return search(positional, flags);
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
    case "link":
      return link(positional, flags);
    case "activity":
      return activity(positional, flags);
    case "global-activity":
      return globalActivity(flags);
    case "create":
      return create(positional, flags);
    case "help":
    case undefined:
      console.log(HELP);
      return;
    default:
      fail(`Unknown markets subcommand: "${subcommand}". Run "context markets help" for usage.`);
  }
}

// ---------------------------------------------------------------------------
// list — browse markets
// ---------------------------------------------------------------------------

async function list(flags: Record<string, string>): Promise<void> {
  const ctx = readClient(flags as ClientFlags);

  const result: MarketList = await ctx.markets.list({
    status: (flags["status"] as "active" | "pending" | "resolved" | "closed") || undefined,
    sortBy: (flags["sort-by"] as "new" | "volume" | "trending" | "ending" | "chance") || undefined,
    sort: (flags["sort"] as "asc" | "desc") || undefined,
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
    cursor: flags["cursor"] || undefined,
    visibility: (flags["visibility"] as "visible" | "hidden" | "all") || undefined,
    resolutionStatus: flags["resolution-status"] || undefined,
    creator: flags["creator"] || undefined,
    category: flags["category"] || undefined,
  });

  out(result, {
    rows: result.markets || [],
    columns: [
      { key: "shortQuestion", label: "Question", format: (v) => truncate(v as string, 34) },
      { key: "outcomePrices[1].buyPrice", label: "Yes", format: formatPrice },
      { key: "outcomePrices[0].buyPrice", label: "No", format: formatPrice },
      { key: "volume", label: "Volume", format: formatVolume },
      { key: "status", label: "Status", format: (v) => String(v ?? "\u2014") },
    ],
    numbered: true,
    emptyMessage: "No markets found.",
    cursor: result.cursor || null,
  });
}

// ---------------------------------------------------------------------------
// search — search markets by text
// ---------------------------------------------------------------------------

async function search(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const q = requirePositional(positional, 0, "query", "context markets search <query>");
  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.markets.search({
    q,
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
    offset: flags["offset"] ? parseInt(flags["offset"], 10) : undefined,
  });

  out(result, {
    rows: result.markets || [],
    columns: [
      { key: "shortQuestion", label: "Question", format: (v) => truncate(v as string, 34) },
      { key: "outcomePrices[1].currentPrice", label: "Yes", format: formatPrice },
      { key: "outcomePrices[0].currentPrice", label: "No", format: formatPrice },
      { key: "volume", label: "Volume", format: formatVolume },
      { key: "status", label: "Status", format: (v) => String(v ?? "\u2014") },
    ],
    numbered: true,
    emptyMessage: "No markets found.",
  });
}

// ---------------------------------------------------------------------------
// get — single market by ID
// ---------------------------------------------------------------------------

async function get(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context markets get <id>");
  const ctx = readClient(flags as ClientFlags);

  const market: Market = await ctx.markets.get(id);
  out(market, {
    detail: [
      ["ID", String(market.id || "\u2014")],
      ["Question", String(market.question || market.shortQuestion || "\u2014")],
      ["Status", String(market.status || "\u2014")],
      ["Yes", market.outcomePrices?.[1] ? `${formatPrice(market.outcomePrices[1].bestBid)} bid / ${formatPrice(market.outcomePrices[1].bestAsk)} ask` : "\u2014"],
      ["No", market.outcomePrices?.[0] ? `${formatPrice(market.outcomePrices[0].bestBid)} bid / ${formatPrice(market.outcomePrices[0].bestAsk)} ask` : "\u2014"],
      ["Volume", formatVolume(market.volume)],
      ["24h Volume", formatVolume(market.volume24h)],
      ["Participants", String(market.participantCount ?? "\u2014")],
      ["Deadline", formatDate(market.deadline)],
      ["Creator", formatAddress(market.creator)],
    ],
  });
}

// ---------------------------------------------------------------------------
// link — get link to market on context.markets
// ---------------------------------------------------------------------------

async function link(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context markets link <id>");
  const ctx = readClient(flags as ClientFlags);
  const market: Market = await ctx.markets.get(id);

  const slug = market.metadata?.slug || market.id;
  const url = `https://context.markets/markets/${slug}`;

  if (getOutputMode() === "json") {
    out({ url, marketId: market.id, question: market.question || market.shortQuestion });
    return;
  }

  const question = market.question || market.shortQuestion || "—";
  console.log();
  console.log(`  ${chalk.bold(question)}`);
  console.log(`  ${chalk.cyan(url)}`);
  console.log();
}

// ---------------------------------------------------------------------------
// quotes — current quotes for a market
// ---------------------------------------------------------------------------

async function quotes(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context markets quotes <id>");
  const ctx = readClient(flags as ClientFlags);

  const result: Quotes = await ctx.markets.quotes(id);
  out(result, {
    detail: [
      ["Market", String(result.marketId || "\u2014")],
      ["Yes", `${formatPrice(result.yes?.bid)} bid / ${formatPrice(result.yes?.ask)} ask / ${formatPrice(result.yes?.last)} last`],
      ["No", `${formatPrice(result.no?.bid)} bid / ${formatPrice(result.no?.ask)} ask / ${formatPrice(result.no?.last)} last`],
      ["Spread", result.spread != null ? `${formatPrice(result.spread)}` : "\u2014"],
    ],
  });
}

// ---------------------------------------------------------------------------
// orderbook — orderbook for a market
// ---------------------------------------------------------------------------

async function orderbook(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context markets orderbook <id>");
  const ctx = readClient(flags as ClientFlags);

  const result: FullOrderbook = await ctx.markets.fullOrderbook(id, {
    depth: flags["depth"] ? parseInt(flags["depth"], 10) : undefined,
  });

  // JSON mode: raw data
  if (getOutputMode() === "json") {
    out(result);
    return;
  }

  // Visual orderbook
  const yesBids: { price: number; size: number }[] = result.yes?.bids || [];
  const yesAsks: { price: number; size: number }[] = result.yes?.asks || [];
  const noBids: { price: number; size: number }[] = result.no?.bids || [];
  const noAsks: { price: number; size: number }[] = result.no?.asks || [];

  function renderSide(
    label: string,
    bids: { price: number; size: number }[],
    asks: { price: number; size: number }[],
  ) {
    // Find max size for bar scaling
    const allSizes = [...bids, ...asks].map(l => l.size);
    const maxSize = Math.max(...allSizes, 1);
    const barWidth = 20;

    console.log();
    console.log(chalk.bold(`  ${label}`));
    console.log(chalk.dim("  ─────────────────────────────────────────────────"));

    // Asks (sorted high → low so lowest ask is near the spread)
    const sortedAsks = [...asks].sort((a, b) => b.price - a.price);
    if (sortedAsks.length === 0) {
      console.log(chalk.dim("    No asks"));
    } else {
      console.log(chalk.dim("    Price      Size       "));
      for (const level of sortedAsks) {
        const bar = chalk.red("█".repeat(Math.max(1, Math.round((level.size / maxSize) * barWidth))));
        const price = formatPrice(level.price).padStart(8);
        const size = String(level.size).padStart(8);
        console.log(`    ${chalk.red(price)}  ${size}  ${bar}`);
      }
    }

    // Spread line
    const bestBid = bids.length > 0 ? Math.max(...bids.map(b => b.price)) : null;
    const bestAsk = asks.length > 0 ? Math.min(...asks.map(a => a.price)) : null;
    if (bestBid != null && bestAsk != null) {
      const spread = bestAsk - bestBid;
      console.log(chalk.dim(`    ──── spread: ${formatPrice(spread)} ────`));
    } else {
      console.log(chalk.dim("    ────────────────────"));
    }

    // Bids (sorted high → low so highest bid is near the spread)
    const sortedBids = [...bids].sort((a, b) => b.price - a.price);
    if (sortedBids.length === 0) {
      console.log(chalk.dim("    No bids"));
    } else {
      if (sortedAsks.length === 0) {
        console.log(chalk.dim("    Price      Size       "));
      }
      for (const level of sortedBids) {
        const bar = chalk.green("█".repeat(Math.max(1, Math.round((level.size / maxSize) * barWidth))));
        const price = formatPrice(level.price).padStart(8);
        const size = String(level.size).padStart(8);
        console.log(`    ${chalk.green(price)}  ${size}  ${bar}`);
      }
    }
  }

  console.log();
  console.log(chalk.bold(`  Orderbook`) + chalk.dim(` · ${result.marketId || ""}`));

  renderSide("YES", yesBids, yesAsks);
  renderSide("NO", noBids, noAsks);
  console.log();
}

// ---------------------------------------------------------------------------
// simulate — simulate a trade
// ---------------------------------------------------------------------------

async function simulate(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context markets simulate <id> --side <yes|no> --amount <n>");
  const side = requireFlag(flags, "side", "context markets simulate <id> --side <yes|no> --amount <n>");
  const amountRaw = requireFlag(flags, "amount", "context markets simulate <id> --side <yes|no> --amount <n>");

  if (side !== "yes" && side !== "no") {
    fail("--side must be 'yes' or 'no'", { received: side });
  }

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount <= 0) {
    fail("--amount must be a positive number", { received: amountRaw });
  }

  const ctx = readClient(flags as ClientFlags);

  const result: SimulateResult = await ctx.markets.simulate(id, {
    side: side as "yes" | "no",
    amount,
    amountType:
      flags["amount-type"] === "contracts" ? "contracts" : "usd",
    trader: flags["trader"] || undefined,
  });

  out(result, {
    detail: [
      ["Market", String(result.marketId || "\u2014")],
      ["Side", String(result.side || "\u2014")],
      ["Amount", String(result.amount ?? "\u2014")],
      ["Est. Contracts", String(result.estimatedContracts ?? "\u2014")],
      ["Avg Price", formatPrice(result.estimatedAvgPrice)],
      ["Slippage", result.estimatedSlippage != null ? `${(result.estimatedSlippage * 100).toFixed(1)}%` : "\u2014"],
    ],
  });
}

// ---------------------------------------------------------------------------
// price-history — price history for a market
// ---------------------------------------------------------------------------

async function priceHistory(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context markets price-history <id>");
  const ctx = readClient(flags as ClientFlags);
  const timeframe = parsePriceTimeframe(flags["timeframe"]);

  const result = await ctx.markets.priceHistory(id, {
    timeframe,
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
  const id = requirePositional(positional, 0, "id", "context markets oracle <id>");
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
  const id = requirePositional(positional, 0, "id", "context markets oracle-quotes <id>");
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
  const id = requirePositional(positional, 0, "id", "context markets request-oracle-quote <id>");
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
  const id = requirePositional(positional, 0, "id", "context markets activity <id>");
  const ctx = readClient(flags as ClientFlags);

  const result: ActivityResponse = await ctx.markets.activity(id, {
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
    cursor: flags["cursor"] || undefined,
  });

  out(result, {
    rows: result.activity || [],
    columns: [
      { key: "type", label: "Type" },
      { key: "timestamp", label: "Time", format: formatDate },
    ],
    numbered: true,
    emptyMessage: "No activity found.",
    cursor: result.pagination?.cursor || null,
  });
}

// ---------------------------------------------------------------------------
// global-activity — global activity feed
// ---------------------------------------------------------------------------

async function globalActivity(
  flags: Record<string, string>,
): Promise<void> {
  const ctx = readClient(flags as ClientFlags);

  const result: ActivityResponse = await ctx.markets.globalActivity({
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
    cursor: flags["cursor"] || undefined,
  });

  out(result, {
    rows: result.activity || [],
    columns: [
      { key: "type", label: "Type" },
      { key: "timestamp", label: "Time", format: formatDate },
    ],
    numbered: true,
    emptyMessage: "No activity found.",
    cursor: result.pagination?.cursor || null,
  });
}

// ---------------------------------------------------------------------------
// create — create a market from a generated question ID
// ---------------------------------------------------------------------------

async function create(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const questionId = requirePositional(positional, 0, "questionId", "context markets create <questionId>");
  const ctx = tradingClient(flags as ClientFlags);

  const result: CreateMarketResult = await ctx.markets.create(questionId);
  out(result, {
    detail: [
      ["Market ID", String(result.marketId || "—")],
      ["Tx Hash", String(result.txHash || "—")],
    ],
  });
}
