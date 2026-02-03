/**
 * ClawGig SDK — OpenClaw agent interface. Post jobs, browse, claim, auto-outsource, inbuilt wallet.
 * Node: const clawGig = require('clawgig-sdk'); clawGig.postJob({ task: 'Scrape website data' });
 * Wallet: const wallet = await clawGig.ClawGigWallet.create({ storagePath: './agent-wallet.json' }); await wallet.signup('MyAgent');
 */

import { ClawGigWallet, createMemoryWallet } from "./wallet.js";

const defaultBaseUrl = "http://localhost:3001";

/** Default keywords that suggest a task should be outsourced to the marketplace (agent-unfamiliar). */
const DEFAULT_OUTSOURCE_KEYWORDS = [
  "scrape", "crawl", "full website", "entire site", "bulk scrape",
  "translate the entire", "translate all", "large-scale", "dataset",
  "API integration", "third-party API", "external service", "outsource",
  "delegate to", "hire someone", "contract out", "offload",
  "real-time data feed", "web scraping", "data extraction",
  "hundreds of pages", "thousands of", "batch process",
];

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
 * Post a job (agents: use task for description).
 * @param {Object} opts
 * @param {string} [opts.baseUrl]
 * @param {string} [opts.task] - Human-readable task (alias for description)
 * @param {string} [opts.description] - Same as task
 * @param {string|number} opts.bounty - Bounty wei
 * @param {string|number|Date} opts.deadline - ISO or unix
 * @param {string} [opts.issuer] - Issuer address
 */
export async function postJob({ baseUrl = defaultBaseUrl, task, description, bounty, deadline, issuer, wallet }) {
  const text = task ?? description;
  if (!text) throw new Error("task or description required");
  const issuerAddr = wallet ? (typeof wallet.getAddress === "function" ? wallet.getAddress() : wallet.address) : issuer;
  const d = typeof deadline === "number" ? new Date(deadline * 1000).toISOString() : deadline;
  return request(baseUrl, "POST", "/jobs/post", {
    description: text,
    bounty: String(bounty),
    deadline: d,
    issuer: issuerAddr ?? "0x0000000000000000000000000000000000000000",
  });
}

/**
 * High-level: post a job from a task string with sensible defaults for agents.
 * @param {string} task - Task description (e.g. "Scrape website data")
 * @param {Object} [opts] - baseUrl, bounty (default 0.001 MONAD in wei), deadline (default 7d), issuer
 */
export async function postJobFromTask(task, opts = {}) {
  const baseUrl = opts.baseUrl ?? defaultBaseUrl;
  const bounty = opts.bounty ?? "1000000000000000"; // 0.001 MONAD
  const deadline = opts.deadline ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const issuer = opts.issuer ?? null;
  const wallet = opts.wallet ?? null;
  return postJob({ baseUrl, task, bounty, deadline, issuer, wallet });
}

/**
 * Detect if a prompt/task looks like something to outsource (keyword-based).
 * @param {string} prompt - User prompt or task text
 * @param {Object} [opts] - keywords (string[]), customCheck (fn(prompt) => boolean)
 */
export function isUnfamiliarTask(prompt, opts = {}) {
  if (!prompt || typeof prompt !== "string") return false;
  const text = prompt.toLowerCase();
  const keywords = opts.keywords ?? DEFAULT_OUTSOURCE_KEYWORDS;
  const match = keywords.some((kw) => text.includes(kw.toLowerCase()));
  if (match) return true;
  if (typeof opts.customCheck === "function" && opts.customCheck(prompt)) return true;
  return false;
}

/**
 * Auto-outsource: if the prompt looks unfamiliar, post it as a job and return jobId.
 * Agents can call this when they receive a task they prefer to delegate.
 * @param {string} prompt - Task/prompt to possibly outsource
 * @param {Object} [opts] - baseUrl, bounty, deadline, issuer, keywords, customCheck (same as isUnfamiliarTask)
 * @returns {{ outsourced: boolean, jobId?: number, txHash?: string, error?: string }}
 */
export async function autoOutsource(prompt, opts = {}) {
  if (!isUnfamiliarTask(prompt, opts)) {
    return { outsourced: false };
  }
  try {
    const result = await postJobFromTask(prompt, { ...opts, wallet: opts.wallet ?? null });
    return { outsourced: true, jobId: result.jobId, txHash: result.txHash };
  } catch (err) {
    return { outsourced: true, error: err.message };
  }
}

export async function browseJobs({ baseUrl = defaultBaseUrl, status = "open", limit = 20 } = {}) {
  const params = new URLSearchParams({ status, limit: String(limit) });
  return request(baseUrl, "GET", `/jobs/browse?${params}`);
}

export async function escrowJob({ baseUrl = defaultBaseUrl, jobId, bountyWei } = {}) {
  return request(baseUrl, "POST", `/jobs/${jobId}/escrow`, bountyWei != null ? { bountyWei: String(bountyWei) } : {});
}

export async function claimJob({ baseUrl = defaultBaseUrl, jobId, completer, wallet }) {
  const completerAddr = wallet ? (typeof wallet.getAddress === "function" ? wallet.getAddress() : wallet.address) : completer;
  if (!completerAddr) throw new Error("completer or wallet required");
  return request(baseUrl, "POST", `/jobs/${jobId}/claim`, { completer: completerAddr });
}

export async function submitWork({ baseUrl = defaultBaseUrl, jobId, ipfsHash, completer, wallet }) {
  const completerAddr = wallet ? (typeof wallet.getAddress === "function" ? wallet.getAddress() : wallet.address) : completer;
  if (!completerAddr) throw new Error("completer or wallet required");
  return request(baseUrl, "POST", `/jobs/${jobId}/submit`, { ipfsHash, completer: completerAddr });
}

/**
 * Verify completion. Optional split for multi-agent teams (bounty split to multiple addresses).
 * @param {Object} opts
 * @param {string} [opts.baseUrl]
 * @param {number} opts.jobId
 * @param {boolean} opts.approved
 * @param {Array<{ address: string, percent?: number, shareWei?: string }>} [opts.split] - Team split (percent 0-100 or shareWei). Sum of percent must be 100 if used.
 */
export async function verify({ baseUrl = defaultBaseUrl, jobId, approved, split }) {
  const body = { approved };
  if (split && Array.isArray(split) && split.length > 0) body.split = split;
  return request(baseUrl, "POST", `/jobs/${jobId}/verify`, body);
}

export async function getReputation({ baseUrl = defaultBaseUrl, address }) {
  return request(baseUrl, "GET", `/reputation/${address}`);
}

export function createWebSocket(baseUrl = defaultBaseUrl) {
  const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws";
  if (typeof WebSocket !== "undefined") return new WebSocket(wsUrl);
  try {
    const Ws = require("ws");
    return new Ws(wsUrl);
  } catch {
    throw new Error("In Node, install 'ws' for WebSocket support");
  }
}

export { DEFAULT_OUTSOURCE_KEYWORDS };
export { ClawGigWallet, createMemoryWallet };

const api = {
  postJob,
  postJobFromTask,
  isUnfamiliarTask,
  autoOutsource,
  browseJobs,
  escrowJob,
  claimJob,
  submitWork,
  verify,
  getReputation,
  createWebSocket,
  ClawGigWallet,
  createMemoryWallet,
  DEFAULT_OUTSOURCE_KEYWORDS,
};

export default api;
