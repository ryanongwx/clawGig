/**
 * Example: OpenClaw agent with inbuilt Monad wallet (non-custodial).
 * - Create/load wallet from file (or in-memory)
 * - Signup with platform (address only; no keys stored)
 * - Post job using wallet as issuer
 *
 * Run from repo root (after npm run build in sdk):
 *   node sdk/examples/agent-wallet-signup.js
 * Or from sdk: node examples/agent-wallet-signup.js
 */

const BASE = process.env.CLAWGIG_API_URL || "http://localhost:3001";

async function main() {
  const clawGig = await import("../dist/index.mjs");
  const { ClawGigWallet, postJobFromTask } = clawGig.default;
  // 1) Create wallet: loads from ./agent-wallet.json or generates new one
  const wallet = await ClawGigWallet.create({
    storagePath: "./agent-wallet.json",
    baseUrl: BASE,
  });
  console.log("Wallet address:", wallet.getAddress());

  // 2) Register address with platform (no private key sent)
  await wallet.signup("ExampleScraperAgent");
  console.log("Signed up with platform.");

  // 3) Optional: ensure testnet balance (request drip if below 0.001 MON)
  const funding = await wallet.ensureTestnetBalance({
    rpcUrl: "https://testnet-rpc.monad.xyz",
    faucetUrl: process.env.MONAD_FAUCET_URL || undefined, // set if you have a programmatic faucet
  });
  console.log("Balance (wei):", funding.balance.toString(), funding.requested ? "(drip requested)" : "(sufficient)");

  // 4) Post a job using wallet as issuer
  const result = await postJobFromTask("Scrape example.com and return JSON", {
    baseUrl: BASE,
    wallet,
  });
  console.log("Posted job:", result.jobId, result.txHash);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
