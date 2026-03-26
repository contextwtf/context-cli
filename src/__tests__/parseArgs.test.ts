import { describe, expect, test } from "bun:test";
import { parseArgs } from "../format.js";

describe("parseArgs", () => {
  test("defaults to help when no command is provided", () => {
    expect(parseArgs(["bun", "context"])).toEqual({
      command: "help",
      subcommand: undefined,
      positional: [],
      flags: {},
    });
  });

  test("parses --key value flags", () => {
    expect(
      parseArgs([
        "bun",
        "context",
        "markets",
        "list",
        "--status",
        "active",
        "--limit",
        "5",
      ]),
    ).toEqual({
      command: "markets",
      subcommand: "list",
      positional: [],
      flags: {
        status: "active",
        limit: "5",
      },
    });
  });

  test("parses --key=value flags", () => {
    expect(
      parseArgs([
        "bun",
        "context",
        "markets",
        "search",
        "election",
        "--limit=10",
        "--offset=20",
      ]),
    ).toEqual({
      command: "markets",
      subcommand: "search",
      positional: ["election"],
      flags: {
        limit: "10",
        offset: "20",
      },
    });
  });

  test("maps -o to the output flag", () => {
    expect(
      parseArgs(["bun", "context", "orders", "mine", "-o", "json"]),
    ).toEqual({
      command: "orders",
      subcommand: "mine",
      positional: [],
      flags: {
        output: "json",
      },
    });
  });

  test("treats bare flags as booleans", () => {
    expect(
      parseArgs(["bun", "context", "setup", "--yes", "--help"]),
    ).toEqual({
      command: "setup",
      subcommand: undefined,
      positional: [],
      flags: {
        yes: "true",
        help: "true",
      },
    });
  });

  test("keeps remaining positionals after the subcommand", () => {
    expect(
      parseArgs(["bun", "context", "portfolio", "token-balance", "0xabc", "0xdef"]),
    ).toEqual({
      command: "portfolio",
      subcommand: "token-balance",
      positional: ["0xabc", "0xdef"],
      flags: {},
    });
  });

  test("parses mixed flags and positionals", () => {
    expect(
      parseArgs([
        "bun",
        "context",
        "orders",
        "create",
        "extra",
        "--market",
        "market-1",
        "--price=42",
        "--size",
        "10",
        "--yes",
      ]),
    ).toEqual({
      command: "orders",
      subcommand: "create",
      positional: ["extra"],
      flags: {
        market: "market-1",
        price: "42",
        size: "10",
        yes: "true",
      },
    });
  });
});
