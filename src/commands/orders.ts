// ---------------------------------------------------------------------------
// Orders commands — list, create, cancel, bulk operations
// ---------------------------------------------------------------------------

import type { Address, Hex } from "viem";
import type {
  CancelReplaceResult,
  CancelResult,
  CreateOrderResult,
  Order,
  OrderStatus,
  PlaceOrderRequest,
} from "context-markets";
import { readClient, tradingClient, type ClientFlags } from "../client.js";
import {
  out,
  fail,
  requireFlag,
  requirePositional,
  type ParsedArgs,
} from "../format.js";
import { formatPrice, formatAddress, truncate, formatDate } from "../ui/format.js";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePlaceOrderRequest(value: unknown, label: string): PlaceOrderRequest {
  if (!isRecord(value)) {
    fail(`${label} must be an object`);
  }

  const marketId = value.marketId;
  if (typeof marketId !== "string" || !marketId.trim()) {
    fail(`${label}.marketId must be a non-empty string`);
  }

  const outcome = value.outcome;
  if (outcome !== "yes" && outcome !== "no") {
    fail(`${label}.outcome must be "yes" or "no"`, { received: outcome });
  }

  const side = value.side;
  if (side !== "buy" && side !== "sell") {
    fail(`${label}.side must be "buy" or "sell"`, { received: side });
  }

  const priceCents = value.priceCents;
  if (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents < 1 || priceCents > 99) {
    fail(`${label}.priceCents must be an integer between 1 and 99`, { received: priceCents });
  }

  const size = value.size;
  if (typeof size !== "number" || !Number.isFinite(size) || size < 1) {
    fail(`${label}.size must be a number >= 1`, { received: size });
  }

  const expirySeconds = value.expirySeconds;
  if (
    expirySeconds !== undefined &&
    (typeof expirySeconds !== "number" || !Number.isInteger(expirySeconds) || expirySeconds <= 0)
  ) {
    fail(`${label}.expirySeconds must be a positive integer`, { received: expirySeconds });
  }

  const inventoryModeConstraint = value.inventoryModeConstraint;
  if (
    inventoryModeConstraint !== undefined &&
    inventoryModeConstraint !== 0 &&
    inventoryModeConstraint !== 1 &&
    inventoryModeConstraint !== 2
  ) {
    fail(`${label}.inventoryModeConstraint must be 0, 1, or 2`, { received: inventoryModeConstraint });
  }

  const makerRoleConstraint = value.makerRoleConstraint;
  if (makerRoleConstraint === 1) {
    fail(`${label}.makerRoleConstraint=1 (maker/post-only) breaks settlement when two maker-only orders cross`);
  }
  if (
    makerRoleConstraint !== undefined &&
    makerRoleConstraint !== 0 &&
    makerRoleConstraint !== 2
  ) {
    fail(`${label}.makerRoleConstraint must be 0 or 2`, { received: makerRoleConstraint });
  }

  return {
    marketId,
    outcome,
    side,
    priceCents,
    size,
    expirySeconds,
    inventoryModeConstraint,
    makerRoleConstraint,
  };
}

function parsePlaceOrderArray(raw: string, flagName: "orders" | "creates"): PlaceOrderRequest[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail(`--${flagName} must be valid JSON`, { received: raw });
  }

  if (!Array.isArray(value)) {
    fail(`--${flagName} must be a JSON array`, { received: raw });
  }

  return value.map((item, index) => parsePlaceOrderRequest(item, `--${flagName}[${index}]`));
}

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

  const order: Order = await ctx.orders.get(id);
  out(order, {
    detail: [
      ["Nonce", String(order.nonce || "\u2014")],
      ["Market", String(order.marketId || "\u2014")],
      ["Status", String(order.status || "\u2014")],
      ["Side", String(order.side ?? "\u2014").toUpperCase()],
      ["Outcome", order.outcomeIndex === 1 ? "YES" : "NO"],
      ["Price", formatPrice(order.price)],
      ["Size", String(order.size || "\u2014")],
      ["Filled", order.percentFilled != null ? `${order.percentFilled}%` : "\u2014"],
      ["Trader", formatAddress(order.trader)],
      ["Created", formatDate(order.insertedAt)],
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
  const result: CreateOrderResult = await ctx.orders.create(order);
  out(result, {
    detail: [
      ["Status", result.success ? "\u2713 Order placed" : "\u2717 Failed"],
      ["Nonce", String(result.order?.nonce || "\u2014")],
      ["Market", String(result.order?.marketId || "\u2014")],
      ["Type", String(result.order?.type || "\u2014")],
      ["Order Status", String(result.order?.status || "\u2014")],
      ["Filled", result.order?.percentFilled != null ? `${result.order.percentFilled}%` : "\u2014"],
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
  const result: CancelResult = await ctx.orders.cancel(nonce);
  out(result, {
    detail: [
      ["Status", result.success ? "\u2713 Cancelled" : "\u2717 Failed"],
      ["Already Cancelled", String(result.alreadyCancelled ?? "\u2014")],
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
  const result: CancelReplaceResult = await ctx.orders.cancelReplace(nonce, newOrder);
  out(result, {
    detail: [
      ["Cancel", result.cancel?.success ? "\u2713 Cancelled" : "\u2717 Failed"],
      ["New Order", result.create?.success ? "\u2713 Created" : "\u2717 Failed"],
      ["New Nonce", String(result.create?.order?.nonce || "\u2014")],
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

  const orders = parsePlaceOrderArray(raw, "orders");

  const ctx = tradingClient(flags as ClientFlags);
  await confirmAction(`Bulk create ${orders.length} orders?`, flags);
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

  let creates: PlaceOrderRequest[] = [];
  if (createsRaw) {
    creates = parsePlaceOrderArray(createsRaw, "creates");
  }

  const cancelNonces: Hex[] = cancelsRaw
    ? (cancelsRaw.split(",").map((s) => s.trim()) as Hex[])
    : [];

  const ctx = tradingClient(flags as ClientFlags);
  const createCount = creates.length;
  const cancelCount = cancelNonces.length;
  const message = createCount > 0 && cancelCount > 0
    ? `Bulk create ${createCount} orders and cancel ${cancelCount} orders?`
    : createCount > 0
      ? `Bulk create ${createCount} orders?`
      : `Bulk cancel ${cancelCount} orders?`;
  await confirmAction(message, flags);
  const result = await ctx.orders.bulk(creates, cancelNonces);
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
  const result: CreateOrderResult = await ctx.orders.createMarket({
    marketId,
    outcome: outcome as "yes" | "no",
    side: side as "buy" | "sell",
    maxPriceCents,
    maxSize,
    expirySeconds: flags["expiry-seconds"]
      ? parseInt(flags["expiry-seconds"], 10)
      : undefined,
  });
  out(result, {
    detail: [
      ["Status", result.success ? "\u2713 Order placed" : "\u2717 Failed"],
      ["Nonce", String(result.order?.nonce || "\u2014")],
      ["Market", String(result.order?.marketId || "\u2014")],
      ["Type", String(result.order?.type || "\u2014")],
      ["Order Status", String(result.order?.status || "\u2014")],
      ["Filled", result.order?.percentFilled != null ? `${result.order.percentFilled}%` : "\u2014"],
    ],
  });
}
