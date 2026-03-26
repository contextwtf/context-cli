import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { commandHarness } from "../helpers.js";

const { default: handlePortfolio } = await import("../../commands/portfolio.js");

describe("portfolio commands", () => {
  beforeEach(() => {
    commandHarness.reset();
  });

  test("overview combines balance, stats, and positions in json mode", async () => {
    const balance = {
      usdc: {
        balance: 15_000_000,
        settlementBalance: 5_000_000,
        walletBalance: 10_000_000,
      },
    };
    const stats = { realizedPnl: 1_500_000, winRate: 0.55 };
    const positions = {
      portfolio: [{ marketId: "market-1", outcomeName: "YES", balance: 10 }],
    };
    commandHarness.client.portfolio.balance.mockResolvedValue(balance);
    commandHarness.client.portfolio.stats.mockResolvedValue(stats);
    commandHarness.client.portfolio.get.mockResolvedValue(positions);

    await commandHarness.callCommand(handlePortfolio, {
      subcommand: "overview",
      flags: {
        address: "0xabc",
      },
    });

    expect(commandHarness.readClient).toHaveBeenCalledWith({ address: "0xabc" });
    expect(commandHarness.client.portfolio.balance).toHaveBeenCalledWith("0xabc");
    expect(commandHarness.client.portfolio.stats).toHaveBeenCalledWith("0xabc");
    expect(commandHarness.client.portfolio.get).toHaveBeenCalledWith("0xabc", {
      kind: "active",
      pageSize: 10,
    });
    expect(commandHarness.outCalls[0]?.data).toEqual({
      balance,
      stats,
      activePositions: positions.portfolio,
    });
  });

  test("overview renders console output in table mode", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    commandHarness.setOutputMode("table");
    commandHarness.client.portfolio.balance.mockResolvedValue({
      usdc: {
        balance: 20_000_000,
        settlementBalance: 8_000_000,
        walletBalance: 12_000_000,
      },
    });
    commandHarness.client.portfolio.stats.mockResolvedValue({
      realizedPnl: 2_000_000,
    });
    commandHarness.client.portfolio.get.mockResolvedValue({
      portfolio: [{ marketId: "market-1", outcomeName: "YES", balance: 10 }],
    });

    await commandHarness.callCommand(handlePortfolio, {
      subcommand: "overview",
    });

    expect(commandHarness.tradingClient).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    expect(commandHarness.outCalls).toHaveLength(1);
    logSpy.mockRestore();
  });

  test("get passes kind, market, cursor, and page size", async () => {
    const result = {
      portfolio: [{ marketId: "market-1", outcomeName: "YES" }],
      cursor: "cursor-2",
    };
    commandHarness.client.portfolio.get.mockResolvedValue(result);

    await commandHarness.callCommand(handlePortfolio, {
      subcommand: "get",
      flags: {
        address: "0xabc",
        kind: "claimable",
        market: "market-1",
        cursor: "cursor-1",
        "page-size": "15",
      },
    });

    expect(commandHarness.client.portfolio.get).toHaveBeenCalledWith("0xabc", {
      kind: "claimable",
      marketId: "market-1",
      cursor: "cursor-1",
      pageSize: 15,
    });
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("claimable calls ctx.portfolio.claimable", async () => {
    const result = {
      totalClaimable: 3_000_000,
      positions: [{ marketId: "market-1" }],
    };
    commandHarness.client.portfolio.claimable.mockResolvedValue(result);

    await commandHarness.callCommand(handlePortfolio, {
      subcommand: "claimable",
    });

    expect(commandHarness.client.portfolio.claimable).toHaveBeenCalledWith(undefined);
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("stats outputs the raw stats payload", async () => {
    const result = { realizedPnl: 1_000_000, unrealizedPnl: 500_000 };
    commandHarness.client.portfolio.stats.mockResolvedValue(result);

    await commandHarness.callCommand(handlePortfolio, {
      subcommand: "stats",
      flags: {
        address: "0xabc",
      },
    });

    expect(commandHarness.client.portfolio.stats).toHaveBeenCalledWith("0xabc");
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("balance uses the trading client when no address is provided", async () => {
    const result = {
      address: "0xabc",
      usdc: {
        balance: 10_000_000,
        settlementBalance: 4_000_000,
        walletBalance: 6_000_000,
      },
    };
    commandHarness.client.portfolio.balance.mockResolvedValue(result);

    await commandHarness.callCommand(handlePortfolio, {
      subcommand: "balance",
    });

    expect(commandHarness.tradingClient).toHaveBeenCalled();
    expect(commandHarness.client.portfolio.balance).toHaveBeenCalledWith(undefined);
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("token-balance calls ctx.portfolio.tokenBalance with both addresses", async () => {
    const result = {
      address: "0xabc",
      tokenAddress: "0xdef",
      balance: "1000000",
    };
    commandHarness.client.portfolio.tokenBalance.mockResolvedValue(result);

    await commandHarness.callCommand(handlePortfolio, {
      subcommand: "token-balance",
      positional: ["0xabc", "0xdef"],
    });

    expect(commandHarness.readClient).toHaveBeenCalledWith({});
    expect(commandHarness.client.portfolio.tokenBalance).toHaveBeenCalledWith(
      "0xabc",
      "0xdef",
    );
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("help does not call the sdk", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    await commandHarness.callCommand(handlePortfolio, {
      subcommand: "help",
    });

    expect(commandHarness.readClient).not.toHaveBeenCalled();
    expect(commandHarness.tradingClient).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
