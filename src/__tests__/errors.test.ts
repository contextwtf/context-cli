import { describe, expect, test } from "bun:test";
import { cleanErrorMessage } from "../error-format.js";

function standardRevertHex(reasonHex: string): string {
  return `0x08c379a0${"0".repeat(128)}${reasonHex}`;
}

describe("cleanErrorMessage", () => {
  test("extracts the field name from zod-style validation errors", () => {
    expect(
      cleanErrorMessage("✖ Too big: expected number to be <=50\n  → at limit"),
    ).toBe("Invalid --limit: Too big: expected number to be <=50");
  });

  test("decodes known EVM revert reasons", () => {
    const revertHex = standardRevertHex(
      "5452414e534645525f46524f4d5f4641494c4544",
    );

    expect(
      cleanErrorMessage(`execution reverted for call with reason: ${revertHex}`),
    ).toBe("USDC transfer failed — insufficient wallet balance");
  });

  test("extracts the Details line from verbose viem errors", () => {
    expect(
      cleanErrorMessage(
        [
          "TransactionExecutionError: Something failed",
          "Details: operator approval failed",
          "Docs: https://viem.sh",
          "Version: viem@2.47.6",
        ].join("\n"),
      ),
    ).toBe("operator approval failed");
  });

  test("replaces insufficient funds errors with an actionable message", () => {
    expect(
      cleanErrorMessage(
        "The total cost exceeds the balance of the account while estimating gas",
      ),
    ).toBe(
      "Insufficient ETH for gas. Fund your wallet with testnet ETH on Base Sepolia.",
    );
  });

  test("decodes user operation reverts when revert data is present", () => {
    const revertHex = standardRevertHex(
      "494e53554646494349454e545f42414c414e4345",
    );

    expect(
      cleanErrorMessage(`UserOperation reverted during execution: ${revertHex}`),
    ).toBe("Insufficient balance");
  });
});
