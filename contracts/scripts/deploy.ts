import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) {
    throw new Error(
      "No deployer account. Set PRIVATE_KEY in contracts/.env for monad-testnet (e.g. PRIVATE_KEY=0x...)"
    );
  }
  console.log("Deploying with account:", deployer.address);

  const JobFactory = await ethers.getContractFactory("JobFactory");
  const factory = await JobFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("JobFactory deployed to:", factoryAddress);

  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("Escrow (MON) deployed to:", escrowAddress);

  await (await escrow.setJobFactory(factoryAddress)).wait();
  await (await factory.setEscrow(escrowAddress)).wait();
  console.log("JobFactory <-> Escrow (MON) linked.");

  // Optional: deploy EscrowUSDC for mainnet (bounties in USDC). Set USDC_ADDRESS in .env.
  const usdcAddress = process.env.USDC_ADDRESS;
  if (usdcAddress) {
    const EscrowUSDC = await ethers.getContractFactory("EscrowUSDC");
    const escrowUSDC = await EscrowUSDC.deploy(usdcAddress);
    await escrowUSDC.waitForDeployment();
    const escrowUSDCAddress = await escrowUSDC.getAddress();
    console.log("EscrowUSDC deployed to:", escrowUSDCAddress);
    await (await escrowUSDC.setJobFactory(factoryAddress)).wait();
    await (await factory.setEscrowUSDC(escrowUSDCAddress)).wait();
    console.log("JobFactory <-> EscrowUSDC linked.");
    console.log("ESCROW_USDC_ADDRESS=" + escrowUSDCAddress);
  } else {
    console.log("(Skip EscrowUSDC: set USDC_ADDRESS in .env for mainnet USDC bounties)");
  }

  const Reputation = await ethers.getContractFactory("Reputation");
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("Reputation deployed to:", reputationAddress);

  console.log("");
  console.log("Add to backend/.env (use this exact set from this deploy):");
  console.log("JOB_FACTORY_ADDRESS=" + factoryAddress);
  console.log("ESCROW_ADDRESS=" + escrowAddress);
  console.log("REPUTATION_ADDRESS=" + reputationAddress);
  if (usdcAddress) console.log("ESCROW_USDC_ADDRESS=<from above>");
  console.log("MONAD_CHAIN_ID=10143  # testnet; use mainnet chain ID when on mainnet");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
