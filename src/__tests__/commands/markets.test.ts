import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { FailError, commandHarness } from "../helpers.js";

const { default: handleMarkets } = await import("../../commands/markets.js");

describe("markets commands", () => {
  beforeEach(() => {
    commandHarness.reset();
  });

  test("list calls ctx.markets.list with parsed filters", async () => {
    const result = {
      markets: [
        {
          id: "market-1",
          shortQuestion: "Will it rain?",
          outcomePrices: [{ buyPrice: 450000 }, { buyPrice: 550000 }],
          volume: 1_000_000,
          status: "active",
        },
      ],
      cursor: "cursor-2",
    };
    commandHarness.client.markets.list.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "list",
      flags: {
        status: "active",
        "sort-by": "volume",
        sort: "desc",
        limit: "5",
        cursor: "cursor-1",
        visibility: "visible",
        "resolution-status": "unresolved",
        creator: "0xabc",
        category: "weather",
      },
    });

    expect(commandHarness.client.markets.list).toHaveBeenCalledWith({
      status: "active",
      sortBy: "volume",
      sort: "desc",
      limit: 5,
      cursor: "cursor-1",
      visibility: "visible",
      resolutionStatus: "unresolved",
      creator: "0xabc",
      category: "weather",
    });
    expect(commandHarness.outCalls[0]).toEqual(
      expect.objectContaining({
        data: result,
        config: expect.objectContaining({
          numbered: true,
          emptyMessage: "No markets found.",
          cursor: "cursor-2",
        }),
      }),
    );
  });

  test("search passes the query, limit, and offset", async () => {
    const result = { markets: [{ id: "market-1", shortQuestion: "Election" }] };
    commandHarness.client.markets.search.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "search",
      positional: ["election"],
      flags: {
        limit: "10",
        offset: "20",
      },
    });

    expect(commandHarness.client.markets.search).toHaveBeenCalledWith({
      q: "election",
      limit: 10,
      offset: 20,
    });
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("get fetches a market by id", async () => {
    const market = {
      id: "market-1",
      question: "Will it rain?",
      status: "active",
    };
    commandHarness.client.markets.get.mockResolvedValue(market);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "get",
      positional: ["market-1"],
    });

    expect(commandHarness.client.markets.get).toHaveBeenCalledWith("market-1");
    expect(commandHarness.outCalls[0]).toEqual(
      expect.objectContaining({
        data: market,
        config: expect.objectContaining({
          detail: expect.arrayContaining([["ID", "market-1"]]),
        }),
      }),
    );
  });

  test("quotes fetches quotes for a market", async () => {
    const result = {
      marketId: "market-1",
      yes: { bid: 510000, ask: 530000, last: 520000 },
      no: { bid: 470000, ask: 490000, last: 480000 },
      spread: 20000,
    };
    commandHarness.client.markets.quotes.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "quotes",
      positional: ["market-1"],
    });

    expect(commandHarness.client.markets.quotes).toHaveBeenCalledWith("market-1");
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("link emits structured output in json mode", async () => {
    commandHarness.client.markets.get.mockResolvedValue({
      id: "market-1",
      slug: "will-it-rain",
      question: "Will it rain?",
    });

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "link",
      positional: ["market-1"],
    });

    expect(commandHarness.outCalls[0]?.data).toEqual({
      url: "https://context.markets/markets/will-it-rain",
      marketId: "market-1",
      question: "Will it rain?",
    });
  });

  test("link prints human-readable output in table mode", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    commandHarness.setOutputMode("table");
    commandHarness.client.markets.get.mockResolvedValue({
      id: "market-1",
      slug: "will-it-rain",
      question: "Will it rain?",
    });

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "link",
      positional: ["market-1"],
    });

    expect(commandHarness.outCalls).toHaveLength(0);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  test("orderbook calls fullOrderbook with depth in json mode", async () => {
    const result = {
      marketId: "market-1",
      yes: { bids: [{ price: 510000, size: 12 }], asks: [{ price: 530000, size: 9 }] },
      no: { bids: [{ price: 470000, size: 8 }], asks: [{ price: 490000, size: 10 }] },
    };
    commandHarness.client.markets.fullOrderbook.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "orderbook",
      positional: ["market-1"],
      flags: {
        depth: "15",
      },
    });

    expect(commandHarness.client.markets.fullOrderbook).toHaveBeenCalledWith(
      "market-1",
      { depth: 15 },
    );
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("orderbook renders console output in table mode", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    commandHarness.setOutputMode("table");
    commandHarness.client.markets.fullOrderbook.mockResolvedValue({
      marketId: "market-1",
      yes: { bids: [], asks: [] },
      no: { bids: [], asks: [] },
    });

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "orderbook",
      positional: ["market-1"],
    });

    expect(commandHarness.outCalls).toHaveLength(0);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  test("simulate validates flags and calls ctx.markets.simulate", async () => {
    const result = {
      marketId: "market-1",
      side: "yes",
      amount: 25,
      estimatedContracts: 52,
      estimatedAvgPrice: 480000,
      estimatedSlippage: 0.02,
    };
    commandHarness.client.markets.simulate.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "simulate",
      positional: ["market-1"],
      flags: {
        side: "yes",
        amount: "25",
        "amount-type": "contracts",
        trader: "0xabc",
      },
    });

    expect(commandHarness.client.markets.simulate).toHaveBeenCalledWith(
      "market-1",
      {
        side: "yes",
        amount: 25,
        amountType: "contracts",
        trader: "0xabc",
      },
    );
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("price-history passes the timeframe flag", async () => {
    const result = [{ timestamp: "2026-03-21T00:00:00Z", price: 510000 }];
    commandHarness.client.markets.priceHistory.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "price-history",
      positional: ["market-1"],
      flags: {
        timeframe: "1d",
      },
    });

    expect(commandHarness.client.markets.priceHistory).toHaveBeenCalledWith(
      "market-1",
      { timeframe: "1d" },
    );
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("oracle fetches oracle info", async () => {
    const result = { marketId: "market-1", probability: 0.61 };
    commandHarness.client.markets.oracle.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "oracle",
      positional: ["market-1"],
    });

    expect(commandHarness.client.markets.oracle).toHaveBeenCalledWith("market-1");
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("oracle-quotes fetches oracle quote history", async () => {
    const result = { quotes: [{ probability: 0.61 }] };
    commandHarness.client.markets.oracleQuotes.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "oracle-quotes",
      positional: ["market-1"],
    });

    expect(commandHarness.client.markets.oracleQuotes).toHaveBeenCalledWith(
      "market-1",
    );
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("request-oracle-quote asks the SDK to create a fresh quote", async () => {
    const result = { requested: true };
    commandHarness.client.markets.requestOracleQuote.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "request-oracle-quote",
      positional: ["market-1"],
    });

    expect(commandHarness.client.markets.requestOracleQuote).toHaveBeenCalledWith(
      "market-1",
    );
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("activity passes limit and cursor", async () => {
    const result = {
      activity: [{ type: "trade", timestamp: "2026-03-21T00:00:00Z" }],
      pagination: { cursor: "next-cursor" },
    };
    commandHarness.client.markets.activity.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "activity",
      positional: ["market-1"],
      flags: {
        limit: "25",
        cursor: "cursor-1",
      },
    });

    expect(commandHarness.client.markets.activity).toHaveBeenCalledWith(
      "market-1",
      {
        limit: 25,
        cursor: "cursor-1",
      },
    );
    expect(commandHarness.outCalls[0]).toEqual(
      expect.objectContaining({
        data: result,
        config: expect.objectContaining({
          cursor: "next-cursor",
        }),
      }),
    );
  });

  test("global-activity passes limit and cursor", async () => {
    const result = {
      activity: [{ type: "trade", timestamp: "2026-03-21T00:00:00Z" }],
      pagination: { cursor: "next-cursor" },
    };
    commandHarness.client.markets.globalActivity.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "global-activity",
      flags: {
        limit: "50",
        cursor: "cursor-1",
      },
    });

    expect(commandHarness.client.markets.globalActivity).toHaveBeenCalledWith({
      limit: 50,
      cursor: "cursor-1",
    });
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("create uses the trading client", async () => {
    const result = { marketId: "market-1", txHash: "0xabc" };
    commandHarness.client.markets.create.mockResolvedValue(result);

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "create",
      positional: ["question-1"],
      flags: {
        "api-key": "api-key",
        "private-key": "0xprivate",
      },
    });

    expect(commandHarness.tradingClient).toHaveBeenCalledWith({
      "api-key": "api-key",
      "private-key": "0xprivate",
    });
    expect(commandHarness.client.markets.create).toHaveBeenCalledWith("question-1");
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("missing required arguments throw FailError", async () => {
    await expect(
      commandHarness.callCommand(handleMarkets, {
        subcommand: "search",
      }),
    ).rejects.toBeInstanceOf(FailError);

    expect(commandHarness.failCalls[0]).toEqual({
      message: "Missing required argument: <query>",
      details: { usage: "context markets search <query>" },
    });
  });

  test("help does not call the sdk", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    await commandHarness.callCommand(handleMarkets, {
      subcommand: "help",
    });

    expect(commandHarness.readClient).not.toHaveBeenCalled();
    expect(commandHarness.tradingClient).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
