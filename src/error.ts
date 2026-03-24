// ---------------------------------------------------------------------------
// Error message cleanup — sanitize raw SDK / zod / viem errors for display
// ---------------------------------------------------------------------------

/** Known EVM revert reason hex → human-readable message */
const REVERT_REASONS: Record<string, string> = {
  "5452414e534645525f46524f4d5f4641494c4544": "USDC transfer failed — insufficient wallet balance",
  "494e53554646494349454e545f42414c414e4345": "Insufficient balance",
  "4e4f545f415554484f52495a4544": "Not authorized",
};

function decodeRevertHex(hex: string): string | null {
  // Standard Solidity revert: 0x08c379a0 + offset + length + reason
  const match = hex.match(/08c379a0[0-9a-f]{128}([0-9a-f]+)/i);
  if (!match) return null;
  const reasonHex = match[1].replace(/0+$/, "");
  for (const [known, label] of Object.entries(REVERT_REASONS)) {
    if (reasonHex.toLowerCase().includes(known.toLowerCase())) return label;
  }

  try {
    const bytes = Buffer.from(reasonHex, "hex");
    const text = bytes.toString("utf8").replace(/[^\x20-\x7E]/g, "");
    if (text.length > 2) return text;
  } catch {
    // Ignore malformed revert payloads and fall back to the raw error.
  }

  return null;
}

export function cleanErrorMessage(raw: string): string {
  const zodMatch = raw.match(/✖\s*(.+?)(?:\n\s*→\s*at\s+(\w+))?$/s);
  if (zodMatch) {
    const detail = zodMatch[1].trim();
    const field = zodMatch[2];
    return field ? `Invalid --${field}: ${detail}` : detail;
  }

  if (raw.includes("exceeds the balance of the account")) {
    return "Insufficient ETH for gas. Fund your wallet with testnet ETH on Base Sepolia.";
  }

  const revertMatch = raw.match(/reverted.*?reason:\s*(0x[0-9a-f]+)/i);
  if (revertMatch) {
    const decoded = decodeRevertHex(revertMatch[1]);
    if (decoded) return decoded;
  }

  if (raw.includes("UserOperation reverted")) {
    const hexMatch = raw.match(/(0x[0-9a-f]{64,})/i);
    if (hexMatch) {
      const decoded = decodeRevertHex(hexMatch[1]);
      if (decoded) return decoded;
    }
    return "Transaction reverted — check your wallet balance and approvals.";
  }

  if (raw.includes("Docs: https://viem.sh") || raw.includes("Version: viem@")) {
    const detailsMatch = raw.match(/Details:\s*(.+?)(?:\n|$)/);
    if (detailsMatch) return detailsMatch[1].trim();
    return raw.split("\n")[0].trim();
  }

  return raw;
}
