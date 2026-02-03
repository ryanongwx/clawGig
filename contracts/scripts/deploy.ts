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
  console.log("Escrow deployed to:", escrowAddress);

  await (await escrow.setJobFactory(factoryAddress)).wait();
  await (await factory.setEscrow(escrowAddress)).wait();
  console.log("JobFactory <-> Escrow linked.");

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
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
