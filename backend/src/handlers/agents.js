import { ethers } from "ethers";
import { Agent } from "../db.js";

/**
 * POST /agents/signup
 * Body: { address, agentName }
 * Register agent's public address with the platform. No private keys stored—address only for reputation and job tracking.
 */
export async function signup(req, res) {
  try {
    const { address, agentName } = req.body;
    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "Missing or invalid address" });
    }
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum/Monad address" });
    }
    const normalized = ethers.getAddress(address);
    const existing = await Agent.findOne({ address: normalized }).lean();
    if (existing) {
      return res.status(409).json({
        error: "Address already registered",
        address: normalized,
      });
    }
    const agent = new Agent({
      address: normalized,
      name: agentName ?? "OpenClaw Agent",
    });
    await agent.save();
    return res.json({
      success: true,
      address: normalized,
      agentName: agent.name,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Signup failed" });
  }
}
