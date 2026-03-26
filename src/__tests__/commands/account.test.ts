import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { FailError, commandHarness } from "../helpers.js";

const { default: handleAccount } = await import("../../commands/account.js");

describe("account commands", () => {
  beforeEach(() => {
    commandHarness.reset();
  });

  test("status fetches account status and portfolio balance in parallel", async () => {
    const status = {
      address: "0xabc",
      ethBalance: "1000000000000000000",
      usdcAllowance: true,
      isOperatorApproved: true,
      isReady: true,
    };
    const balance = {
      usdc: {
        balance: 20_000_000,
        settlementBalance: 8_000_000,
        walletBalance: 12_000_000,
      },
    };
    commandHarness.client.account.status.mockResolvedValue(status);
    commandHarness.client.portfolio.balance.mockResolvedValue(balance);

    await commandHarness.callCommand(handleAccount, {
      subcommand: "status",
    });

    expect(commandHarness.tradingClient).toHaveBeenCalled();
    expect(commandHarness.client.account.status).toHaveBeenCalled();
    expect(commandHarness.client.portfolio.balance).toHaveBeenCalledWith();
    expect(commandHarness.outCalls[0]?.data).toEqual(status);
  });

  test("setup calls ctx.account.setup", async () => {
    const result = { success: true };
    commandHarness.client.account.setup.mockResolvedValue(result);

    await commandHarness.callCommand(handleAccount, {
      subcommand: "setup",
    });

    expect(commandHarness.client.account.setup).toHaveBeenCalled();
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("mint-test-usdc passes an optional amount", async () => {
    const result = { amount: 250, txHash: "0xabc" };
    commandHarness.client.account.mintTestUsdc.mockResolvedValue(result);

    await commandHarness.callCommand(handleAccount, {
      subcommand: "mint-test-usdc",
      flags: {
        amount: "250",
      },
    });

    expect(commandHarness.client.account.mintTestUsdc).toHaveBeenCalledWith(250);
    expect(commandHarness.outCalls[0]?.data).toEqual(result);
  });

  test("deposit parses the amount and reshapes the response", async () => {
    commandHarness.client.account.deposit.mockResolvedValue({
      txHash: "0xdeposit",
    });

    await commandHarness.callCommand(handleAccount, {
      subcommand: "deposit",
      positional: ["100.5"],
    });

    expect(commandHarness.client.account.deposit).toHaveBeenCalledWith(100.5);
    expect(commandHarness.outCalls[0]?.data).toEqual({
      status: "deposited",
      amount_usdc: 100.5,
      tx_hash: "0xdeposit",
    });
  });

  test("withdraw parses the amount and reshapes the response", async () => {
    commandHarness.client.account.withdraw.mockResolvedValue("0xwithdraw");

    await commandHarness.callCommand(handleAccount, {
      subcommand: "withdraw",
      positional: ["25"],
    });

    expect(commandHarness.client.account.withdraw).toHaveBeenCalledWith(25);
    expect(commandHarness.outCalls[0]?.data).toEqual({
      status: "withdrawn",
      amount_usdc: 25,
      tx_hash: "0xwithdraw",
    });
  });

  test("mint-complete-sets calls ctx.account.mintCompleteSets", async () => {
    commandHarness.client.account.mintCompleteSets.mockResolvedValue("0xmint");

    await commandHarness.callCommand(handleAccount, {
      subcommand: "mint-complete-sets",
      positional: ["market-1", "5"],
    });

    expect(commandHarness.client.account.mintCompleteSets).toHaveBeenCalledWith(
      "market-1",
      5,
    );
    expect(commandHarness.outCalls[0]?.data).toEqual({
      status: "minted",
      market_id: "market-1",
      amount: 5,
      tx_hash: "0xmint",
    });
  });

  test("burn-complete-sets honors --credit-internal=false", async () => {
    commandHarness.client.account.burnCompleteSets.mockResolvedValue("0xburn");

    await commandHarness.callCommand(handleAccount, {
      subcommand: "burn-complete-sets",
      positional: ["market-1", "3"],
      flags: {
        "credit-internal": "false",
      },
    });

    expect(commandHarness.client.account.burnCompleteSets).toHaveBeenCalledWith(
      "market-1",
      3,
      false,
    );
    expect(commandHarness.outCalls[0]?.data).toEqual({
      status: "burned",
      market_id: "market-1",
      amount: 3,
      credit_internal: false,
      tx_hash: "0xburn",
    });
  });

  test("gasless-approve calls ctx.account.gaslessSetup", async () => {
    const result = { success: true };
    commandHarness.client.account.gaslessSetup.mockResolvedValue(result);

    await commandHarness.callCommand(handleAccount, {
      subcommand: "gasless-approve",
    });

    expect(commandHarness.client.account.gaslessSetup).toHaveBeenCalled();
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("gasless-deposit parses the amount", async () => {
    const result = { success: true, txHash: "0xgasless" };
    commandHarness.client.account.gaslessDeposit.mockResolvedValue(result);

    await commandHarness.callCommand(handleAccount, {
      subcommand: "gasless-deposit",
      positional: ["15"],
    });

    expect(commandHarness.client.account.gaslessDeposit).toHaveBeenCalledWith(15);
    expect(commandHarness.outCalls[0]).toEqual({ data: result, config: undefined });
  });

  test("invalid deposit amounts throw FailError", async () => {
    await expect(
      commandHarness.callCommand(handleAccount, {
        subcommand: "deposit",
        positional: ["0"],
      }),
    ).rejects.toBeInstanceOf(FailError);

    expect(commandHarness.failCalls[0]).toEqual({
      message: "Deposit amount must be a positive number",
      details: { received: "0" },
    });
  });

  test("help does not call the sdk", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    await commandHarness.callCommand(handleAccount, {
      subcommand: "help",
    });

    expect(commandHarness.tradingClient).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
