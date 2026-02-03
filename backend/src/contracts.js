import { ethers } from "ethers";

const RPC = process.env.MONAD_RPC || process.env.MONAD_TESTNET_RPC || "http://127.0.0.1:8545";
const JOB_FACTORY_ADDRESS = process.env.JOB_FACTORY_ADDRESS;
const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS;
const REPUTATION_ADDRESS = process.env.REPUTATION_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

let provider;
let factoryContract;
let escrowContract;
let reputationContract;

export function getProvider() {
  if (!provider) provider = new ethers.JsonRpcProvider(RPC);
  return provider;
}

export function getContractJobFactory() {
  if (!JOB_FACTORY_ADDRESS) return null;
  if (!factoryContract) {
    const abi = [
      "function postJob(bytes32 descriptionHash, uint256 bounty, uint256 deadline) returns (uint256 jobId)",
      "function escrow() view returns (address)",
      "function setClaimed(uint256 jobId, address completer) external",
      "function setSubmitted(uint256 jobId) external",
      "function setCompleted(uint256 jobId, bool success) external",
      "function completeAndRelease(uint256 jobId, address payable completer) external",
      "function completeAndReleaseSplit(uint256 jobId, address payable[] recipients, uint256[] amounts) external",
      "event JobPosted(uint256 indexed jobId, address indexed issuer, bytes32 descriptionHash, uint256 bounty, uint256 deadline)",
    ];
    const signer = PRIVATE_KEY
      ? new ethers.Wallet(PRIVATE_KEY, getProvider())
      : getProvider();
    factoryContract = new ethers.Contract(JOB_FACTORY_ADDRESS, abi, signer);
  }
  return factoryContract;
}

const ESCROW_ABI = [
  "function deposit(uint256 jobId) external payable",
  "function release(uint256 jobId, address payable completer) external",
  "function deposits(uint256 jobId) view returns (uint256)",
];

export function getContractEscrow() {
  if (!ESCROW_ADDRESS || !PRIVATE_KEY) return null;
  if (!escrowContract) {
    const signer = new ethers.Wallet(PRIVATE_KEY, getProvider());
    escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
  }
  return escrowContract;
}

/** Escrow contract at a given address (for deposit). Use JobFactory.escrow() so deposit goes to the same Escrow JobFactory uses. */
export function getEscrowAtAddress(address) {
  if (!address || !PRIVATE_KEY) return null;
  const signer = new ethers.Wallet(PRIVATE_KEY, getProvider());
  return new ethers.Contract(address, ESCROW_ABI, signer);
}

const ESCROW_VIEW_ABI = [
  "function deposits(uint256 jobId) view returns (uint256)",
  "function jobFactory() view returns (address)",
];

/** Read-only Escrow (no signer) to check deposits. Pass address (e.g. from factory.escrow()). */
export function getEscrowDeposit(jobId, escrowAddress = ESCROW_ADDRESS) {
  if (!escrowAddress) return null;
  const escrow = new ethers.Contract(escrowAddress, ESCROW_VIEW_ABI, getProvider());
  return escrow.deposits(jobId);
}

/** Read Escrow.jobFactory() — must equal JOB_FACTORY_ADDRESS or release() reverts with Unauthorized. */
export async function getEscrowJobFactory(escrowAddress) {
  if (!escrowAddress) return null;
  const escrow = new ethers.Contract(escrowAddress, ESCROW_VIEW_ABI, getProvider());
  return escrow.jobFactory();
}

const REPUTATION_ABI = [
  "function recordCompletion(address agent, bool success) external",
  "function getScore(address agent) view returns (uint32 completed, uint32 successTotal, uint8 tier)",
  "function successRateBps(address agent) view returns (uint256)",
];

export function getContractReputation() {
  if (!REPUTATION_ADDRESS || !PRIVATE_KEY) return null;
  if (!reputationContract) {
    const signer = new ethers.Wallet(PRIVATE_KEY, getProvider());
    reputationContract = new ethers.Contract(REPUTATION_ADDRESS, REPUTATION_ABI, signer);
  }
  return reputationContract;
}

/** Read-only reputation score (no signer). */
export async function getReputationScore(agentAddress) {
  if (!REPUTATION_ADDRESS || !agentAddress) return null;
  const rep = new ethers.Contract(REPUTATION_ADDRESS, REPUTATION_ABI, getProvider());
  const [completed, successTotal, tier] = await rep.getScore(agentAddress);
  return { completed: Number(completed), successTotal: Number(successTotal), tier: Number(tier) };
}
