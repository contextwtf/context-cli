import { mock, type Mock } from "bun:test";
import type { ParsedArgs } from "../format.js";

export class FailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FailError";
  }
}

export class CancelError extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "CancelError";
  }
}

export interface OutCall {
  data: unknown;
  config?: unknown;
}

export interface FailCall {
  message: string;
  details?: unknown;
}

export interface OrderPromptSummary {
  market?: string;
  side: string;
  outcome: string;
  price?: string;
  size?: string;
  estimatedCost?: string;
}

export interface OrderPromptCall {
  summary: OrderPromptSummary;
  flags: Record<string, string>;
}

export interface ActionPromptCall {
  message: string;
  flags: Record<string, string>;
}

type AsyncMethodMock = Mock<(...args: unknown[]) => Promise<unknown>>;
type TestOutputMode = "json" | "table";
type ClientFactoryMock = Mock<
  (flags?: Record<string, string>) => FakeContextClient
>;

export interface FakeContextClient {
  markets: {
    list: AsyncMethodMock;
    search: AsyncMethodMock;
    get: AsyncMethodMock;
    quotes: AsyncMethodMock;
    fullOrderbook: AsyncMethodMock;
    simulate: AsyncMethodMock;
    priceHistory: AsyncMethodMock;
    oracle: AsyncMethodMock;
    oracleQuotes: AsyncMethodMock;
    requestOracleQuote: AsyncMethodMock;
    activity: AsyncMethodMock;
    globalActivity: AsyncMethodMock;
    create: AsyncMethodMock;
  };
  orders: {
    list: AsyncMethodMock;
    mine: AsyncMethodMock;
    get: AsyncMethodMock;
    recent: AsyncMethodMock;
    simulate: AsyncMethodMock;
    create: AsyncMethodMock;
    createMarket: AsyncMethodMock;
    cancel: AsyncMethodMock;
    cancelReplace: AsyncMethodMock;
    bulkCreate: AsyncMethodMock;
    bulkCancel: AsyncMethodMock;
    bulk: AsyncMethodMock;
  };
  portfolio: {
    balance: AsyncMethodMock;
    stats: AsyncMethodMock;
    get: AsyncMethodMock;
    claimable: AsyncMethodMock;
    tokenBalance: AsyncMethodMock;
  };
  account: {
    status: AsyncMethodMock;
    setup: AsyncMethodMock;
    mintTestUsdc: AsyncMethodMock;
    deposit: AsyncMethodMock;
    withdraw: AsyncMethodMock;
    mintCompleteSets: AsyncMethodMock;
    burnCompleteSets: AsyncMethodMock;
    gaslessSetup: AsyncMethodMock;
    gaslessDeposit: AsyncMethodMock;
  };
  questions: {
    submit: AsyncMethodMock;
    status: AsyncMethodMock;
    submitAndWait: AsyncMethodMock;
    agentSubmit: AsyncMethodMock;
    agentSubmitAndWait: AsyncMethodMock;
  };
}

interface CommandMockState {
  outputMode: TestOutputMode;
  client: FakeContextClient;
  outCalls: OutCall[];
  failCalls: FailCall[];
  orderPromptCalls: OrderPromptCall[];
  actionPromptCalls: ActionPromptCall[];
  readClient: ClientFactoryMock;
  tradingClient: ClientFactoryMock;
  confirmOrder: Mock<
    (
      summary: OrderPromptSummary,
      flags: Record<string, string>,
    ) => Promise<void>
  >;
  confirmAction: Mock<
    (message: string, flags: Record<string, string>) => Promise<void>
  >;
}

function createAsyncMethodMock(): AsyncMethodMock {
  return mock(async (..._args: unknown[]) => undefined);
}

function createClient(): FakeContextClient {
  return {
    markets: {
      list: createAsyncMethodMock(),
      search: createAsyncMethodMock(),
      get: createAsyncMethodMock(),
      quotes: createAsyncMethodMock(),
      fullOrderbook: createAsyncMethodMock(),
      simulate: createAsyncMethodMock(),
      priceHistory: createAsyncMethodMock(),
      oracle: createAsyncMethodMock(),
      oracleQuotes: createAsyncMethodMock(),
      requestOracleQuote: createAsyncMethodMock(),
      activity: createAsyncMethodMock(),
      globalActivity: createAsyncMethodMock(),
      create: createAsyncMethodMock(),
    },
    orders: {
      list: createAsyncMethodMock(),
      mine: createAsyncMethodMock(),
      get: createAsyncMethodMock(),
      recent: createAsyncMethodMock(),
      simulate: createAsyncMethodMock(),
      create: createAsyncMethodMock(),
      createMarket: createAsyncMethodMock(),
      cancel: createAsyncMethodMock(),
      cancelReplace: createAsyncMethodMock(),
      bulkCreate: createAsyncMethodMock(),
      bulkCancel: createAsyncMethodMock(),
      bulk: createAsyncMethodMock(),
    },
    portfolio: {
      balance: createAsyncMethodMock(),
      stats: createAsyncMethodMock(),
      get: createAsyncMethodMock(),
      claimable: createAsyncMethodMock(),
      tokenBalance: createAsyncMethodMock(),
    },
    account: {
      status: createAsyncMethodMock(),
      setup: createAsyncMethodMock(),
      mintTestUsdc: createAsyncMethodMock(),
      deposit: createAsyncMethodMock(),
      withdraw: createAsyncMethodMock(),
      mintCompleteSets: createAsyncMethodMock(),
      burnCompleteSets: createAsyncMethodMock(),
      gaslessSetup: createAsyncMethodMock(),
      gaslessDeposit: createAsyncMethodMock(),
    },
    questions: {
      submit: createAsyncMethodMock(),
      status: createAsyncMethodMock(),
      submitAndWait: createAsyncMethodMock(),
      agentSubmit: createAsyncMethodMock(),
      agentSubmitAndWait: createAsyncMethodMock(),
    },
  };
}

const state: CommandMockState = {
  outputMode: "json",
  client: createClient(),
  outCalls: [],
  failCalls: [],
  orderPromptCalls: [],
  actionPromptCalls: [],
  readClient: mock((_flags?: Record<string, string>) => state.client),
  tradingClient: mock((_flags?: Record<string, string>) => state.client),
  confirmOrder: mock(async (summary, flags) => {
    state.orderPromptCalls.push({ summary, flags });
  }),
  confirmAction: mock(async (message, flags) => {
    state.actionPromptCalls.push({ message, flags });
  }),
};

function fail(message: string, details?: unknown): never {
  state.failCalls.push({ message, details });
  throw new FailError(message);
}

function requireFlag(
  flags: Record<string, string>,
  key: string,
  usage: string,
): string {
  const value = flags[key];
  if (!value || value === "true") {
    fail(`Missing required flag: --${key}`, { usage });
  }
  return value;
}

function requirePositional(
  positional: string[],
  index: number,
  name: string,
  usage: string,
): string {
  const value = positional[index];
  if (!value) {
    fail(`Missing required argument: <${name}>`, { usage });
  }
  return value;
}

mock.module("../client.js", () => ({
  readClient: state.readClient,
  tradingClient: state.tradingClient,
}));

mock.module("../format.js", () => ({
  out(data: unknown, config?: unknown): void {
    state.outCalls.push({ data, config });
  },
  fail,
  getOutputMode(): TestOutputMode {
    return state.outputMode;
  },
  setOutputMode(flags: Record<string, string>): void {
    const explicit = flags.output ?? flags.o;
    state.outputMode = explicit === "table" ? "table" : "json";
  },
  requireFlag,
  requirePositional,
}));

mock.module("../ui/prompt.js", () => ({
  confirmOrder: state.confirmOrder,
  confirmAction: state.confirmAction,
  CancelError,
}));

function resetPromptMocks(): void {
  state.confirmOrder.mockClear();
  state.confirmOrder.mockImplementation(async (summary, flags) => {
    state.orderPromptCalls.push({ summary, flags });
  });

  state.confirmAction.mockClear();
  state.confirmAction.mockImplementation(async (message, flags) => {
    state.actionPromptCalls.push({ message, flags });
  });
}

export function resetCommandHarness(): void {
  state.outputMode = "json";
  state.client = createClient();
  state.outCalls.length = 0;
  state.failCalls.length = 0;
  state.orderPromptCalls.length = 0;
  state.actionPromptCalls.length = 0;
  state.readClient.mockClear();
  state.tradingClient.mockClear();
  resetPromptMocks();
}

export const commandHarness = {
  get client(): FakeContextClient {
    return state.client;
  },
  get outCalls(): OutCall[] {
    return state.outCalls;
  },
  get failCalls(): FailCall[] {
    return state.failCalls;
  },
  get orderPromptCalls(): OrderPromptCall[] {
    return state.orderPromptCalls;
  },
  get actionPromptCalls(): ActionPromptCall[] {
    return state.actionPromptCalls;
  },
  readClient: state.readClient,
  tradingClient: state.tradingClient,
  confirmOrder: state.confirmOrder,
  confirmAction: state.confirmAction,
  reset: resetCommandHarness,
  setOutputMode(mode: TestOutputMode): void {
    state.outputMode = mode;
  },
  async callCommand(
    handler: (parsed: ParsedArgs) => Promise<void>,
    args: Partial<ParsedArgs> = {},
  ): Promise<void> {
    const parsed: ParsedArgs = {
      command: args.command ?? "test",
      subcommand: args.subcommand,
      positional: args.positional ? [...args.positional] : [],
      flags: args.flags ? { ...args.flags } : {},
    };
    await handler(parsed);
  },
};
