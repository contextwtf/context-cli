import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { FailError, commandHarness } from "../helpers.js";

const { default: handleOrders } = await import("../../commands/orders.js");

describe("orders commands", () => {
  beforeEach(() => {
    commandHarness.reset();
  });

  test("list uses the read client when --trader is provided", async () => {
    const result = {
      orders: [{ nonce: "0x1", marketId: "market-1" }],
      cursor: "cursor-2",
    };
    commandHarness.client.orders.list.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "list",
      flags: {
        trader: "0xabc",
        market: "market-1",
        status: "open",
        cursor: "cursor-1",
        limit: "25",
      },
    });

    expect(commandHarness.readClient).toHaveBeenCalledWith({
      trader: "0xabc",
      market: "market-1",
      status: "open",
      cursor: "cursor-1",
      limit: "25",
    });
    expect(commandHarness.client.orders.list).toHaveBeenCalledWith({
      trader: "0xabc",
      marketId: "market-1",
      status: "open",
      cursor: "cursor-1",
      limit: 25,
    });
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("mine calls ctx.orders.mine with an optional market filter", async () => {
    const result = { orders: [{ nonce: "0x1" }], cursor: "cursor-1" };
    commandHarness.client.orders.mine.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "mine",
      flags: {
        market: "market-1",
      },
    });

    expect(commandHarness.tradingClient).toHaveBeenCalled();
    expect(commandHarness.client.orders.mine).toHaveBeenCalledWith("market-1");
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("get fetches an order by id", async () => {
    const result = {
      nonce: "0x1",
      marketId: "market-1",
      status: "open",
      side: "buy",
      outcomeIndex: 1,
    };
    commandHarness.client.orders.get.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "get",
      positional: ["0x1"],
    });

    expect(commandHarness.client.orders.get).toHaveBeenCalledWith("0x1");
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("recent passes filters through to ctx.orders.recent", async () => {
    const result = { orders: [{ nonce: "0x1" }] };
    commandHarness.client.orders.recent.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "recent",
      flags: {
        trader: "0xabc",
        market: "market-1",
        status: "filled",
        limit: "10",
        "window-seconds": "300",
      },
    });

    expect(commandHarness.client.orders.recent).toHaveBeenCalledWith({
      trader: "0xabc",
      marketId: "market-1",
      status: "filled",
      limit: 10,
      windowSeconds: 300,
    });
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("simulate validates and calls ctx.orders.simulate", async () => {
    const result = { matchedSize: 8 };
    commandHarness.client.orders.simulate.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "simulate",
      flags: {
        market: "market-1",
        trader: "0xabc",
        size: "10",
        price: "45",
        outcome: "no",
        side: "ask",
      },
    });

    expect(commandHarness.client.orders.simulate).toHaveBeenCalledWith({
      marketId: "market-1",
      trader: "0xabc",
      maxSize: "10",
      maxPrice: "45",
      outcomeIndex: 0,
      side: "ask",
    });
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("create validates, confirms, and places a limit order", async () => {
    const result = {
      success: true,
      order: {
        nonce: "0x1",
        marketId: "market-1",
        type: "limit",
        status: "open",
        percentFilled: 0,
      },
    };
    commandHarness.client.orders.create.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "create",
      flags: {
        market: "market-1",
        outcome: "yes",
        side: "buy",
        price: "42",
        size: "10",
        "expiry-seconds": "3600",
        "inventory-mode": "mint",
        "maker-role": "taker",
      },
    });

    expect(commandHarness.orderPromptCalls[0]).toEqual({
      summary: {
        market: "market-1",
        side: "buy",
        outcome: "yes",
        price: "42¢",
        size: "10",
        estimatedCost: "$4.20 USDC",
      },
      flags: {
        market: "market-1",
        outcome: "yes",
        side: "buy",
        price: "42",
        size: "10",
        "expiry-seconds": "3600",
        "inventory-mode": "mint",
        "maker-role": "taker",
      },
    });
    expect(commandHarness.client.orders.create).toHaveBeenCalledWith({
      marketId: "market-1",
      outcome: "yes",
      side: "buy",
      priceCents: 42,
      size: 10,
      expirySeconds: 3600,
      inventoryModeConstraint: 2,
      makerRoleConstraint: 2,
    });
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("market confirms and places a market order", async () => {
    const result = {
      success: true,
      order: {
        nonce: "0x2",
        marketId: "market-1",
        type: "market",
        status: "filled",
        percentFilled: 100,
      },
    };
    commandHarness.client.orders.createMarket.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "market",
      flags: {
        market: "market-1",
        outcome: "no",
        side: "sell",
        "max-price": "55",
        "max-size": "12",
        "expiry-seconds": "120",
      },
    });

    expect(commandHarness.orderPromptCalls[0]).toEqual({
      summary: {
        market: "market-1",
        side: "sell",
        outcome: "no",
        price: "max 55¢",
        size: "max 12",
        estimatedCost: "up to $6.60 USDC",
      },
      flags: {
        market: "market-1",
        outcome: "no",
        side: "sell",
        "max-price": "55",
        "max-size": "12",
        "expiry-seconds": "120",
      },
    });
    expect(commandHarness.client.orders.createMarket).toHaveBeenCalledWith({
      marketId: "market-1",
      outcome: "no",
      side: "sell",
      maxPriceCents: 55,
      maxSize: 12,
      expirySeconds: 120,
    });
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("cancel confirms and cancels the nonce", async () => {
    const result = { success: true, alreadyCancelled: false };
    commandHarness.client.orders.cancel.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "cancel",
      positional: ["0xdeadbeef"],
    });

    expect(commandHarness.actionPromptCalls[0]).toEqual({
      message: "Cancel order 0xdeadbeef?",
      flags: {},
    });
    expect(commandHarness.client.orders.cancel).toHaveBeenCalledWith("0xdeadbeef");
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("cancel-replace confirms and sends both nonce and replacement order", async () => {
    const result = {
      cancel: { success: true },
      create: { success: true, order: { nonce: "0x2" } },
    };
    commandHarness.client.orders.cancelReplace.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "cancel-replace",
      positional: ["0x1"],
      flags: {
        market: "market-1",
        outcome: "yes",
        side: "buy",
        price: "40",
        size: "8",
      },
    });

    expect(commandHarness.actionPromptCalls[0]).toEqual({
      message: "Cancel order 0x1 and place replacement?",
      flags: {
        market: "market-1",
        outcome: "yes",
        side: "buy",
        price: "40",
        size: "8",
      },
    });
    expect(commandHarness.client.orders.cancelReplace).toHaveBeenCalledWith(
      "0x1",
      {
        marketId: "market-1",
        outcome: "yes",
        side: "buy",
        priceCents: 40,
        size: 8,
        expirySeconds: undefined,
        inventoryModeConstraint: undefined,
        makerRoleConstraint: undefined,
      },
    );
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("bulk-create parses json and calls ctx.orders.bulkCreate", async () => {
    const orders = [
      {
        marketId: "market-1",
        outcome: "yes",
        side: "buy",
        priceCents: 50,
        size: 10,
      },
    ];
    const result = { success: true };
    commandHarness.client.orders.bulkCreate.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "bulk-create",
      flags: {
        orders: JSON.stringify(orders),
      },
    });

    expect(commandHarness.client.orders.bulkCreate).toHaveBeenCalledWith(orders);
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("bulk-cancel parses comma-separated nonces", async () => {
    const result = { success: true };
    commandHarness.client.orders.bulkCancel.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "bulk-cancel",
      flags: {
        nonces: "0x1, 0x2",
      },
    });

    expect(commandHarness.client.orders.bulkCancel).toHaveBeenCalledWith([
      "0x1",
      "0x2",
    ]);
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("bulk parses creates and cancels together", async () => {
    const creates = [{ marketId: "market-1", outcome: "yes" }];
    const result = { success: true };
    commandHarness.client.orders.bulk.mockResolvedValue(result);

    await commandHarness.callCommand(handleOrders, {
      subcommand: "bulk",
      flags: {
        creates: JSON.stringify(creates),
        cancels: "0x1,0x2",
      },
    });

    expect(commandHarness.client.orders.bulk).toHaveBeenCalledWith(creates, [
      "0x1",
      "0x2",
    ]);
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("missing required flags throw FailError", async () => {
    await expect(
      commandHarness.callCommand(handleOrders, {
        subcommand: "create",
        flags: {
          outcome: "yes",
          side: "buy",
          price: "42",
          size: "10",
        },
      }),
    ).rejects.toBeInstanceOf(FailError);

    expect(commandHarness.failCalls[0]).toEqual({
      message: "Missing required flag: --market",
      details: {
        usage:
          "context orders create --market <id> --outcome <yes|no> --side <buy|sell> --price <1-99> --size <n>",
      },
    });
  });

  test("invalid prices throw FailError", async () => {
    await expect(
      commandHarness.callCommand(handleOrders, {
        subcommand: "create",
        flags: {
          market: "market-1",
          outcome: "yes",
          side: "buy",
          price: "0",
          size: "10",
        },
      }),
    ).rejects.toBeInstanceOf(FailError);

    expect(commandHarness.failCalls[0]).toEqual({
      message: "--price must be between 1 and 99 (cents)",
      details: { received: "0" },
    });
  });

  test("invalid sides throw FailError", async () => {
    await expect(
      commandHarness.callCommand(handleOrders, {
        subcommand: "create",
        flags: {
          market: "market-1",
          outcome: "yes",
          side: "hold",
          price: "50",
          size: "10",
        },
      }),
    ).rejects.toBeInstanceOf(FailError);

    expect(commandHarness.failCalls[0]).toEqual({
      message: "--side must be 'buy' or 'sell'",
      details: { received: "hold" },
    });
  });

  test("help does not call the sdk", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    await commandHarness.callCommand(handleOrders, {
      subcommand: "help",
    });

    expect(commandHarness.readClient).not.toHaveBeenCalled();
    expect(commandHarness.tradingClient).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
