#!/usr/bin/env node
/**
 * Check that JobFactory and Escrow are correctly linked (for debugging verify/escrow mismatch).
 * Run from backend: node scripts/check-escrow-link.js [JOB_FACTORY_ADDRESS] [RPC_URL]
 * Or set JOB_FACTORY_ADDRESS and MONAD_RPC in .env.
 *
 * Prints:
 * - JobFactory.escrow() → Escrow address
 * - Escrow(that).jobFactory() → must equal JOB_FACTORY_ADDRESS
 * - OK or mismatch message.
 */

import { ethers } from "ethers";

const factoryAddress = (process.argv[2] || process.env.JOB_FACTORY_ADDRESS || "").trim();
const rpc = process.argv[3] || process.env.MONAD_TESTNET_RPC || process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz";

if (!factoryAddress) {
  console.error("Usage: node scripts/check-escrow-link.js <JOB_FACTORY_ADDRESS> [RPC_URL]");
  console.error("Or set JOB_FACTORY_ADDRESS in .env");
  process.exit(1);
}

const factoryAbi = ["function escrow() view returns (address)"];
const escrowAbi = ["function jobFactory() view returns (address)"];

async function main() {
  const provider = new ethers.JsonRpcProvider(rpc);
  const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
  const escrowAddress = await factory.escrow();

  console.log("JobFactory:", factoryAddress);
  console.log("JobFactory.escrow():", escrowAddress);

  if (!escrowAddress || escrowAddress === ethers.ZeroAddress) {
    console.log("\n❌ JobFactory has no Escrow set (escrow() is zero). Run deploy script and setEscrow.");
    process.exit(1);
  }

  const escrow = new ethers.Contract(escrowAddress, escrowAbi, provider);
  const escrowJobFactory = await escrow.jobFactory();
  console.log("Escrow.jobFactory():", escrowJobFactory);

  const match = escrowJobFactory && escrowJobFactory.toLowerCase() === factoryAddress.toLowerCase();
  if (match) {
    console.log("\n✅ Link OK: Escrow.jobFactory() === JOB_FACTORY_ADDRESS. Verify/release should work.");
  } else {
    console.log("\n❌ Mismatch: Escrow.jobFactory() does not equal JOB_FACTORY_ADDRESS.");
    console.log("   Release will revert with Unauthorized.");
    console.log("   Fix: Redeploy with same deploy script, or call Escrow.setJobFactory(" + factoryAddress + ") if you own the Escrow.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
