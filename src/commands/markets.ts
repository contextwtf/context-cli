// ---------------------------------------------------------------------------
// Markets commands — read-only market data (list, get, quotes, orderbook, …)
// ---------------------------------------------------------------------------

import { readClient, tradingClient, type ClientFlags } from "../client.js";
import {
  out,
  fail,
  requirePositional,
  requireFlag,
  type ParsedArgs,
} from "../format.js";
import {
  formatCents,
  formatPrice,
  formatMoney,
  formatVolume,
  formatAddress,
  formatDate,
  truncate,
} from "../ui/format.js";

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

  const result = await ctx.markets.list({
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
    rows: (result as any).markets || [],
    columns: [
      { key: "shortQuestion", label: "Question", format: (v) => truncate(v as string, 34) },
      { key: "outcomePrices[1].currentPrice", label: "Yes", format: formatPrice },
      { key: "outcomePrices[0].currentPrice", label: "No", format: formatPrice },
      { key: "volume", label: "Volume", format: formatVolume },
      { key: "status", label: "Status", format: (v) => String(v ?? "\u2014") },
    ],
    numbered: true,
    emptyMessage: "No markets found.",
    cursor: (result as any).cursor || null,
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

  const market = await ctx.markets.get(id);
  const m = market as any;
  out(market, {
    detail: [
      ["ID", String(m.id || "\u2014")],
      ["Question", String(m.question || m.shortQuestion || "\u2014")],
      ["Status", String(m.status || "\u2014")],
      ["Yes", m.outcomePrices?.[1] ? `${formatPrice(m.outcomePrices[1].bestBid)} bid / ${formatPrice(m.outcomePrices[1].bestAsk)} ask` : "\u2014"],
      ["No", m.outcomePrices?.[0] ? `${formatPrice(m.outcomePrices[0].bestBid)} bid / ${formatPrice(m.outcomePrices[0].bestAsk)} ask` : "\u2014"],
      ["Volume", formatVolume(m.volume)],
      ["24h Volume", formatVolume(m.volume24h)],
      ["Participants", String(m.participantCount ?? "\u2014")],
      ["Deadline", formatDate(m.deadline)],
      ["Creator", formatAddress(m.creator || m.metadata?.creator)],
    ],
  });
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

  const result = await ctx.markets.quotes(id);
  const q = result as any;
  out(result, {
    detail: [
      ["Market", String(q.marketId || "\u2014")],
      ["Yes", `${formatPrice(q.yes?.bid)} bid / ${formatPrice(q.yes?.ask)} ask / ${formatPrice(q.yes?.last)} last`],
      ["No", `${formatPrice(q.no?.bid)} bid / ${formatPrice(q.no?.ask)} ask / ${formatPrice(q.no?.last)} last`],
      ["Spread", q.spread != null ? `${formatPrice(q.spread)}` : "\u2014"],
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

  const result = await ctx.markets.fullOrderbook(id, {
    depth: flags["depth"] ? parseInt(flags["depth"], 10) : undefined,
  });

  const ob = result as any;
  out(result, {
    detail: [
      ["Market", String(ob.marketId || "\u2014")],
      ["Yes Bids", (ob.yes?.bids || []).map((l: any) => `${formatPrice(l.price)} \u00D7 ${l.size}`).join(", ") || "\u2014"],
      ["Yes Asks", (ob.yes?.asks || []).map((l: any) => `${formatPrice(l.price)} \u00D7 ${l.size}`).join(", ") || "\u2014"],
      ["No Bids", (ob.no?.bids || []).map((l: any) => `${formatPrice(l.price)} \u00D7 ${l.size}`).join(", ") || "\u2014"],
      ["No Asks", (ob.no?.asks || []).map((l: any) => `${formatPrice(l.price)} \u00D7 ${l.size}`).join(", ") || "\u2014"],
    ],
  });
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

  const result = await ctx.markets.simulate(id, {
    side: side as "yes" | "no",
    amount,
    amountType:
      flags["amount-type"] === "contracts" ? "contracts" : "usd",
    trader: flags["trader"] || undefined,
  });

  const sim = result as any;
  out(result, {
    detail: [
      ["Market", String(sim.marketId || "\u2014")],
      ["Side", String(sim.side || "\u2014")],
      ["Amount", String(sim.amount ?? "\u2014")],
      ["Est. Contracts", String(sim.estimatedContracts ?? "\u2014")],
      ["Avg Price", formatPrice(sim.estimatedAvgPrice)],
      ["Slippage", sim.estimatedSlippage != null ? `${(sim.estimatedSlippage * 100).toFixed(1)}%` : "\u2014"],
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

  const result = await ctx.markets.activity(id, {
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
    cursor: flags["cursor"] || undefined,
  });

  const act = result as any;
  out(result, {
    rows: act.activity || [],
    columns: [
      { key: "type", label: "Type" },
      { key: "timestamp", label: "Time", format: formatDate },
    ],
    numbered: true,
    emptyMessage: "No activity found.",
    cursor: act.pagination?.cursor || null,
  });
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

  const act = result as any;
  out(result, {
    rows: act.activity || [],
    columns: [
      { key: "type", label: "Type" },
      { key: "timestamp", label: "Time", format: formatDate },
    ],
    numbered: true,
    emptyMessage: "No activity found.",
    cursor: act.pagination?.cursor || null,
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

  const result = await ctx.markets.create(questionId);
  const r = result as any;
  out(result, {
    detail: [
      ["Market ID", String(r.marketId || "—")],
      ["Tx Hash", String(r.txHash || "—")],
    ],
  });
}
