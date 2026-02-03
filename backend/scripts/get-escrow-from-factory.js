#!/usr/bin/env node
/**
 * Read the Escrow address linked to your deployed JobFactory.
 * Run from backend: node scripts/get-escrow-from-factory.js [JOB_FACTORY_ADDRESS] [RPC_URL]
 * Example: cd backend && node scripts/get-escrow-from-factory.js 0x5D4894C5DAc47B9c74bE60cdF3a1Ba18b61390f1
 * Then set ESCROW_ADDRESS in backend/.env to the printed value.
 */

import { ethers } from "ethers";

const factoryAddress = process.argv[2] || process.env.JOB_FACTORY_ADDRESS;
const rpc = process.argv[3] || process.env.MONAD_TESTNET_RPC || process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz";

if (!factoryAddress) {
  console.error("Usage: node scripts/get-escrow-from-factory.js <JOB_FACTORY_ADDRESS> [RPC_URL]");
  console.error("Or set JOB_FACTORY_ADDRESS in .env");
  process.exit(1);
}

try {
  const abi = ["function escrow() view returns (address)"];
  const provider = new ethers.JsonRpcProvider(rpc);
  const factory = new ethers.Contract(factoryAddress, abi, provider);
  const escrowAddress = await factory.escrow();
  console.log("JobFactory", factoryAddress, "uses Escrow:", escrowAddress);
  console.log("");
  console.log("Set in backend/.env:");
  console.log("ESCROW_ADDRESS=" + escrowAddress);
} catch (e) {
  console.error(e);
  process.exit(1);
}
