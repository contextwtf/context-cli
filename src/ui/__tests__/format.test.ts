import { describe, expect, test } from "bun:test";
import {
  formatCents,
  formatPrice,
  formatMoney,
  formatVolume,
  formatAddress,
  truncate,
  formatDate,
} from "../format";

// ---------------------------------------------------------------------------
// formatCents
// ---------------------------------------------------------------------------

describe("formatCents", () => {
  test("formats a number in cents", () => {
    expect(formatCents(63)).toBe("63\u00A2");
  });

  test("formats zero", () => {
    expect(formatCents(0)).toBe("0\u00A2");
  });

  test("formats 1 and 99 (boundary)", () => {
    expect(formatCents(1)).toBe("1\u00A2");
    expect(formatCents(99)).toBe("99\u00A2");
  });

  test("formats string input", () => {
    expect(formatCents("42")).toBe("42\u00A2");
  });

  test("returns dash for null", () => {
    expect(formatCents(null)).toBe("\u2014");
  });

  test("returns dash for undefined", () => {
    expect(formatCents(undefined)).toBe("\u2014");
  });
});

// ---------------------------------------------------------------------------
// formatPrice — API micro-units to cents
// ---------------------------------------------------------------------------

describe("formatPrice", () => {
  test("converts micro-units to cents: 950000 → 95¢", () => {
    expect(formatPrice(950000)).toBe("95\u00A2");
  });

  test("converts micro-units to cents: 50000 → 5¢", () => {
    expect(formatPrice(50000)).toBe("5\u00A2");
  });

  test("converts micro-units: 500000 → 50¢", () => {
    expect(formatPrice(500000)).toBe("50\u00A2");
  });

  test("handles fractional cents: 955000 → 95.5¢", () => {
    expect(formatPrice(955000)).toBe("95.5\u00A2");
  });

  test("handles string input", () => {
    expect(formatPrice("950000")).toBe("95\u00A2");
  });

  test("returns dash for zero", () => {
    expect(formatPrice(0)).toBe("\u2014");
  });

  test("returns dash for null", () => {
    expect(formatPrice(null)).toBe("\u2014");
  });

  test("returns dash for undefined", () => {
    expect(formatPrice(undefined)).toBe("\u2014");
  });
});

// ---------------------------------------------------------------------------
// formatMoney
// ---------------------------------------------------------------------------

describe("formatMoney", () => {
  test("formats millions", () => {
    expect(formatMoney(1500000)).toBe("$1.5M");
  });

  test("formats exact million", () => {
    expect(formatMoney(1000000)).toBe("$1.0M");
  });

  test("formats multi-millions", () => {
    expect(formatMoney(12300000)).toBe("$12.3M");
  });

  test("formats thousands", () => {
    expect(formatMoney(15000)).toBe("$15.0K");
  });

  test("formats exact thousand", () => {
    expect(formatMoney(1000)).toBe("$1.0K");
  });

  test("formats thousands with decimals", () => {
    expect(formatMoney(2500)).toBe("$2.5K");
  });

  test("formats sub-thousand values with two decimals", () => {
    expect(formatMoney(432.5)).toBe("$432.50");
  });

  test("formats small integer", () => {
    expect(formatMoney(50)).toBe("$50.00");
  });

  test("formats zero", () => {
    expect(formatMoney(0)).toBe("$0.00");
  });

  test("formats string input", () => {
    expect(formatMoney("15000")).toBe("$15.0K");
  });

  test("returns dash for null", () => {
    expect(formatMoney(null)).toBe("\u2014");
  });

  test("returns dash for undefined", () => {
    expect(formatMoney(undefined)).toBe("\u2014");
  });
});

// ---------------------------------------------------------------------------
// formatVolume — API micro-USDC to dollars
// ---------------------------------------------------------------------------

describe("formatVolume", () => {
  test("converts large micro-USDC to K: 14706679085 → $14.7K", () => {
    expect(formatVolume(14706679085)).toBe("$14.7K");
  });

  test("converts micro-USDC to dollars: 5000000 → $5.00", () => {
    expect(formatVolume(5000000)).toBe("$5.00");
  });

  test("converts millions micro-USDC: 1500000000000 → $1.5M", () => {
    expect(formatVolume(1500000000000)).toBe("$1.5M");
  });

  test("handles small amounts: 500000 → $0.50", () => {
    expect(formatVolume(500000)).toBe("$0.50");
  });

  test("handles zero", () => {
    expect(formatVolume(0)).toBe("$0.00");
  });

  test("handles string input", () => {
    expect(formatVolume("14706679085")).toBe("$14.7K");
  });

  test("returns dash for null", () => {
    expect(formatVolume(null)).toBe("\u2014");
  });

  test("returns dash for undefined", () => {
    expect(formatVolume(undefined)).toBe("\u2014");
  });
});

// ---------------------------------------------------------------------------
// formatAddress
// ---------------------------------------------------------------------------

describe("formatAddress", () => {
  test("truncates a standard 42-char address", () => {
    expect(formatAddress("0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b")).toBe(
      "0x1a2b...9a0b",
    );
  });

  test("leaves short addresses unchanged", () => {
    expect(formatAddress("0x1234")).toBe("0x1234");
  });

  test("handles exactly 10-char string (boundary: first6 + last4 = 10)", () => {
    expect(formatAddress("0x12345678")).toBe("0x12345678");
  });

  test("truncates 11-char string", () => {
    expect(formatAddress("0x123456789")).toBe("0x1234...6789");
  });

  test("returns dash for null", () => {
    expect(formatAddress(null)).toBe("\u2014");
  });

  test("returns dash for undefined", () => {
    expect(formatAddress(undefined)).toBe("\u2014");
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe("truncate", () => {
  test("returns string unchanged when shorter than maxLen", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("returns string unchanged when exactly maxLen", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  test("truncates and adds ellipsis when longer than maxLen", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  test("truncates at maxLen 3 (minimum useful)", () => {
    expect(truncate("hello", 3)).toBe("...");
  });

  test("returns dash for null", () => {
    expect(truncate(null, 10)).toBe("\u2014");
  });

  test("returns dash for undefined", () => {
    expect(truncate(undefined, 10)).toBe("\u2014");
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  test("formats ISO date string", () => {
    expect(formatDate("2026-03-15T00:00:00Z")).toBe("Mar 15, 2026");
  });

  test("formats another date", () => {
    expect(formatDate("2025-12-25T12:30:00Z")).toBe("Dec 25, 2025");
  });

  test("formats date-only string", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  test("returns dash for null", () => {
    expect(formatDate(null)).toBe("\u2014");
  });

  test("returns dash for undefined", () => {
    expect(formatDate(undefined)).toBe("\u2014");
  });
});
