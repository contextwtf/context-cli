// ---------------------------------------------------------------------------
// Orders commands — list, create, cancel, bulk operations
// ---------------------------------------------------------------------------

import type { Address, Hex } from "viem";
import type { OrderStatus } from "context-markets";
import { readClient, tradingClient, type ClientFlags } from "../client.js";
import {
  out,
  fail,
  requireFlag,
  requirePositional,
  type ParsedArgs,
} from "../format.js";
import { formatCents, formatPrice, formatAddress, truncate, formatDate } from "../ui/format.js";
import { confirmOrder, confirmAction } from "../ui/prompt.js";

const HELP = `Usage: context orders <subcommand> [options]

Subcommands:
  list                              List orders
    --trader <address>                Filter by trader (uses readClient)
    --market <id>                     Filter by market
    --status <status>                 Filter by status
    --cursor <token>                  Pagination cursor
    --limit <n>                       Max results

  mine                              List your own orders (requires signer)
    --market <id>                     Filter by market

  get <id>                          Get a single order by ID

  recent                            Recent orders (requires signer)
    --trader <address>                Filter by trader
    --market <id>                     Filter by market
    --status <status>                 Filter by status
    --limit <n>                       Max results
    --window-seconds <n>              Time window in seconds

  simulate                          Simulate an order (read-only)
    --market <id>                     (required) Market ID
    --outcome <yes|no>                Outcome (default: yes)
    --side <bid|ask>                  Side (default: bid)
    --price <n>                       Max price
    --size <n>                        Max size
    --trader <address>                Trader address

  create                            Place a limit order (requires signer)
    --market <id>                     (required) Market ID
    --outcome <yes|no>                (required) Outcome
    --side <buy|sell>                 (required) Side
    --price <1-99>                    (required) Price in cents
    --size <n>                        (required) Size (>=1)
    --expiry-seconds <n>              Expiry in seconds (optional)
    --inventory-mode <mode>           any (default), hold (require tokens), mint (mint on fill)
    --maker-role <role>               any (default), taker (fill-only). Do NOT use maker — breaks settlement.

  market                            Place a market order (requires signer)
    --market <id>                     (required) Market ID
    --outcome <yes|no>                (required) Outcome
    --side <buy|sell>                 (required) Side
    --max-price <1-99>                (required) Max price in cents
    --max-size <n>                    (required) Max size (>=1)
    --expiry-seconds <n>              Expiry in seconds (optional)

  cancel <nonce>                    Cancel an order by nonce (requires signer)

  cancel-replace <nonce>            Cancel and replace an order (requires signer)
    (same flags as create)

  bulk-create                       Create multiple orders (requires signer)
    --orders <json>                   JSON array of PlaceOrderRequest objects

  bulk-cancel                       Cancel multiple orders (requires signer)
    --nonces <hex,hex,...>            Comma-separated nonces

  bulk                              Create and cancel in one call (requires signer)
    --creates <json>                  JSON array of PlaceOrderRequest objects
    --cancels <hex,hex,...>           Comma-separated nonces to cancel

  help                              Show this help text

Global options:
  --api-key <key>                   Context API key (or CONTEXT_API_KEY env)
  --private-key <key>               Private key for signing (or CONTEXT_PRIVATE_KEY env)`;

export default async function handleOrders(
  parsed: ParsedArgs,
): Promise<void> {
  const { subcommand, positional, flags } = parsed;

  switch (subcommand) {
    case "list":
      return list(flags);
    case "mine":
      return mine(flags);
    case "get":
      return get(positional, flags);
    case "recent":
      return recent(flags);
    case "simulate":
      return simulate(flags);
    case "create":
      return create(flags);
    case "market":
      return marketOrder(flags);
    case "cancel":
      return cancel(positional, flags);
    case "cancel-replace":
      return cancelReplace(positional, flags);
    case "bulk-create":
      return bulkCreate(flags);
    case "bulk-cancel":
      return bulkCancel(flags);
    case "bulk":
      return bulk(flags);
    case "help":
    case undefined:
      console.log(HELP);
      return;
    default:
      fail(`Unknown orders subcommand: "${subcommand}". Run "context orders help" for usage.`);
  }
}

// ---------------------------------------------------------------------------
// Shared column config for order list tables
// ---------------------------------------------------------------------------

const ORDER_LIST_COLUMNS = [
  { key: "nonce", label: "Nonce", format: (v: unknown) => truncate(v as string, 14) },
  { key: "marketId", label: "Market", format: (v: unknown) => truncate(v as string, 14) },
  { key: "side", label: "Side", format: (v: unknown) => String(v ?? "\u2014").toUpperCase() },
  { key: "outcomeIndex", label: "Outcome", format: (v: unknown) => (v === 1 || v === "1") ? "YES" : "NO" },
  { key: "price", label: "Price", format: (v: unknown) => formatPrice(v as number) },
  { key: "size", label: "Size", format: (v: unknown) => String(v ?? "\u2014") },
  { key: "status", label: "Status", format: (v: unknown) => String(v ?? "\u2014") },
  { key: "percentFilled", label: "Filled", format: (v: unknown) => v != null ? `${v}%` : "\u2014" },
];

// ---------------------------------------------------------------------------
// list — list orders (readClient if --trader given, tradingClient otherwise)
// ---------------------------------------------------------------------------

async function list(flags: Record<string, string>): Promise<void> {
  const ctx = flags["trader"]
    ? readClient(flags as ClientFlags)
    : tradingClient(flags as ClientFlags);

  const result = await ctx.orders.list({
    trader: (flags["trader"] || undefined) as Address | undefined,
    marketId: flags["market"] || undefined,
    status: (flags["status"] || undefined) as OrderStatus | undefined,
    cursor: flags["cursor"] || undefined,
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
  });

  out(result, {
    rows: result.orders || [],
    columns: ORDER_LIST_COLUMNS,
    numbered: true,
    emptyMessage: "No orders found.",
    cursor: result.cursor || null,
  });
}

// ---------------------------------------------------------------------------
// mine — list own orders (requires signer)
// ---------------------------------------------------------------------------

async function mine(flags: Record<string, string>): Promise<void> {
  const ctx = tradingClient(flags as ClientFlags);

  const result = await ctx.orders.mine(flags["market"] || undefined);
  out(result, {
    rows: result.orders || [],
    columns: ORDER_LIST_COLUMNS,
    numbered: true,
    emptyMessage: "No orders found.",
    cursor: result.cursor || null,
  });
}

// ---------------------------------------------------------------------------
// get — get a single order by ID (read-only)
// ---------------------------------------------------------------------------

async function get(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context orders get <id>");
  const ctx = readClient(flags as ClientFlags);

  const order = await ctx.orders.get(id);
  const o = order as any;
  out(order, {
    detail: [
      ["Nonce", String(o.nonce || "\u2014")],
      ["Market", String(o.marketId || "\u2014")],
      ["Status", String(o.status || "\u2014")],
      ["Side", String(o.side ?? "\u2014").toUpperCase()],
      ["Outcome", (o.outcomeIndex === 1 || o.outcomeIndex === "1") ? "YES" : "NO"],
      ["Price", formatPrice(o.price)],
      ["Size", String(o.size || "\u2014")],
      ["Filled", o.percentFilled != null ? `${o.percentFilled}%` : "\u2014"],
      ["Trader", formatAddress(o.trader)],
      ["Created", formatDate(o.insertedAt)],
    ],
  });
}

// ---------------------------------------------------------------------------
// recent — recent orders (requires signer)
// ---------------------------------------------------------------------------

async function recent(flags: Record<string, string>): Promise<void> {
  const ctx = tradingClient(flags as ClientFlags);

  const result = await ctx.orders.recent({
    trader: (flags["trader"] || undefined) as Address | undefined,
    marketId: flags["market"] || undefined,
    status: (flags["status"] || undefined) as OrderStatus | undefined,
    limit: flags["limit"] ? parseInt(flags["limit"], 10) : undefined,
    windowSeconds: flags["window-seconds"]
      ? parseInt(flags["window-seconds"], 10)
      : undefined,
  });

  out(result, {
    rows: result.orders || [],
    columns: ORDER_LIST_COLUMNS,
    numbered: true,
    emptyMessage: "No orders found.",
    cursor: result.cursor || null,
  });
}

// ---------------------------------------------------------------------------
// simulate — simulate an order (read-only)
// ---------------------------------------------------------------------------

async function simulate(flags: Record<string, string>): Promise<void> {
  const marketId = requireFlag(flags, "market", "context orders simulate --market <id>");
  const trader = requireFlag(flags, "trader", "context orders simulate --market <id> --trader <address> --size <n> --price <n>");
  const sizeRaw = requireFlag(flags, "size", "context orders simulate --market <id> --trader <address> --size <n> --price <n>");
  const priceRaw = requireFlag(flags, "price", "context orders simulate --market <id> --trader <address> --size <n> --price <n>");

  const outcome = flags["outcome"] ?? "yes";
  if (outcome !== "yes" && outcome !== "no") {
    fail("--outcome must be 'yes' or 'no'", { received: outcome });
  }

  const side = flags["side"] ?? "bid";
  if (side !== "bid" && side !== "ask") {
    fail("--side must be 'bid' or 'ask'", { received: side });
  }

  const ctx = readClient(flags as ClientFlags);

  const result = await ctx.orders.simulate({
    marketId,
    trader,
    maxSize: sizeRaw,
    maxPrice: priceRaw,
    outcomeIndex: outcome === "yes" ? 1 : 0,
    side: side as "bid" | "ask",
  });

  out(result);
}

// ---------------------------------------------------------------------------
// create — place an order (requires signer)
// ---------------------------------------------------------------------------

function parsePlaceOrderFlags(flags: Record<string, string>, usage: string) {
  const marketId = requireFlag(flags, "market", usage);
  const outcome = requireFlag(flags, "outcome", usage);
  const side = requireFlag(flags, "side", usage);
  const priceRaw = requireFlag(flags, "price", usage);
  const sizeRaw = requireFlag(flags, "size", usage);

  if (outcome !== "yes" && outcome !== "no") {
    fail("--outcome must be 'yes' or 'no'", { received: outcome });
  }

  if (side !== "buy" && side !== "sell") {
    fail("--side must be 'buy' or 'sell'", { received: side });
  }

  const priceCents = parseInt(priceRaw, 10);
  if (isNaN(priceCents) || priceCents < 1 || priceCents > 99) {
    fail("--price must be between 1 and 99 (cents)", { received: priceRaw });
  }

  const size = parseFloat(sizeRaw);
  if (isNaN(size) || size < 1) {
    fail("--size must be >= 1", { received: sizeRaw });
  }

  const INVENTORY_MODES: Record<string, 0 | 1 | 2> = { any: 0, hold: 1, mint: 2 };
  const MAKER_ROLES: Record<string, 0 | 2> = { any: 0, taker: 2 };

  let inventoryMode: 0 | 1 | 2 | undefined;
  if (flags["inventory-mode"]) {
    inventoryMode = INVENTORY_MODES[flags["inventory-mode"]];
    if (inventoryMode === undefined) {
      fail("--inventory-mode must be 'any', 'hold', or 'mint'", { received: flags["inventory-mode"] });
    }
  }

  let makerRole: 0 | 2 | undefined;
  if (flags["maker-role"]) {
    if (flags["maker-role"] === "maker" || flags["maker-role"] === "1") {
      fail("makerRoleConstraint=1 (maker/post-only) breaks settlement when two maker-only orders cross — use 'any' instead", { received: flags["maker-role"] });
    }
    makerRole = MAKER_ROLES[flags["maker-role"]];
    if (makerRole === undefined) {
      fail("--maker-role must be 'any' or 'taker'", { received: flags["maker-role"] });
    }
  }

  return {
    marketId,
    outcome: outcome as "yes" | "no",
    side: side as "buy" | "sell",
    priceCents,
    size,
    expirySeconds: flags["expiry-seconds"]
      ? parseInt(flags["expiry-seconds"], 10)
      : undefined,
    inventoryModeConstraint: inventoryMode,
    makerRoleConstraint: makerRole,
  };
}

async function create(flags: Record<string, string>): Promise<void> {
  const usage =
    "context orders create --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n>";
  const order = parsePlaceOrderFlags(flags, usage);

  await confirmOrder({
    market: order.marketId,
    side: order.side,
    outcome: order.outcome,
    price: `${order.priceCents}¢`,
    size: String(order.size),
    estimatedCost: `$${((order.priceCents / 100) * order.size).toFixed(2)} USDC`,
  }, flags);

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.create(order);
  const r = result as any;
  out(result, {
    detail: [
      ["Status", r.success ? "\u2713 Order placed" : "\u2717 Failed"],
      ["Nonce", String(r.order?.nonce || "\u2014")],
      ["Market", String(r.order?.marketId || "\u2014")],
      ["Type", String(r.order?.type || "\u2014")],
      ["Order Status", String(r.order?.status || "\u2014")],
      ["Filled", r.order?.percentFilled != null ? `${r.order.percentFilled}%` : "\u2014"],
    ],
  });
}

// ---------------------------------------------------------------------------
// cancel — cancel an order by nonce (requires signer)
// ---------------------------------------------------------------------------

async function cancel(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const nonce = requirePositional(
    positional,
    0,
    "nonce",
    "context orders cancel <nonce>",
  ) as Hex;

  await confirmAction(`Cancel order ${nonce}?`, flags);

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.cancel(nonce);
  const r = result as any;
  out(result, {
    detail: [
      ["Status", r.success ? "\u2713 Cancelled" : "\u2717 Failed"],
      ["Already Cancelled", String(r.alreadyCancelled ?? "\u2014")],
    ],
  });
}

// ---------------------------------------------------------------------------
// cancel-replace — cancel and replace an order (requires signer)
// ---------------------------------------------------------------------------

async function cancelReplace(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const nonce = requirePositional(
    positional,
    0,
    "nonce",
    "context orders cancel-replace <nonce> --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n>",
  ) as Hex;

  const usage =
    "context orders cancel-replace <nonce> --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n>";
  const newOrder = parsePlaceOrderFlags(flags, usage);

  await confirmAction(`Cancel order ${nonce} and place replacement?`, flags);

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.cancelReplace(nonce, newOrder);
  const r = result as any;
  out(result, {
    detail: [
      ["Cancel", r.cancel?.success ? "\u2713 Cancelled" : "\u2717 Failed"],
      ["New Order", r.create?.success ? "\u2713 Created" : "\u2717 Failed"],
      ["New Nonce", String(r.create?.order?.nonce || "\u2014")],
    ],
  });
}

// ---------------------------------------------------------------------------
// bulk-create — create multiple orders (requires signer)
// ---------------------------------------------------------------------------

async function bulkCreate(flags: Record<string, string>): Promise<void> {
  const raw = requireFlag(
    flags,
    "orders",
    'context orders bulk-create --orders \'[{"marketId":"...","outcome":"yes","side":"buy","priceCents":50,"size":10}]\'',
  );

  let orders: unknown;
  try {
    orders = JSON.parse(raw);
  } catch {
    fail("--orders must be valid JSON", { received: raw });
  }

  if (!Array.isArray(orders)) {
    fail("--orders must be a JSON array", { received: raw });
  }

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.bulkCreate(orders);
  out(result);
}

// ---------------------------------------------------------------------------
// bulk-cancel — cancel multiple orders (requires signer)
// ---------------------------------------------------------------------------

async function bulkCancel(flags: Record<string, string>): Promise<void> {
  const raw = requireFlag(
    flags,
    "nonces",
    "context orders bulk-cancel --nonces 0xabc,0xdef",
  );

  const nonces = raw.split(",").map((s) => s.trim()) as Hex[];
  if (nonces.length === 0) {
    fail("--nonces must contain at least one nonce");
  }

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.bulkCancel(nonces);
  out(result);
}

// ---------------------------------------------------------------------------
// bulk — create and cancel in one call (requires signer)
// ---------------------------------------------------------------------------

async function bulk(flags: Record<string, string>): Promise<void> {
  const createsRaw = flags["creates"];
  const cancelsRaw = flags["cancels"];

  if (!createsRaw && !cancelsRaw) {
    fail("At least one of --creates or --cancels is required", {
      usage:
        'context orders bulk --creates \'[...]\' --cancels 0xabc,0xdef',
    });
  }

  let creates: unknown[] = [];
  if (createsRaw) {
    try {
      creates = JSON.parse(createsRaw);
    } catch {
      fail("--creates must be valid JSON", { received: createsRaw });
    }
    if (!Array.isArray(creates)) {
      fail("--creates must be a JSON array", { received: createsRaw });
    }
  }

  const cancelNonces: Hex[] = cancelsRaw
    ? (cancelsRaw.split(",").map((s) => s.trim()) as Hex[])
    : [];

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.bulk(creates as any, cancelNonces);
  out(result);
}

// ---------------------------------------------------------------------------
// market — place a market order (requires signer)
// ---------------------------------------------------------------------------

async function marketOrder(flags: Record<string, string>): Promise<void> {
  const usage =
    "context orders market --market <id> --outcome <yes|no> --side <buy|sell> --max-price <1-99> --max-size <n>";
  const marketId = requireFlag(flags, "market", usage);
  const outcome = requireFlag(flags, "outcome", usage);
  const side = requireFlag(flags, "side", usage);
  const maxPriceRaw = requireFlag(flags, "max-price", usage);
  const maxSizeRaw = requireFlag(flags, "max-size", usage);

  if (outcome !== "yes" && outcome !== "no") {
    fail("--outcome must be 'yes' or 'no'", { received: outcome });
  }

  if (side !== "buy" && side !== "sell") {
    fail("--side must be 'buy' or 'sell'", { received: side });
  }

  const maxPriceCents = parseInt(maxPriceRaw, 10);
  if (isNaN(maxPriceCents) || maxPriceCents < 1 || maxPriceCents > 99) {
    fail("--max-price must be between 1 and 99 (cents)", { received: maxPriceRaw });
  }

  const maxSize = parseFloat(maxSizeRaw);
  if (isNaN(maxSize) || maxSize < 1) {
    fail("--max-size must be >= 1", { received: maxSizeRaw });
  }

  await confirmOrder({
    market: marketId,
    side: side,
    outcome: outcome,
    price: `max ${maxPriceCents}¢`,
    size: `max ${maxSize}`,
    estimatedCost: `up to $${((maxPriceCents / 100) * maxSize).toFixed(2)} USDC`,
  }, flags);

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.createMarket({
    marketId,
    outcome: outcome as "yes" | "no",
    side: side as "buy" | "sell",
    maxPriceCents,
    maxSize,
    expirySeconds: flags["expiry-seconds"]
      ? parseInt(flags["expiry-seconds"], 10)
      : undefined,
  });
  const r = result as any;
  out(result, {
    detail: [
      ["Status", r.success ? "\u2713 Order placed" : "\u2717 Failed"],
      ["Nonce", String(r.order?.nonce || "\u2014")],
      ["Market", String(r.order?.marketId || "\u2014")],
      ["Type", String(r.order?.type || "\u2014")],
      ["Order Status", String(r.order?.status || "\u2014")],
      ["Filled", r.order?.percentFilled != null ? `${r.order.percentFilled}%` : "\u2014"],
    ],
  });
}
