import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

class TestFailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FailError";
  }
}

const contextClientCtor = mock((options: unknown) => options);

class MockContextClient {
  constructor(public readonly options: unknown) {
    contextClientCtor(options);
  }
}

const loadConfig = mock((): Record<string, string> => ({}));
const fail = mock((message: string) => {
  throw new TestFailError(message);
});

mock.module("context-markets", () => ({
  ContextClient: MockContextClient,
}));

mock.module("../config.js", () => ({
  loadConfig,
}));

mock.module("../format.js", () => ({
  fail,
}));

const { readClient, tradingClient } = await import("../client.js");

const ORIGINAL_ENV = {
  CONTEXT_API_KEY: process.env.CONTEXT_API_KEY,
  CONTEXT_PRIVATE_KEY: process.env.CONTEXT_PRIVATE_KEY,
  CONTEXT_RPC_URL: process.env.CONTEXT_RPC_URL,
  CONTEXT_BASE_URL: process.env.CONTEXT_BASE_URL,
  CONTEXT_CHAIN: process.env.CONTEXT_CHAIN,
};

function clearContextEnv(): void {
  delete process.env.CONTEXT_API_KEY;
  delete process.env.CONTEXT_PRIVATE_KEY;
  delete process.env.CONTEXT_RPC_URL;
  delete process.env.CONTEXT_BASE_URL;
  delete process.env.CONTEXT_CHAIN;
}

function restoreEnv(): void {
  clearContextEnv();
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

describe("client", () => {
  beforeEach(() => {
    clearContextEnv();
    contextClientCtor.mockClear();
    loadConfig.mockClear();
    loadConfig.mockReturnValue({});
    fail.mockClear();
  });

  afterEach(() => {
    restoreEnv();
  });

  test("readClient uses the api key from flags", () => {
    const client = readClient({
      "api-key": "flag-api-key",
      "rpc-url": "https://rpc.example",
      "base-url": "https://api.example",
      chain: "testnet",
    });

    expect(client).toBeInstanceOf(MockContextClient);
    expect(contextClientCtor).toHaveBeenCalledWith({
      apiKey: "flag-api-key",
      rpcUrl: "https://rpc.example",
      baseUrl: "https://api.example",
      chain: "testnet",
    });
  });

  test("readClient throws when no api key can be resolved", () => {
    expect(() => readClient()).toThrow(TestFailError);
    expect(fail).toHaveBeenCalledWith(
      "Missing CONTEXT_API_KEY. Set via --api-key flag, CONTEXT_API_KEY env, or ~/.config/context/config.env",
    );
  });

  test("tradingClient uses api key and private key from flags", () => {
    const client = tradingClient({
      "api-key": "flag-api-key",
      "private-key": "0xabc123",
      "rpc-url": "https://rpc.example",
      "base-url": "https://api.example",
      chain: "mainnet",
    });

    expect(client).toBeInstanceOf(MockContextClient);
    expect(contextClientCtor).toHaveBeenCalledWith({
      apiKey: "flag-api-key",
      rpcUrl: "https://rpc.example",
      baseUrl: "https://api.example",
      chain: "mainnet",
      signer: {
        privateKey: "0xabc123",
      },
    });
  });

  test("tradingClient throws when the private key is missing", () => {
    process.env.CONTEXT_API_KEY = "env-api-key";

    expect(() => tradingClient()).toThrow(TestFailError);
    expect(fail).toHaveBeenCalledWith(
      "A private key is required for trading operations.",
      {
        hint:
          "Set CONTEXT_PRIVATE_KEY env var, pass --private-key <key>, or run `context setup`",
      },
    );
  });

  test("falls back to the config file for credentials and chain settings", () => {
    loadConfig.mockReturnValue({
      CONTEXT_API_KEY: "config-api-key",
      CONTEXT_PRIVATE_KEY: "0xconfig-private-key",
      CONTEXT_RPC_URL: "https://config-rpc.example",
      CONTEXT_BASE_URL: "https://config-api.example",
      CONTEXT_CHAIN: "testnet",
    });

    tradingClient();

    expect(contextClientCtor).toHaveBeenCalledWith({
      apiKey: "config-api-key",
      rpcUrl: "https://config-rpc.example",
      baseUrl: "https://config-api.example",
      chain: "testnet",
      signer: {
        privateKey: "0xconfig-private-key",
      },
    });
  });
});
