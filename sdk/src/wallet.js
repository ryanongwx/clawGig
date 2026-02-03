/**
 * ClawGigWallet — Non-custodial inbuilt Monad wallet for OpenClaw agents.
 * Generates or loads wallet locally; persists to file or custom storage; registers only address with platform.
 * Uses ethers.js (EVM-compatible). Platform never stores private keys.
 */

import { ethers } from "ethers";

const defaultBaseUrl = "http://localhost:3001";

function isNode() {
  return typeof process !== "undefined" && process.versions?.node;
}

/** Default file-based storage adapter for Node. Uses fs at storagePath. Optional encryption via encryptPassword. */
function defaultFileAdapter(storagePath, encryptPassword = null) {
  if (!isNode()) {
    return {
      load: () => Promise.resolve(null),
      save: () => Promise.resolve(),
    };
  }
  let fs, path, crypto;
  const getNodeModules = async () => {
    if (!fs) {
      fs = await import("fs");
      path = await import("path");
      crypto = await import("crypto");
    }
    return { fs, path, crypto };
  };

  const ALGO = "aes-256-gcm";
  const SALT_LEN = 16;
  const IV_LEN = 12;
  const TAG_LEN = 16;
  const KEY_LEN = 32;

  function deriveKey(password, salt, c) {
    return c.scryptSync(password, salt, KEY_LEN);
  }

  function encrypt(plaintext, password, c) {
    const salt = c.randomBytes(SALT_LEN);
    const iv = c.randomBytes(IV_LEN);
    const key = deriveKey(password, salt, c);
    const cipher = c.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, enc]).toString("base64");
  }

  function decrypt(ciphertext, password, c) {
    const buf = Buffer.from(ciphertext, "base64");
    const salt = buf.subarray(0, SALT_LEN);
    const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const enc = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN);
    const key = deriveKey(password, salt, c);
    const decipher = c.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final("utf8");
  }

  return {
    async load() {
      const { fs: f, path: p, crypto: c } = await getNodeModules();
      if (!f.existsSync(storagePath)) return null;
      try {
        const raw = f.readFileSync(storagePath, "utf8");
        const data = encryptPassword ? decrypt(raw, encryptPassword, c) : raw;
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    },
    async save(data) {
      const { fs: f, path: p } = await getNodeModules();
      const dir = p.dirname(storagePath);
      if (!f.existsSync(dir)) f.mkdirSync(dir, { recursive: true });
      const str = JSON.stringify(data);
      const out = encryptPassword ? encrypt(str, encryptPassword, (await getNodeModules()).crypto) : str;
      f.writeFileSync(storagePath, out);
    },
  };
}

/** In-memory adapter (no persistence). Useful for ephemeral agents or when caller manages state. */
function memoryAdapter() {
  let data = null;
  return {
    load: () => Promise.resolve(data),
    save: (d) => {
      data = d;
      return Promise.resolve();
    },
  };
}

async function request(baseUrl, method, path, body = null) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
  return data;
}

/**
 * Non-custodial wallet for OpenClaw agents. Generate or load locally; persist via file or custom adapter; register address only with platform.
 * @param {Object} [opts]
 * @param {string} [opts.storagePath] - Path to JSON file (Node only). Default ./agent-wallet.json
 * @param {Object} [opts.storageAdapter] - { load(): Promise<object|null>, save(data): Promise<void> }. Overrides storagePath when provided.
 * @param {string} [opts.baseUrl] - ClawGig API base URL for signup
 * @param {string} [opts.encryptPassword] - If set, encrypt stored wallet with this password (Node file adapter only). Production: use a strong secret.
 */
export class ClawGigWallet {
  constructor(opts = {}) {
    this.baseUrl = opts.baseUrl ?? defaultBaseUrl;
    this.encryptPassword = opts.encryptPassword ?? null;
    if (opts.storageAdapter) {
      this.storage = opts.storageAdapter;
    } else {
      const path = opts.storagePath ?? "./agent-wallet.json";
      this.storage = opts.encryptPassword
        ? defaultFileAdapter(path, opts.encryptPassword)
        : defaultFileAdapter(path);
    }
    this.wallet = null;
  }

  /**
   * Load existing wallet from storage or generate a new one. Call once after constructor (or use create()).
   */
  async initialize() {
    const data = await this.storage.load();
    if (data && (data.privateKey || data.mnemonic)) {
      if (data.mnemonic) {
        this.wallet = ethers.Wallet.fromPhrase(data.mnemonic);
      } else {
        this.wallet = new ethers.Wallet(data.privateKey);
      }
      return this;
    }
    this.wallet = ethers.Wallet.createRandom();
    await this.save();
    return this;
  }

  /**
   * Create and initialize a ClawGigWallet in one step.
   */
  static async create(opts = {}) {
    const w = new ClawGigWallet(opts);
    await w.initialize();
    return w;
  }

  /**
   * Restore wallet from mnemonic (e.g. after loss). Overwrites current wallet and saves.
   */
  async restoreFromMnemonic(mnemonic) {
    this.wallet = ethers.Wallet.fromPhrase(mnemonic);
    await this.save();
    return this;
  }

  getAddress() {
    if (!this.wallet) throw new Error("Wallet not initialized. Call initialize() or create() first.");
    return this.wallet.address;
  }

  /** Raw ethers Wallet for signing / sendTransaction. */
  getWallet() {
    if (!this.wallet) throw new Error("Wallet not initialized. Call initialize() or create() first.");
    return this.wallet;
  }

  async save() {
    if (!this.wallet) return;
    const data = {
      address: this.wallet.address,
      privateKey: this.wallet.privateKey,
      mnemonic: this.wallet.mnemonic?.phrase ?? null,
    };
    await this.storage.save(data);
  }

  /**
   * Register this agent's address with the platform (no private key sent). Links address for reputation and jobs.
   */
  async signup(agentName, baseUrl = null) {
    const url = baseUrl ?? this.baseUrl;
    const res = await request(url, "POST", "/agents/signup", {
      address: this.getAddress(),
      agentName: agentName ?? "OpenClaw Agent",
    });
    return res;
  }

  /**
   * Sign and broadcast a transaction (e.g. for future agent-sent txs). Escrow in ClawGig is currently done by the backend; use this for custom agent txs.
   */
  async sendTransaction(txDetails, rpcUrl = "https://testnet-rpc.monad.xyz") {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const connected = this.wallet.connect(provider);
    const tx = await connected.sendTransaction(txDetails);
    return tx;
  }

  /**
   * Get MON balance (native token) on the given RPC. Useful for checking if the agent needs testnet funds.
   */
  async getBalance(rpcUrl = "https://testnet-rpc.monad.xyz") {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(this.getAddress());
    return balance;
  }

  /**
   * Request testnet MON from a faucet. Use when balance is low for development.
   * If minBalanceWei is set, skips the request when balance is already >= minBalanceWei.
   * @param {Object} [opts]
   * @param {string} [opts.faucetUrl] - Faucet API URL (POST { address } or GET ?address=0x...). Default: Monad testnet faucet API when available.
   * @param {string} [opts.rpcUrl] - RPC to check balance (default testnet-rpc.monad.xyz)
   * @param {bigint|string} [opts.minBalanceWei] - If set, only request when balance < this (e.g. 0.001 MON = 1000000000000000n)
   * @returns {{ requested: boolean, success?: boolean, balance?: bigint, error?: string }}
   */
  async requestTestnetFunds(opts = {}) {
    const rpcUrl = opts.rpcUrl ?? "https://testnet-rpc.monad.xyz";
    const address = this.getAddress();
    let balance = await this.getBalance(rpcUrl);
    const minBalanceWei = opts.minBalanceWei != null ? BigInt(opts.minBalanceWei) : null;
    if (minBalanceWei != null && balance >= minBalanceWei) {
      return { requested: false, balance };
    }
    const faucetUrl = opts.faucetUrl ?? "https://faucet.monad.xyz/api/drip";
    try {
      let res;
      if (faucetUrl.includes("/api/") || faucetUrl.endsWith("/drip")) {
        res = await fetch(faucetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
      } else {
        const url = new URL(faucetUrl);
        url.searchParams.set("address", address);
        res = await fetch(url.toString(), { method: "GET" });
      }
      const data = await res.json().catch(() => ({}));
      const success = res.ok && (data.success === true || data.ok === true || data.txHash != null);
      return { requested: true, success, balance, ...(data.error && { error: data.error }) };
    } catch (err) {
      return { requested: true, success: false, balance, error: err.message };
    }
  }

  /**
   * Ensure minimum testnet balance: check balance, request drip if below threshold. Agent-friendly one-liner.
   * @param {Object} [opts] - Same as requestTestnetFunds; minBalanceWei default 0.001 MON (1000000000000000n)
   * @returns {{ requested: boolean, success?: boolean, balance: bigint }}
   */
  async ensureTestnetBalance(opts = {}) {
    const minBalanceWei = opts.minBalanceWei ?? "1000000000000000"; // 0.001 MON
    const result = await this.requestTestnetFunds({ ...opts, minBalanceWei });
    return {
      requested: result.requested,
      success: result.success,
      balance: result.balance ?? (await this.getBalance(opts.rpcUrl)),
    };
  }
}

/**
 * In-memory only wallet (no persistence). For one-off scripts or when agent manages state elsewhere.
 */
export function createMemoryWallet(baseUrl = defaultBaseUrl) {
  return ClawGigWallet.create({
    storageAdapter: memoryAdapter(),
    baseUrl,
  });
}

export default ClawGigWallet;
