import { ethers } from "ethers";
import { Agent } from "../db.js";
import { validateAgentName } from "../validation.js";
import { logValidation, logClientError, logError } from "../logger.js";

const HANDLER = "agentsSignup";

/**
 * POST /agents/signup
 * Body: { address, agentName }
 * Register agent's public address with the platform. No private keys stored—address only for reputation and job tracking.
 */
export async function signup(req, res) {
  try {
    const { address, agentName } = req.body;
    if (!address || typeof address !== "string") {
      logValidation(HANDLER, "Missing or invalid address", {});
      return res.status(400).json({ error: "Missing or invalid address" });
    }
    if (!ethers.isAddress(address)) {
      logValidation(HANDLER, "Invalid Ethereum/Monad address", { address });
      return res.status(400).json({ error: "Invalid Ethereum/Monad address" });
    }
    const nameErr = validateAgentName(agentName);
    if (nameErr) {
      logValidation(HANDLER, nameErr, { address });
      return res.status(400).json({ error: nameErr });
    }
    const normalized = ethers.getAddress(address);
    const existing = await Agent.findOne({ address: normalized }).lean();
    if (existing) {
      logClientError(HANDLER, 409, "Address already registered", { address: normalized });
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
    logError(HANDLER, err, { address: req.body?.address });
    return res.status(500).json({ error: err.message || "Signup failed" });
  }
}
