// ---------------------------------------------------------------------------
// ContextClient factory — read-only and trading variants
// ---------------------------------------------------------------------------

import { ContextClient } from "context-markets";
import type { ChainOption } from "context-markets";
import type { Hex } from "viem";
import { fail } from "./format.js";
import { loadConfig } from "./config.js";

export interface ClientFlags {
  "api-key"?: string;
  "private-key"?: string;
  "rpc-url"?: string;
  "base-url"?: string;
  chain?: string;
}

/**
 * Resolve the chain option from --chain flag or CONTEXT_CHAIN env var.
 * Returns undefined if not set (SDK defaults to mainnet).
 */
function resolveChain(flags: ClientFlags, config: Record<string, string> = {}): ChainOption | undefined {
  const raw = flags.chain ?? process.env.CONTEXT_CHAIN ?? config.CONTEXT_CHAIN;
  if (!raw) return undefined;
  return raw as ChainOption;
}

/**
 * Create a read-only ContextClient.
 * API key is resolved from --api-key flag or CONTEXT_API_KEY env var.
 */
export function readClient(flags: ClientFlags = {}): ContextClient {
  const config = loadConfig();
  const apiKey = flags["api-key"] ?? process.env.CONTEXT_API_KEY ?? config.CONTEXT_API_KEY;
  if (!apiKey) fail("Missing CONTEXT_API_KEY. Set via --api-key flag, CONTEXT_API_KEY env, or ~/.config/context/config.env");
  const rpcUrl = flags["rpc-url"] ?? process.env.CONTEXT_RPC_URL ?? config.CONTEXT_RPC_URL;
  const baseUrl = flags["base-url"] ?? process.env.CONTEXT_BASE_URL ?? config.CONTEXT_BASE_URL;
  const chain = resolveChain(flags, config);
  return new ContextClient({ apiKey, rpcUrl, baseUrl, chain });
}

/**
 * Create a ContextClient with a signer for trading operations.
 * Private key is resolved from --private-key flag or CONTEXT_PRIVATE_KEY env var.
 * API key is resolved from --api-key flag or CONTEXT_API_KEY env var.
 */
export function tradingClient(flags: ClientFlags = {}): ContextClient {
  const config = loadConfig();
  const apiKey = flags["api-key"] ?? process.env.CONTEXT_API_KEY ?? config.CONTEXT_API_KEY;
  if (!apiKey) fail("Missing CONTEXT_API_KEY. Set via --api-key flag, CONTEXT_API_KEY env, or ~/.config/context/config.env");

  const privateKey = flags["private-key"] ?? process.env.CONTEXT_PRIVATE_KEY ?? config.CONTEXT_PRIVATE_KEY;
  if (!privateKey) {
    fail(
      "A private key is required for trading operations.",
      { hint: "Set CONTEXT_PRIVATE_KEY env var, pass --private-key <key>, or run `context setup`" },
    );
  }

  const rpcUrl = flags["rpc-url"] ?? process.env.CONTEXT_RPC_URL ?? config.CONTEXT_RPC_URL;
  const baseUrl = flags["base-url"] ?? process.env.CONTEXT_BASE_URL ?? config.CONTEXT_BASE_URL;
  const chain = resolveChain(flags, config);
  return new ContextClient({
    apiKey,
    rpcUrl,
    baseUrl,
    chain,
    signer: { privateKey: privateKey as Hex },
  });
}
