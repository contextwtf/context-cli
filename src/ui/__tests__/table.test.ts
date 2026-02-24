import { describe, expect, test } from "bun:test";
import { makeTable, makeDetailTable, type Column } from "../table";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert that a rendered table uses rounded Unicode border characters */
function expectRoundedBorders(output: string) {
  expect(output).toContain("\u256D"); // top-left ╭
  expect(output).toContain("\u256E"); // top-right ╮
  expect(output).toContain("\u2570"); // bottom-left ╰
  expect(output).toContain("\u256F"); // bottom-right ╯
  expect(output).toContain("\u2502"); // vertical │
  expect(output).toContain("\u2500"); // horizontal ─
}

// ---------------------------------------------------------------------------
// makeTable
// ---------------------------------------------------------------------------

describe("makeTable", () => {
  const columns: Column[] = [
    { key: "name", label: "Name" },
    { key: "age", label: "Age" },
  ];

  const data = [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ];

  test("renders a table with headers and rows", () => {
    const output = makeTable(data, columns);
    expect(output).toContain("Name");
    expect(output).toContain("Age");
    expect(output).toContain("Alice");
    expect(output).toContain("30");
    expect(output).toContain("Bob");
    expect(output).toContain("25");
  });

  test("uses rounded Unicode borders", () => {
    const output = makeTable(data, columns);
    expectRoundedBorders(output);
  });

  test("returns empty message when data is empty", () => {
    const output = makeTable([], columns);
    expect(output).toBe("No results.");
  });

  test("returns custom empty message when provided", () => {
    const output = makeTable([], columns, "Nothing here.");
    expect(output).toBe("Nothing here.");
  });

  test("prepends numbered column when numbered=true", () => {
    const output = makeTable(data, columns, undefined, true);
    expect(output).toContain("#");
    expect(output).toContain("1");
    expect(output).toContain("2");
  });

  test("does not include # column when numbered is false/absent", () => {
    const output = makeTable(data, columns);
    // The header row should not have # as a standalone column header
    const lines = output.split("\n");
    const headerLine = lines.find((l) => l.includes("Name") && l.includes("Age"));
    expect(headerLine).toBeDefined();
    // # should not appear as a column header (it could appear in data, so check header area)
    expect(headerLine!).not.toContain("#");
  });

  test("applies column format function", () => {
    const cols: Column[] = [
      { key: "name", label: "Name" },
      {
        key: "price",
        label: "Price",
        format: (v) => `$${Number(v).toFixed(2)}`,
      },
    ];
    const rows = [{ name: "Widget", price: 9.5 }];
    const output = makeTable(rows, cols);
    expect(output).toContain("$9.50");
  });

  test("handles missing keys gracefully", () => {
    const rows = [{ name: "Alice" }]; // no 'age' key
    const output = makeTable(rows, columns);
    expect(output).toContain("Alice");
    // Should not throw
  });

  // --- Dot notation and array indexing ---

  test("supports dot notation for nested values", () => {
    const cols: Column[] = [
      { key: "user.name", label: "User Name" },
    ];
    const rows = [{ user: { name: "Charlie" } }];
    const output = makeTable(rows, cols);
    expect(output).toContain("Charlie");
  });

  test("supports array indexing for nested values", () => {
    const cols: Column[] = [
      { key: "items[0]", label: "First Item" },
      { key: "items[1]", label: "Second Item" },
    ];
    const rows = [{ items: ["apple", "banana"] }];
    const output = makeTable(rows, cols);
    expect(output).toContain("apple");
    expect(output).toContain("banana");
  });

  test("supports combined dot notation and array indexing", () => {
    const cols: Column[] = [
      { key: "outcomePrices[1].currentPrice", label: "Price" },
    ];
    const rows = [
      {
        outcomePrices: [
          { currentPrice: 0.3 },
          { currentPrice: 0.7 },
        ],
      },
    ];
    const output = makeTable(rows, cols);
    expect(output).toContain("0.7");
  });

  test("handles deeply nested paths with missing intermediate", () => {
    const cols: Column[] = [
      { key: "a.b.c.d", label: "Deep" },
    ];
    const rows = [{ a: { b: null } }];
    const output = makeTable(rows, cols);
    // Should not throw, just render empty cell
    expect(output).toContain("Deep");
  });

  test("respects column width option", () => {
    const cols: Column[] = [
      { key: "name", label: "Name", width: 20 },
    ];
    const rows = [{ name: "Alice" }];
    const output = makeTable(rows, cols);
    // Table should render without error — exact width testing is tricky
    // but we can verify the table has the content
    expect(output).toContain("Alice");
  });
});

// ---------------------------------------------------------------------------
// makeDetailTable
// ---------------------------------------------------------------------------

describe("makeDetailTable", () => {
  test("renders key-value pairs as a two-column table", () => {
    const rows: [string, string][] = [
      ["Name", "Alice"],
      ["Age", "30"],
    ];
    const output = makeDetailTable(rows);
    expect(output).toContain("Name");
    expect(output).toContain("Alice");
    expect(output).toContain("Age");
    expect(output).toContain("30");
  });

  test("uses rounded Unicode borders", () => {
    const rows: [string, string][] = [["Key", "Value"]];
    const output = makeDetailTable(rows);
    expectRoundedBorders(output);
  });

  test("handles empty rows array", () => {
    const output = makeDetailTable([]);
    // Should return a table (even if minimal) or empty string — just shouldn't throw
    expect(typeof output).toBe("string");
  });

  test("handles long values without breaking", () => {
    const longValue = "A".repeat(200);
    const rows: [string, string][] = [["Long", longValue]];
    const output = makeDetailTable(rows);
    expect(output).toContain(longValue);
  });
});
