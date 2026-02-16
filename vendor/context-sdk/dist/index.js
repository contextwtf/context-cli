// src/config.ts
var API_BASE = "https://api-testnet.context.markets/v2";
var SETTLEMENT_ADDRESS = "0xABfB9e3Dc252D59e4e4A3c3537D96F3F207C9b2c";
var HOLDINGS_ADDRESS = "0x769341425095155C0A0620eBC308d4C05980B84a";
var USDC_ADDRESS = "0xBbee2756d3169CF7065e5E9C4A5EA9b1D1Fd415e";
var PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
var CHAIN_ID = 84532;
var EIP712_DOMAIN = {
  name: "Settlement",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: SETTLEMENT_ADDRESS
};
var ORDER_TYPES = {
  Order: [
    { name: "marketId", type: "bytes32" },
    { name: "trader", type: "address" },
    { name: "price", type: "uint256" },
    { name: "size", type: "uint256" },
    { name: "outcomeIndex", type: "uint8" },
    { name: "side", type: "uint8" },
    { name: "nonce", type: "bytes32" },
    { name: "expiry", type: "uint256" },
    { name: "maxFee", type: "uint256" },
    { name: "makerRoleConstraint", type: "uint8" },
    { name: "inventoryModeConstraint", type: "uint8" }
  ]
};
var CANCEL_TYPES = {
  CancelNonce: [
    { name: "trader", type: "address" },
    { name: "nonce", type: "bytes32" }
  ]
};
var HOLDINGS_EIP712_DOMAIN = {
  name: "Holdings",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: HOLDINGS_ADDRESS
};
var PERMIT2_EIP712_DOMAIN = {
  name: "Permit2",
  chainId: CHAIN_ID,
  verifyingContract: PERMIT2_ADDRESS
};
var OPERATOR_APPROVAL_TYPES = {
  OperatorApproval: [
    { name: "user", type: "address" },
    { name: "operator", type: "address" },
    { name: "approved", type: "bool" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};
var PERMIT_TRANSFER_FROM_TYPES = {
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" }
  ],
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};
var ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
];
var HOLDINGS_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "setOperator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "isOperatorFor",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  }
];
var SETTLEMENT_ABI = [
  {
    name: "mintCompleteSetsFromHoldings",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "burnCompleteSetsFromHoldings",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "creditInternal", type: "bool" }
    ],
    outputs: []
  }
];
var OPERATOR_NONCE_ABI = [
  {
    name: "operatorNonce",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
];

// src/errors.ts
var ContextApiError = class extends Error {
  status;
  body;
  constructor(status, body) {
    const message = typeof body === "object" && body !== null && "message" in body ? String(body.message) : `API request failed with status ${status}`;
    super(message);
    this.name = "ContextApiError";
    this.status = status;
    this.body = body;
  }
};
var ContextSigningError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ContextSigningError";
    if (cause) this.cause = cause;
  }
};
var ContextConfigError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ContextConfigError";
  }
};

// src/http.ts
function createHttpClient(options = {}) {
  const apiKey = options.apiKey;
  const baseUrl = options.baseUrl ?? API_BASE;
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  function headers() {
    const h = {
      "Content-Type": "application/json"
    };
    if (apiKey) {
      h["Authorization"] = `Bearer ${apiKey}`;
    }
    return h;
  }
  async function request(method, url, body) {
    const init = { method, headers: headers() };
    if (body !== void 0) {
      init.body = JSON.stringify(body);
    }
    const res = await fetchFn(url, init);
    if (!res.ok) {
      const respBody = await res.json().catch(() => null);
      throw new ContextApiError(res.status, respBody);
    }
    return res.json();
  }
  return {
    async get(path, params) {
      let url = `${baseUrl}${path}`;
      if (params) {
        const searchParams = [];
        for (const [k, v] of Object.entries(params)) {
          if (v !== void 0) {
            searchParams.push(
              `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
            );
          }
        }
        if (searchParams.length > 0) {
          url += `?${searchParams.join("&")}`;
        }
      }
      return request("GET", url);
    },
    async post(path, body) {
      return request("POST", `${baseUrl}${path}`, body);
    },
    async delete(path, body) {
      return request("DELETE", `${baseUrl}${path}`, body);
    }
  };
}

// src/signing/eip712.ts
import {
  createWalletClient,
  http,
  keccak256,
  toBytes
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
function resolveSigner(input) {
  if ("privateKey" in input) {
    const account = privateKeyToAccount(input.privateKey);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http()
    });
    return { account, walletClient };
  }
  if ("account" in input) {
    const walletClient = createWalletClient({
      account: input.account,
      chain: baseSepolia,
      transport: http()
    });
    return { account: input.account, walletClient };
  }
  if ("walletClient" in input) {
    const account = input.walletClient.account;
    if (!account) {
      throw new ContextSigningError(
        "WalletClient must have an account configured"
      );
    }
    return { account, walletClient: input.walletClient };
  }
  throw new ContextSigningError("Invalid signer input");
}
function randomNonce() {
  return keccak256(toBytes(`${Date.now()}_${Math.random()}`));
}
async function signOrder(walletClient, account, order) {
  try {
    return await walletClient.signTypedData({
      account,
      domain: EIP712_DOMAIN,
      types: ORDER_TYPES,
      primaryType: "Order",
      message: order
    });
  } catch (err) {
    throw new ContextSigningError("Failed to sign order", err);
  }
}
async function signCancel(walletClient, account, trader, nonce) {
  try {
    return await walletClient.signTypedData({
      account,
      domain: EIP712_DOMAIN,
      types: CANCEL_TYPES,
      primaryType: "CancelNonce",
      message: { trader, nonce }
    });
  } catch (err) {
    throw new ContextSigningError("Failed to sign cancel", err);
  }
}

// src/constants.ts
var PRICE_MULTIPLIER = 10000n;
var SIZE_MULTIPLIER = 1000000n;
var FEE_DIVISOR = 100n;
var DEFAULT_EXPIRY_SECONDS = 3600;

// src/order-builder/helpers.ts
function encodePriceCents(priceCents) {
  if (priceCents < 1 || priceCents > 99) {
    throw new RangeError(`priceCents must be 1-99, got ${priceCents}`);
  }
  return BigInt(Math.round(priceCents * Number(PRICE_MULTIPLIER)));
}
function encodeSize(size) {
  if (size < 0.01) {
    throw new RangeError(`size must be >= 0.01, got ${size}`);
  }
  return BigInt(Math.round(size * Number(SIZE_MULTIPLIER)));
}
function calculateMaxFee(price, size) {
  const fee = price * size / FEE_DIVISOR / SIZE_MULTIPLIER;
  return fee < 1n ? 1n : fee;
}
function decodePriceCents(raw) {
  return Number(raw) / Number(PRICE_MULTIPLIER);
}
function decodeSize(raw) {
  return Number(raw) / Number(SIZE_MULTIPLIER);
}

// src/order-builder/builder.ts
var OrderBuilder = class {
  constructor(walletClient, account) {
    this.walletClient = walletClient;
    this.account = account;
  }
  get address() {
    return this.account.address;
  }
  async buildAndSign(req) {
    const price = encodePriceCents(req.priceCents);
    const size = encodeSize(req.size);
    const maxFee = calculateMaxFee(price, size);
    const nonce = randomNonce();
    const expirySeconds = req.expirySeconds ?? DEFAULT_EXPIRY_SECONDS;
    const expiry = BigInt(Math.floor(Date.now() / 1e3) + expirySeconds);
    const order = {
      marketId: req.marketId,
      trader: this.address,
      price,
      size,
      outcomeIndex: req.outcome === "yes" ? 1 : 0,
      side: req.side === "buy" ? 0 : 1,
      nonce,
      expiry,
      maxFee,
      makerRoleConstraint: 0,
      inventoryModeConstraint: 0
    };
    const signature = await signOrder(this.walletClient, this.account, order);
    return {
      type: "limit",
      ...order,
      price: order.price.toString(),
      size: order.size.toString(),
      expiry: order.expiry.toString(),
      maxFee: order.maxFee.toString(),
      signature
    };
  }
  async signCancel(nonce) {
    return signCancel(
      this.walletClient,
      this.account,
      this.address,
      nonce
    );
  }
};

// src/endpoints.ts
var ENDPOINTS = {
  markets: {
    list: "/markets",
    get: (id) => `/markets/${id}`,
    quotes: (id) => `/markets/${id}/quotes`,
    orderbook: (id) => `/markets/${id}/orderbook`,
    simulate: (id) => `/markets/${id}/simulate`,
    prices: (id) => `/markets/${id}/prices`,
    oracle: (id) => `/markets/${id}/oracle`,
    oracleQuotes: (id) => `/markets/${id}/oracle/quotes`,
    activity: (id) => `/markets/${id}/activity`
  },
  orders: {
    create: "/orders",
    list: "/orders",
    recent: "/orders/recent",
    get: (id) => `/orders/${id}`,
    cancel: "/orders/cancels",
    cancelReplace: "/orders/cancel-replace",
    simulate: "/orders/simulate",
    bulk: "/orders/bulk",
    bulkCreate: "/orders/bulk/create",
    bulkCancel: "/orders/bulk/cancel"
  },
  portfolio: {
    get: (address) => `/portfolio/${address}`,
    claimable: (address) => `/portfolio/${address}/claimable`,
    stats: (address) => `/portfolio/${address}/stats`
  },
  balance: {
    get: (address) => `/balance/${address}`,
    tokenBalance: "/balance",
    settlement: "/balance/settlement",
    mintTestUsdc: "/balance/mint-test-usdc"
  },
  activity: {
    global: "/activity"
  },
  gasless: {
    operator: "/gasless/operator",
    depositWithPermit: "/gasless/deposit-with-permit"
  }
};

// src/modules/markets.ts
var Markets = class {
  constructor(http2) {
    this.http = http2;
  }
  async list(params) {
    return this.http.get(ENDPOINTS.markets.list, {
      search: params?.query,
      status: params?.status,
      sortBy: params?.sortBy,
      sort: params?.sort,
      limit: params?.limit,
      cursor: params?.cursor,
      visibility: params?.visibility,
      resolutionStatus: params?.resolutionStatus,
      creator: params?.creator,
      category: params?.category,
      createdAfter: params?.createdAfter
    });
  }
  async get(id) {
    const res = await this.http.get(
      ENDPOINTS.markets.get(id)
    );
    return res.market;
  }
  async quotes(marketId) {
    return this.http.get(ENDPOINTS.markets.quotes(marketId));
  }
  async orderbook(marketId, params) {
    return this.http.get(ENDPOINTS.markets.orderbook(marketId), {
      depth: params?.depth,
      outcomeIndex: params?.outcomeIndex
    });
  }
  async simulate(marketId, params) {
    return this.http.post(
      ENDPOINTS.markets.simulate(marketId),
      {
        side: params.side,
        amount: params.amount,
        amountType: params.amountType ?? "usd",
        ...params.trader ? { trader: params.trader } : {}
      }
    );
  }
  async priceHistory(marketId, params) {
    return this.http.get(ENDPOINTS.markets.prices(marketId), {
      timeframe: params?.timeframe ?? params?.interval
    });
  }
  async oracle(marketId) {
    return this.http.get(ENDPOINTS.markets.oracle(marketId));
  }
  async oracleQuotes(marketId) {
    return this.http.get(
      ENDPOINTS.markets.oracleQuotes(marketId)
    );
  }
  async requestOracleQuote(marketId) {
    return this.http.post(
      ENDPOINTS.markets.oracleQuotes(marketId),
      {}
    );
  }
  async activity(marketId, params) {
    return this.http.get(
      ENDPOINTS.markets.activity(marketId),
      {
        cursor: params?.cursor,
        limit: params?.limit,
        types: params?.types,
        startTime: params?.startTime,
        endTime: params?.endTime
      }
    );
  }
  async globalActivity(params) {
    return this.http.get(ENDPOINTS.activity.global, {
      cursor: params?.cursor,
      limit: params?.limit,
      types: params?.types,
      startTime: params?.startTime,
      endTime: params?.endTime
    });
  }
};

// src/modules/orders.ts
var Orders = class {
  constructor(http2, builder, address) {
    this.http = http2;
    this.builder = builder;
    this.address = address;
  }
  requireSigner() {
    if (!this.builder) {
      throw new ContextConfigError(
        "A signer is required for write operations. Pass a signer to ContextClient."
      );
    }
    return this.builder;
  }
  requireAddress() {
    if (!this.address) {
      throw new ContextConfigError(
        "A signer is required for this operation. Pass a signer to ContextClient."
      );
    }
    return this.address;
  }
  // ─── Read ───
  async list(params) {
    return this.http.get(ENDPOINTS.orders.list, {
      trader: params?.trader,
      marketId: params?.marketId,
      status: params?.status,
      cursor: params?.cursor,
      limit: params?.limit
    });
  }
  async listAll(params) {
    const allOrders = [];
    let cursor;
    do {
      const res = await this.http.get(ENDPOINTS.orders.list, {
        trader: params?.trader,
        marketId: params?.marketId,
        status: params?.status,
        cursor
      });
      const orders = res.orders ?? [];
      allOrders.push(...orders);
      cursor = res.cursor ?? void 0;
      if (orders.length === 0) break;
    } while (cursor);
    return allOrders;
  }
  async mine(marketId) {
    return this.list({
      trader: this.requireAddress(),
      marketId
    });
  }
  async allMine(marketId) {
    return this.listAll({
      trader: this.requireAddress(),
      marketId
    });
  }
  async get(id) {
    const res = await this.http.get(
      ENDPOINTS.orders.get(id)
    );
    return res.order;
  }
  async recent(params) {
    return this.http.get(ENDPOINTS.orders.recent, {
      trader: params?.trader,
      marketId: params?.marketId,
      status: params?.status,
      limit: params?.limit,
      windowSeconds: params?.windowSeconds
    });
  }
  async simulate(params) {
    return this.http.post(
      ENDPOINTS.orders.simulate,
      params
    );
  }
  // ─── Write ───
  async create(req) {
    const builder = this.requireSigner();
    const signed = await builder.buildAndSign(req);
    return this.http.post(ENDPOINTS.orders.create, signed);
  }
  async cancel(nonce) {
    const builder = this.requireSigner();
    const signature = await builder.signCancel(nonce);
    return this.http.post(ENDPOINTS.orders.cancel, {
      trader: builder.address,
      nonce,
      signature
    });
  }
  async cancelReplace(cancelNonce, newOrder) {
    const builder = this.requireSigner();
    const cancelSig = await builder.signCancel(cancelNonce);
    const signed = await builder.buildAndSign(newOrder);
    return this.http.post(
      ENDPOINTS.orders.cancelReplace,
      {
        cancel: {
          trader: builder.address,
          nonce: cancelNonce,
          signature: cancelSig
        },
        create: signed
      }
    );
  }
  async bulkCreate(orders) {
    const builder = this.requireSigner();
    const signed = await Promise.all(
      orders.map((req) => builder.buildAndSign(req))
    );
    const res = await this.http.post(
      ENDPOINTS.orders.bulkCreate,
      { orders: signed }
    );
    return res.results;
  }
  async bulkCancel(nonces) {
    const builder = this.requireSigner();
    const cancels = await Promise.all(
      nonces.map(async (nonce) => {
        const signature = await builder.signCancel(nonce);
        return { trader: builder.address, nonce, signature };
      })
    );
    const res = await this.http.post(
      ENDPOINTS.orders.bulkCancel,
      { cancels }
    );
    return res.results;
  }
  async bulk(creates, cancelNonces) {
    const builder = this.requireSigner();
    const createOps = await Promise.all(
      creates.map(async (req) => ({
        type: "create",
        order: await builder.buildAndSign(req)
      }))
    );
    const cancelOps = await Promise.all(
      cancelNonces.map(async (nonce) => ({
        type: "cancel",
        cancel: {
          trader: builder.address,
          nonce,
          signature: await builder.signCancel(nonce)
        }
      }))
    );
    return this.http.post(ENDPOINTS.orders.bulk, {
      operations: [...createOps, ...cancelOps]
    });
  }
};

// src/modules/portfolio.ts
var PortfolioModule = class {
  constructor(http2, defaultAddress) {
    this.http = http2;
    this.defaultAddress = defaultAddress;
  }
  resolveAddress(address) {
    const resolved = address ?? this.defaultAddress;
    if (!resolved) {
      throw new Error(
        "Address required. Either pass an address or configure a signer."
      );
    }
    return resolved;
  }
  async get(address, params) {
    return this.http.get(
      ENDPOINTS.portfolio.get(this.resolveAddress(address)),
      {
        kind: params?.kind,
        marketId: params?.marketId,
        cursor: params?.cursor,
        pageSize: params?.pageSize
      }
    );
  }
  async claimable(address) {
    return this.http.get(
      ENDPOINTS.portfolio.claimable(this.resolveAddress(address))
    );
  }
  async stats(address) {
    return this.http.get(
      ENDPOINTS.portfolio.stats(this.resolveAddress(address))
    );
  }
  async balance(address) {
    return this.http.get(
      ENDPOINTS.balance.get(this.resolveAddress(address))
    );
  }
  async tokenBalance(address, tokenAddress) {
    return this.http.get(ENDPOINTS.balance.tokenBalance, {
      address,
      tokenAddress
    });
  }
};

// src/modules/account.ts
import {
  createPublicClient,
  http as viemHttp,
  maxUint256,
  parseUnits
} from "viem";
import { baseSepolia as baseSepolia2 } from "viem/chains";
var AccountModule = class {
  constructor(http2, walletClient, account, rpcUrl) {
    this.http = http2;
    this.walletClient = walletClient;
    this.account = account;
    this.publicClient = createPublicClient({
      chain: baseSepolia2,
      transport: viemHttp(rpcUrl)
    });
  }
  publicClient;
  get address() {
    if (!this.account) {
      throw new ContextConfigError(
        "A signer is required for account operations."
      );
    }
    return this.account.address;
  }
  requireWallet() {
    if (!this.walletClient) {
      throw new ContextConfigError(
        "A signer is required for account operations."
      );
    }
    return this.walletClient;
  }
  requireAccount() {
    if (!this.account) {
      throw new ContextConfigError(
        "A signer is required for account operations."
      );
    }
    return this.account;
  }
  async status() {
    const addr = this.address;
    const [ethBalance, usdcAllowance, isOperatorApproved] = await Promise.all([
      this.publicClient.getBalance({ address: addr }),
      this.publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [addr, HOLDINGS_ADDRESS]
      }),
      this.publicClient.readContract({
        address: HOLDINGS_ADDRESS,
        abi: HOLDINGS_ABI,
        functionName: "isOperatorFor",
        args: [addr, SETTLEMENT_ADDRESS]
      })
    ]);
    return {
      address: addr,
      ethBalance,
      usdcAllowance,
      isOperatorApproved,
      needsApprovals: usdcAllowance === 0n || !isOperatorApproved
    };
  }
  async setup() {
    const wallet = this.requireWallet();
    const account = this.requireAccount();
    const walletStatus = await this.status();
    let usdcApprovalTx = null;
    let operatorApprovalTx = null;
    if (walletStatus.usdcAllowance === 0n) {
      usdcApprovalTx = await wallet.writeContract({
        account,
        chain: baseSepolia2,
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [HOLDINGS_ADDRESS, maxUint256]
      });
    }
    if (!walletStatus.isOperatorApproved) {
      operatorApprovalTx = await wallet.writeContract({
        account,
        chain: baseSepolia2,
        address: HOLDINGS_ADDRESS,
        abi: HOLDINGS_ABI,
        functionName: "setOperator",
        args: [SETTLEMENT_ADDRESS, true]
      });
    }
    return { usdcApprovalTx, operatorApprovalTx };
  }
  async mintTestUsdc(amount = 1e3) {
    return this.http.post(ENDPOINTS.balance.mintTestUsdc, {
      address: this.address,
      amount: amount.toString()
    });
  }
  async deposit(amount) {
    const wallet = this.requireWallet();
    const account = this.requireAccount();
    const amountRaw = parseUnits(amount.toString(), 6);
    const hash = await wallet.writeContract({
      account,
      chain: baseSepolia2,
      address: HOLDINGS_ADDRESS,
      abi: HOLDINGS_ABI,
      functionName: "deposit",
      args: [USDC_ADDRESS, amountRaw]
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
  async withdraw(amount) {
    const wallet = this.requireWallet();
    const account = this.requireAccount();
    const amountRaw = parseUnits(amount.toString(), 6);
    const hash = await wallet.writeContract({
      account,
      chain: baseSepolia2,
      address: HOLDINGS_ADDRESS,
      abi: HOLDINGS_ABI,
      functionName: "withdraw",
      args: [USDC_ADDRESS, amountRaw]
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
  async mintCompleteSets(marketId, amount) {
    const wallet = this.requireWallet();
    const account = this.requireAccount();
    const amountRaw = parseUnits(amount.toString(), 6);
    const hash = await wallet.writeContract({
      account,
      chain: baseSepolia2,
      address: SETTLEMENT_ADDRESS,
      abi: SETTLEMENT_ABI,
      functionName: "mintCompleteSetsFromHoldings",
      args: [marketId, amountRaw]
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
  async burnCompleteSets(marketId, amount, creditInternal = true) {
    const wallet = this.requireWallet();
    const account = this.requireAccount();
    const amountRaw = parseUnits(amount.toString(), 6);
    const hash = await wallet.writeContract({
      account,
      chain: baseSepolia2,
      address: SETTLEMENT_ADDRESS,
      abi: SETTLEMENT_ABI,
      functionName: "burnCompleteSetsFromHoldings",
      args: [marketId, amountRaw, this.address, creditInternal]
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
  // ─── Gasless (high-level: sign + relay) ───
  async gaslessSetup() {
    const wallet = this.requireWallet();
    const account = this.requireAccount();
    const nonce = await this.publicClient.readContract({
      address: HOLDINGS_ADDRESS,
      abi: OPERATOR_NONCE_ABI,
      functionName: "operatorNonce",
      args: [this.address]
    });
    const deadline = BigInt(Math.floor(Date.now() / 1e3) + 3600);
    const signature = await wallet.signTypedData({
      account,
      domain: HOLDINGS_EIP712_DOMAIN,
      types: OPERATOR_APPROVAL_TYPES,
      primaryType: "OperatorApproval",
      message: {
        user: this.address,
        operator: SETTLEMENT_ADDRESS,
        approved: true,
        nonce,
        deadline
      }
    });
    return this.relayOperatorApproval({
      user: this.address,
      approved: true,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature
    });
  }
  async gaslessDeposit(amount) {
    const wallet = this.requireWallet();
    const account = this.requireAccount();
    const amountRaw = parseUnits(amount.toString(), 6);
    const nonce = BigInt(Date.now());
    const deadline = BigInt(Math.floor(Date.now() / 1e3) + 3600);
    const signature = await wallet.signTypedData({
      account,
      domain: PERMIT2_EIP712_DOMAIN,
      types: PERMIT_TRANSFER_FROM_TYPES,
      primaryType: "PermitTransferFrom",
      message: {
        permitted: {
          token: USDC_ADDRESS,
          amount: amountRaw
        },
        spender: HOLDINGS_ADDRESS,
        nonce,
        deadline
      }
    });
    return this.relayDeposit({
      user: this.address,
      amount: amountRaw.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature
    });
  }
  // ─── Gasless Relay (low-level) ───
  async relayOperatorApproval(req) {
    return this.http.post(
      ENDPOINTS.gasless.operator,
      req
    );
  }
  async relayDeposit(req) {
    return this.http.post(
      ENDPOINTS.gasless.depositWithPermit,
      req
    );
  }
};

// src/client.ts
var ContextClient = class {
  markets;
  orders;
  portfolio;
  account;
  /** The trader's on-chain address, or null if no signer was provided. */
  address;
  constructor(options = {}) {
    const http2 = createHttpClient({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl
    });
    let builder = null;
    let address = null;
    let walletClient = null;
    let account = null;
    if (options.signer) {
      const resolved = resolveSigner(options.signer);
      walletClient = resolved.walletClient;
      account = resolved.account;
      address = resolved.account.address;
      builder = new OrderBuilder(walletClient, account);
    }
    this.address = address;
    this.markets = new Markets(http2);
    this.orders = new Orders(http2, builder, address);
    this.portfolio = new PortfolioModule(http2, address);
    this.account = new AccountModule(http2, walletClient, account, options.rpcUrl);
  }
};
export {
  API_BASE,
  CHAIN_ID,
  ContextApiError,
  ContextClient,
  ContextConfigError,
  ContextSigningError,
  HOLDINGS_ADDRESS,
  HOLDINGS_EIP712_DOMAIN,
  PERMIT2_ADDRESS,
  PERMIT2_EIP712_DOMAIN,
  SETTLEMENT_ADDRESS,
  USDC_ADDRESS,
  calculateMaxFee,
  decodePriceCents,
  decodeSize,
  encodePriceCents,
  encodeSize
};
//# sourceMappingURL=index.js.map