#!/usr/bin/env node
/**
 * Run from backend so ethers is found:
 *   cd backend && node scripts/get-escrow-from-factory.js <JOB_FACTORY_ADDRESS>
 * (Script also lives in backend/scripts/get-escrow-from-factory.js)
 */

const path = require("path");
const { ethers } = require(path.join(__dirname, "../backend/node_modules/ethers"));

const factoryAddress = process.argv[2] || process.env.JOB_FACTORY_ADDRESS;
const rpc = process.argv[3] || process.env.MONAD_TESTNET_RPC || process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz";

if (!factoryAddress) {
  console.error("Usage: node scripts/get-escrow-from-factory.js <JOB_FACTORY_ADDRESS> [RPC_URL]");
  console.error("Or set JOB_FACTORY_ADDRESS and optionally MONAD_TESTNET_RPC");
  process.exit(1);
}

async function main() {
  const abi = ["function escrow() view returns (address)"];
  const provider = new ethers.JsonRpcProvider(rpc);
  const factory = new ethers.Contract(factoryAddress, abi, provider);
  const escrowAddress = await factory.escrow();
  console.log("JobFactory", factoryAddress, "uses Escrow:", escrowAddress);
  console.log("");
  console.log("Set in backend/.env:");
  console.log("ESCROW_ADDRESS=" + escrowAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
