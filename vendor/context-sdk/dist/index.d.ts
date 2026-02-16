import * as viem from 'viem';
import { Address, Hex, WalletClient, Account } from 'viem';

interface HttpClient {
    get<T = unknown>(path: string, params?: Record<string, string | number | undefined>): Promise<T>;
    post<T = unknown>(path: string, body: unknown): Promise<T>;
    delete<T = unknown>(path: string, body?: unknown): Promise<T>;
}

interface Market {
    id: string;
    question: string;
    shortQuestion: string;
    oracle: string;
    outcomeTokens: string[];
    outcomePrices: OutcomePrice[];
    creator: string;
    creatorProfile: {
        username: string | null;
        avatarUrl: string | null;
    } | null;
    volume: string;
    volume24h: string;
    participantCount: number;
    resolutionStatus: "none" | "pending" | "resolved";
    status: "active" | "pending" | "resolved" | "closed";
    createdAt: string;
    deadline: string;
    resolutionCriteria: string;
    resolvedAt: string | null;
    payoutPcts: number[] | null;
    metadata: MarketMetadata;
    outcome: number | null;
    contractAddress: string | null;
    [key: string]: unknown;
}
interface OutcomePrice {
    outcomeIndex: number;
    bestBid: number | null;
    bestAsk: number | null;
    spread: number | null;
    midPrice: number | null;
    lastPrice: number | null;
    currentPrice: number | null;
}
interface MarketMetadata {
    slug: string | null;
    criteria: string;
    startTime: number;
    endTime: number;
    shortSummary: string | null;
    mediaHash: string | null;
    sourceAccounts: {
        platform: string;
        userId: string;
        username: string;
        displayName: string | null;
        profileImageUrl: string | null;
    }[];
    categories: string[] | null;
    [key: string]: unknown;
}
interface MarketList {
    markets: Market[];
    cursor: string | null;
}
interface QuoteSide {
    bid: number | null;
    ask: number | null;
    last: number | null;
}
interface Quotes {
    marketId: string;
    yes: QuoteSide;
    no: QuoteSide;
    spread: number | null;
    timestamp: string;
    [key: string]: unknown;
}
interface Orderbook {
    marketId: string;
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    timestamp: string;
    [key: string]: unknown;
}
interface OrderbookLevel {
    price: number;
    size: number;
    [key: string]: unknown;
}
interface Order {
    nonce: Hex;
    marketId: string;
    trader: Address;
    outcomeIndex: number;
    side: 0 | 1;
    price: string;
    size: string;
    type: "limit" | "market";
    status: "open" | "filled" | "cancelled" | "expired" | "voided";
    insertedAt: string;
    filledSize: string;
    remainingSize: string;
    percentFilled: number;
    voidedAt: string | null;
    voidReason: "UNFILLED_MARKET_ORDER" | "UNDER_COLLATERALIZED" | "MISSING_OPERATOR_APPROVAL" | null;
    [key: string]: unknown;
}
/** Enriched market info returned alongside orders. Keyed by marketId. */
type OrderMarkets = Record<string, {
    shortQuestion: string;
    slug: string;
}>;
interface OrderList {
    orders: Order[];
    markets?: OrderMarkets;
    cursor: string | null;
}
interface CreateOrderResult {
    success: boolean;
    order: Order;
}
interface Fill {
    order: Order;
    previousFilledSize: number;
    currentFilledSize: number;
    fillSize: number;
    type: "partial" | "full";
}
interface PlaceOrderRequest {
    marketId: string;
    outcome: "yes" | "no";
    side: "buy" | "sell";
    priceCents: number;
    size: number;
    expirySeconds?: number;
}
interface CancelResult {
    success: boolean;
    alreadyCancelled?: boolean;
    [key: string]: unknown;
}
interface CancelReplaceResult {
    cancel: CancelResult & {
        trader: string;
        nonce: string;
    };
    create: CreateOrderResult;
}
interface SimulateTradeParams {
    side: "yes" | "no";
    amount: number;
    amountType?: "usd" | "contracts";
    trader?: string;
}
interface SimulateResult {
    marketId: string;
    side: string;
    amount: number;
    amountType: string;
    estimatedContracts: number;
    estimatedAvgPrice: number;
    estimatedSlippage: number;
    [key: string]: unknown;
}
interface OrderSimulateParams {
    marketId: string;
    trader: string;
    maxSize: string;
    maxPrice: string;
    outcomeIndex: number;
    side: "bid" | "ask";
}
interface OrderSimulateResult {
    levels: OrderSimulateLevel[];
    summary: {
        fillSize: string;
        fillCost: string;
        takerFee: string;
        weightedAvgPrice: string;
        totalLiquidityAvailable: string;
        percentFillable: number;
        slippageBps: number;
    };
    collateral: {
        balance: string;
        outcomeTokenBalance: string;
        requiredForFill: string;
        isSufficient: boolean;
    };
    warnings: string[];
}
interface OrderSimulateLevel {
    price: string;
    sizeAvailable: string;
    cumulativeSize: string;
    takerFee: string;
    cumulativeTakerFee: string;
    collateralRequired: string;
    cumulativeCollateral: string;
    makerCount: number;
}
interface PricePoint {
    time: number;
    price: number;
    [key: string]: unknown;
}
interface PriceHistory {
    prices: PricePoint[];
    startTime: number;
    endTime: number;
    interval: number;
    [key: string]: unknown;
}
/** @deprecated Use PricePoint instead — API returns {time, price} not OHLCV candles. */
type Candle = PricePoint;
type PriceTimeframe = "1h" | "6h" | "1d" | "1w" | "1M" | "all";
/** @deprecated Use PriceTimeframe — API param is "timeframe" with values 1h|6h|1d|1w|1M|all. */
type PriceInterval = PriceTimeframe;
interface OracleResponse {
    oracle: OracleData;
}
interface OracleData {
    lastCheckedAt: string | null;
    confidenceLevel: string | null;
    evidenceCollected: {
        postsCount: number;
        relevantPosts: string[];
    };
    sourcesMonitored: string[];
    summary: {
        decision: string;
        shortSummary: string;
        expandedSummary: string;
    };
    [key: string]: unknown;
}
interface OracleQuote {
    id: number;
    status: string;
    probability: number | null;
    confidence: "low" | "medium" | "high" | null;
    reasoning: string | null;
    referenceMarketsCount: number;
    createdAt: string;
    completedAt: string | null;
    [key: string]: unknown;
}
interface OracleQuotesResponse {
    quotes: OracleQuote[];
}
interface OracleQuoteRequestResult {
    id: number;
    status: string;
    createdAt: string;
}
interface ActivityItem {
    type: string;
    timestamp: string;
    marketId?: string;
    data?: unknown;
    [key: string]: unknown;
}
interface ActivityResponse {
    marketId: string | null;
    activity: ActivityItem[];
    pagination?: {
        cursor: string | null;
        hasMore: boolean;
    };
}
interface Portfolio {
    portfolio: Position[];
    marketIds: string[];
    cursor: string | null;
}
interface Position {
    tokenAddress: string;
    balance: string;
    settlementBalance: string;
    walletBalance: string;
    outcomeIndex: number;
    outcomeName: string;
    marketId: string;
    netInvestment: string;
    currentValue: string;
    tokensRedeemed: string;
    [key: string]: unknown;
}
interface ClaimableResponse {
    positions: ClaimablePosition[];
    markets: ClaimableMarket[];
    totalClaimable: string;
}
interface ClaimableMarket {
    id: string;
    outcomeTokens: string[];
    outcomeNames: string[];
    payoutPcts: string[];
}
interface ClaimablePosition {
    tokenAddress: string;
    balance: string;
    settlementBalance: string;
    walletBalance: string;
    outcomeIndex: number;
    outcomeName: string | null;
    marketId: string;
    netInvestment: string;
    claimableAmount: string;
    [key: string]: unknown;
}
interface PortfolioStats {
    currentPortfolioValue: string;
    currentPortfolioPercentChange: number;
}
interface Balance {
    address: Address;
    usdc: UsdcBalance;
    outcomeTokens: OutcomeTokenBalance[];
    [key: string]: unknown;
}
interface UsdcBalance {
    tokenAddress: string;
    balance: string;
    settlementBalance: string;
    walletBalance: string;
}
interface OutcomeTokenBalance {
    tokenAddress: string;
    marketId: string;
    outcomeIndex: number;
    outcomeName: string;
    balance: string;
    settlementBalance: string;
    walletBalance: string;
    [key: string]: unknown;
}
interface TokenBalance {
    balance: string;
    decimals: number;
    symbol: string;
}
interface WalletStatus {
    address: Address;
    ethBalance: bigint;
    usdcAllowance: bigint;
    isOperatorApproved: boolean;
    needsApprovals: boolean;
}
interface WalletSetupResult {
    usdcApprovalTx: Hex | null;
    operatorApprovalTx: Hex | null;
}
interface SearchMarketsParams {
    query?: string;
    status?: "active" | "pending" | "resolved" | "closed";
    sortBy?: "new" | "volume" | "trending" | "ending" | "chance";
    sort?: "asc" | "desc";
    limit?: number;
    cursor?: string;
    visibility?: "visible" | "hidden" | "all";
    resolutionStatus?: string;
    creator?: string;
    category?: string;
    createdAfter?: string;
}
type OrderStatus = "open" | "filled" | "cancelled" | "expired" | "voided";
interface GetOrdersParams {
    trader?: Address;
    marketId?: string;
    status?: OrderStatus;
    cursor?: string;
    limit?: number;
}
interface GetRecentOrdersParams {
    trader?: Address;
    marketId?: string;
    status?: OrderStatus;
    limit?: number;
    windowSeconds?: number;
}
interface GetOrderbookParams {
    depth?: number;
    outcomeIndex?: number;
}
interface GetPriceHistoryParams {
    timeframe?: PriceTimeframe;
    /** @deprecated Use timeframe instead. */
    interval?: PriceTimeframe;
}
interface GetActivityParams {
    cursor?: string;
    limit?: number;
    types?: string;
    startTime?: string;
    endTime?: string;
}
interface GetPortfolioParams {
    kind?: "all" | "active" | "won" | "lost" | "claimable";
    marketId?: string;
    cursor?: string;
    pageSize?: number;
}
interface GaslessOperatorRequest {
    user: Address;
    approved?: boolean;
    nonce: string;
    deadline: string;
    signature: Hex;
}
interface GaslessOperatorResult {
    success: true;
    txHash: Hex;
    user: Address;
    operator: Address;
    relayer: Address;
}
interface GaslessDepositRequest {
    user: Address;
    amount: string;
    nonce: string;
    deadline: string;
    signature: Hex;
}
interface GaslessDepositResult {
    success: true;
    txHash: Hex;
    user: Address;
    token: Address;
    amount: string;
    relayer: Address;
}
interface BulkOperation {
    type: "create" | "cancel";
    order?: Record<string, unknown>;
    cancel?: {
        trader: string;
        nonce: string;
        signature: string;
    };
}
interface BulkResult {
    results: Array<{
        type: "create";
        success: boolean;
        order: Order;
    } | {
        type: "cancel";
        success: boolean;
        trader: string;
        nonce: string;
        alreadyCancelled: boolean;
    }>;
}
interface ContextClientOptions {
    apiKey?: string;
    baseUrl?: string;
    rpcUrl?: string;
    signer?: SignerInput;
}
type SignerInput = {
    privateKey: Hex;
} | {
    account: viem.Account;
} | {
    walletClient: viem.WalletClient;
};

declare class Markets {
    private readonly http;
    constructor(http: HttpClient);
    list(params?: SearchMarketsParams): Promise<MarketList>;
    get(id: string): Promise<Market>;
    quotes(marketId: string): Promise<Quotes>;
    orderbook(marketId: string, params?: GetOrderbookParams): Promise<Orderbook>;
    simulate(marketId: string, params: SimulateTradeParams): Promise<SimulateResult>;
    priceHistory(marketId: string, params?: GetPriceHistoryParams): Promise<PriceHistory>;
    oracle(marketId: string): Promise<OracleResponse>;
    oracleQuotes(marketId: string): Promise<OracleQuotesResponse>;
    requestOracleQuote(marketId: string): Promise<OracleQuoteRequestResult>;
    activity(marketId: string, params?: GetActivityParams): Promise<ActivityResponse>;
    globalActivity(params?: GetActivityParams): Promise<ActivityResponse>;
}

interface SignedOrder {
    type: "limit";
    marketId: Hex;
    trader: Address;
    price: string;
    size: string;
    outcomeIndex: number;
    side: number;
    nonce: Hex;
    expiry: string;
    maxFee: string;
    makerRoleConstraint: number;
    inventoryModeConstraint: number;
    signature: Hex;
}
declare class OrderBuilder {
    private readonly walletClient;
    private readonly account;
    constructor(walletClient: WalletClient, account: Account);
    get address(): Address;
    buildAndSign(req: PlaceOrderRequest): Promise<SignedOrder>;
    signCancel(nonce: Hex): Promise<Hex>;
}

declare class Orders {
    private readonly http;
    private readonly builder;
    private readonly address;
    constructor(http: HttpClient, builder: OrderBuilder | null, address: Address | null);
    private requireSigner;
    private requireAddress;
    list(params?: GetOrdersParams): Promise<OrderList>;
    listAll(params?: Omit<GetOrdersParams, "cursor">): Promise<Order[]>;
    mine(marketId?: string): Promise<OrderList>;
    allMine(marketId?: string): Promise<Order[]>;
    get(id: string): Promise<Order>;
    recent(params?: GetRecentOrdersParams): Promise<OrderList>;
    simulate(params: OrderSimulateParams): Promise<OrderSimulateResult>;
    create(req: PlaceOrderRequest): Promise<CreateOrderResult>;
    cancel(nonce: Hex): Promise<CancelResult>;
    cancelReplace(cancelNonce: Hex, newOrder: PlaceOrderRequest): Promise<CancelReplaceResult>;
    bulkCreate(orders: PlaceOrderRequest[]): Promise<CreateOrderResult[]>;
    bulkCancel(nonces: Hex[]): Promise<CancelResult[]>;
    bulk(creates: PlaceOrderRequest[], cancelNonces: Hex[]): Promise<BulkResult>;
}

declare class PortfolioModule {
    private readonly http;
    private readonly defaultAddress;
    constructor(http: HttpClient, defaultAddress: Address | null);
    private resolveAddress;
    get(address?: Address, params?: GetPortfolioParams): Promise<Portfolio>;
    claimable(address?: Address): Promise<ClaimableResponse>;
    stats(address?: Address): Promise<PortfolioStats>;
    balance(address?: Address): Promise<Balance>;
    tokenBalance(address: Address, tokenAddress: Address): Promise<TokenBalance>;
}

declare class AccountModule {
    private readonly http;
    private readonly walletClient;
    private readonly account;
    private readonly publicClient;
    constructor(http: HttpClient, walletClient: WalletClient | null, account: Account | null, rpcUrl?: string);
    private get address();
    private requireWallet;
    private requireAccount;
    status(): Promise<WalletStatus>;
    setup(): Promise<WalletSetupResult>;
    mintTestUsdc(amount?: number): Promise<unknown>;
    deposit(amount: number): Promise<Hex>;
    withdraw(amount: number): Promise<Hex>;
    mintCompleteSets(marketId: string, amount: number): Promise<Hex>;
    burnCompleteSets(marketId: string, amount: number, creditInternal?: boolean): Promise<Hex>;
    gaslessSetup(): Promise<GaslessOperatorResult>;
    gaslessDeposit(amount: number): Promise<GaslessDepositResult>;
    relayOperatorApproval(req: GaslessOperatorRequest): Promise<GaslessOperatorResult>;
    relayDeposit(req: GaslessDepositRequest): Promise<GaslessDepositResult>;
}

/**
 * Unified SDK client for Context prediction markets.
 *
 * Read-only usage (no signer):
 *   const ctx = new ContextClient()
 *   const markets = await ctx.markets.list()
 *
 * Trading usage (with signer):
 *   const ctx = new ContextClient({ apiKey, signer: { privateKey } })
 *   const order = await ctx.orders.create({ ... })
 */
declare class ContextClient {
    readonly markets: Markets;
    readonly orders: Orders;
    readonly portfolio: PortfolioModule;
    readonly account: AccountModule;
    /** The trader's on-chain address, or null if no signer was provided. */
    readonly address: Address | null;
    constructor(options?: ContextClientOptions);
}

declare class ContextApiError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(status: number, body: unknown);
}
declare class ContextSigningError extends Error {
    constructor(message: string, cause?: unknown);
}
declare class ContextConfigError extends Error {
    constructor(message: string);
}

/**
 * Convert price in cents (1-99) to on-chain representation.
 * Example: 25 cents -> 250_000n
 */
declare function encodePriceCents(priceCents: number): bigint;
/**
 * Convert size in shares to on-chain representation.
 * Example: 10 shares -> 10_000_000n
 */
declare function encodeSize(size: number): bigint;
/**
 * Calculate max fee: 1% of notional, minimum 1n.
 * notional = price x size (in on-chain units)
 */
declare function calculateMaxFee(price: bigint, size: bigint): bigint;
/** Decode on-chain price back to cents. */
declare function decodePriceCents(raw: bigint): number;
/** Decode on-chain size back to shares. */
declare function decodeSize(raw: bigint): number;

declare const API_BASE = "https://api-testnet.context.markets/v2";
declare const SETTLEMENT_ADDRESS: Address;
declare const HOLDINGS_ADDRESS: Address;
declare const USDC_ADDRESS: Address;
declare const PERMIT2_ADDRESS: Address;
declare const CHAIN_ID = 84532;
declare const HOLDINGS_EIP712_DOMAIN: {
    readonly name: "Holdings";
    readonly version: "1";
    readonly chainId: 84532;
    readonly verifyingContract: `0x${string}`;
};
declare const PERMIT2_EIP712_DOMAIN: {
    readonly name: "Permit2";
    readonly chainId: 84532;
    readonly verifyingContract: `0x${string}`;
};

export { API_BASE, type ActivityItem, type ActivityResponse, type Balance, type BulkOperation, type BulkResult, CHAIN_ID, type CancelReplaceResult, type CancelResult, type Candle, type ClaimableMarket, type ClaimablePosition, type ClaimableResponse, ContextApiError, ContextClient, type ContextClientOptions, ContextConfigError, ContextSigningError, type CreateOrderResult, type Fill, type GaslessDepositRequest, type GaslessDepositResult, type GaslessOperatorRequest, type GaslessOperatorResult, type GetActivityParams, type GetOrderbookParams, type GetOrdersParams, type GetPortfolioParams, type GetPriceHistoryParams, type GetRecentOrdersParams, HOLDINGS_ADDRESS, HOLDINGS_EIP712_DOMAIN, type Market, type MarketList, type MarketMetadata, type OracleData, type OracleQuote, type OracleQuoteRequestResult, type OracleQuotesResponse, type OracleResponse, type Order, type OrderList, type OrderMarkets, type OrderSimulateLevel, type OrderSimulateParams, type OrderSimulateResult, type OrderStatus, type Orderbook, type OrderbookLevel, type OutcomePrice, type OutcomeTokenBalance, PERMIT2_ADDRESS, PERMIT2_EIP712_DOMAIN, type PlaceOrderRequest, type Portfolio, type PortfolioStats, type Position, type PriceHistory, type PriceInterval, type PricePoint, type PriceTimeframe, type QuoteSide, type Quotes, SETTLEMENT_ADDRESS, type SearchMarketsParams, type SignerInput, type SimulateResult, type SimulateTradeParams, type TokenBalance, USDC_ADDRESS, type UsdcBalance, type WalletSetupResult, type WalletStatus, calculateMaxFee, decodePriceCents, decodeSize, encodePriceCents, encodeSize };
