// ---------------------------------------------------------------------------
// Orders commands — list, create, cancel, bulk operations
// ---------------------------------------------------------------------------

import type { Address, Hex } from "viem";
import type { OrderStatus } from "@contextwtf/sdk";
import { readClient, tradingClient, type ClientFlags } from "../client.js";
import {
  out,
  fail,
  requireFlag,
  requirePositional,
  type ParsedArgs,
} from "../format.js";

const HELP = `Usage: context-cli orders <subcommand> [options]

Subcommands:
  list                              List orders
    --trader <address>                Filter by trader (uses readClient)
    --market <id>                     Filter by market
    --status <status>                 Filter by status
    --cursor <token>                  Pagination cursor
    --limit <n>                       Max results

  mine                              List your own open orders (requires signer)
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

  create                            Place an order (requires signer)
    --market <id>                     (required) Market ID
    --outcome <yes|no>                (required) Outcome
    --side <buy|sell>                 (required) Side
    --price <1-99>                    (required) Price in cents
    --size <n>                        (required) Size (>=1)
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
      fail(`Unknown orders subcommand: "${subcommand}". Run "context-cli orders help" for usage.`);
  }
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

  out(result);
}

// ---------------------------------------------------------------------------
// mine — list own open orders (requires signer)
// ---------------------------------------------------------------------------

async function mine(flags: Record<string, string>): Promise<void> {
  const ctx = tradingClient(flags as ClientFlags);

  const result = await ctx.orders.mine(flags["market"] || undefined);
  out(result);
}

// ---------------------------------------------------------------------------
// get — get a single order by ID (read-only)
// ---------------------------------------------------------------------------

async function get(
  positional: string[],
  flags: Record<string, string>,
): Promise<void> {
  const id = requirePositional(positional, 0, "id", "context-cli orders get <id>");
  const ctx = readClient(flags as ClientFlags);

  const order = await ctx.orders.get(id);
  out(order);
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

  out(result);
}

// ---------------------------------------------------------------------------
// simulate — simulate an order (read-only)
// ---------------------------------------------------------------------------

async function simulate(flags: Record<string, string>): Promise<void> {
  const marketId = requireFlag(flags, "market", "context-cli orders simulate --market <id>");
  const trader = requireFlag(flags, "trader", "context-cli orders simulate --market <id> --trader <address> --size <n> --price <n>");
  const sizeRaw = requireFlag(flags, "size", "context-cli orders simulate --market <id> --trader <address> --size <n> --price <n>");
  const priceRaw = requireFlag(flags, "price", "context-cli orders simulate --market <id> --trader <address> --size <n> --price <n>");

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

  return {
    marketId,
    outcome: outcome as "yes" | "no",
    side: side as "buy" | "sell",
    priceCents,
    size,
    expirySeconds: flags["expiry-seconds"]
      ? parseInt(flags["expiry-seconds"], 10)
      : undefined,
  };
}

async function create(flags: Record<string, string>): Promise<void> {
  const usage =
    "context-cli orders create --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n>";
  const order = parsePlaceOrderFlags(flags, usage);

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.create(order);
  out(result);
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
    "context-cli orders cancel <nonce>",
  ) as Hex;

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.cancel(nonce);
  out(result);
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
    "context-cli orders cancel-replace <nonce> --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n>",
  ) as Hex;

  const usage =
    "context-cli orders cancel-replace <nonce> --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n>";
  const newOrder = parsePlaceOrderFlags(flags, usage);

  const ctx = tradingClient(flags as ClientFlags);
  const result = await ctx.orders.cancelReplace(nonce, newOrder);
  out(result);
}

// ---------------------------------------------------------------------------
// bulk-create — create multiple orders (requires signer)
// ---------------------------------------------------------------------------

async function bulkCreate(flags: Record<string, string>): Promise<void> {
  const raw = requireFlag(
    flags,
    "orders",
    'context-cli orders bulk-create --orders \'[{"marketId":"...","outcome":"yes","side":"buy","priceCents":50,"size":10}]\'',
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
    "context-cli orders bulk-cancel --nonces 0xabc,0xdef",
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
        'context-cli orders bulk --creates \'[...]\' --cancels 0xabc,0xdef',
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
