import { ethers } from "ethers";
import { Job } from "../db.js";
import { getContractJobFactory, getContractEscrow, getEscrowAtAddress, getEscrowDeposit, getEscrowJobFactory, getContractReputation, getReputationScore } from "../contracts.js";
import { broadcastJobClaimed } from "../ws.js";

/**
 * POST /jobs/post
 * Body: { description, bounty, deadline, issuer, signature? } — issuer posts job; optional wallet signature for auth.
 */
export async function postJob(req, res) {
  try {
    const { description, bounty, deadline, issuer } = req.body;
    if (!description || !bounty || !deadline || !issuer) {
      return res.status(400).json({ error: "Missing description, bounty, deadline, or issuer" });
    }
    const factory = getContractJobFactory();
    if (!factory) {
      return res.status(503).json({ error: "Blockchain not configured" });
    }
    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
    const deadlineNum = Math.floor(new Date(deadline).getTime() / 1000);
    const tx = await factory.postJob(descriptionHash, bounty, deadlineNum);
    const receipt = await tx.wait();
    const event = receipt.logs?.find((l) => l.fragment?.name === "JobPosted");
    const jobId = event ? Number(event.args[0]) : null;
    if (jobId == null) return res.status(500).json({ error: "Job creation failed" });
    await Job.findOneAndUpdate(
      { jobId },
      {
        jobId,
        issuer,
        descriptionHash,
        description,
        bounty: String(bounty),
        deadline: new Date(deadlineNum * 1000),
        status: "open",
        txHash: receipt.hash,
      },
      { upsert: true, new: true }
    );
    return res.json({ jobId, txHash: receipt.hash });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Post job failed" });
  }
}

/**
 * POST /jobs/:jobId/escrow
 * Body: { bountyWei } — backend wallet deposits bounty into the Escrow that JobFactory uses on-chain (no .env ESCROW_ADDRESS needed).
 */
export async function escrowJob(req, res) {
  try {
    const { jobId } = req.params;
    const { bountyWei } = req.body;
    const job = await Job.findOne({ jobId: Number(jobId), status: "open" }).lean();
    if (!job) return res.status(404).json({ error: "Job not found or not open" });
    const amount = bountyWei ? BigInt(bountyWei) : BigInt(job.bounty);
    if (amount <= 0n) return res.status(400).json({ error: "Invalid bounty amount" });
    const factory = getContractJobFactory();
    if (!factory) return res.status(503).json({ error: "Blockchain not configured" });
    const escrowAddress = await factory.escrow();
    const escrowContract = getEscrowAtAddress(escrowAddress);
    if (!escrowContract) return res.status(503).json({ error: "PRIVATE_KEY not configured" });
    // Use explicit gasLimit to avoid estimateGas failing with "missing revert data" (e.g. insufficient funds)
    const tx = await escrowContract.deposit(Number(jobId), { value: amount, gasLimit: 100000 });
    const receipt = await tx.wait();
    return res.json({
      jobId: Number(jobId),
      txHash: receipt.hash,
      escrowAddress,
      checkOnExplorer: `Verify Escrow ${escrowAddress} has deposits(${jobId}) > 0 and JobFactory.escrow() === ${escrowAddress}`,
    });
  } catch (err) {
    console.error(err);
    const msg = err.message || "Escrow failed";
    const isRevert = msg.includes("revert") || msg.includes("reverted");
    const hint = isRevert
      ? " Backend wallet (PRIVATE_KEY) may not have enough testnet MONAD for this bounty. Try a smaller bountyWei (e.g. 1000000000000000 = 0.001 MONAD) in the request body."
      : msg.includes("insufficient")
        ? " Ensure backend wallet has bounty + gas."
        : "";
    return res.status(500).json({ error: msg + hint });
  }
}

/**
 * POST /jobs/:jobId/claim
 * Body: { completer } — marks job as claimed on-chain and in DB; broadcasts to WebSocket.
 */
export async function claimJob(req, res) {
  try {
    const { jobId } = req.params;
    const { completer } = req.body;
    if (!completer) return res.status(400).json({ error: "Missing completer address" });
    const job = await Job.findOneAndUpdate(
      { jobId: Number(jobId), status: "open" },
      { completer, status: "claimed" },
      { new: true }
    );
    if (!job) return res.status(404).json({ error: "Job not found or not open" });
    const factory = getContractJobFactory();
    if (!factory) return res.status(503).json({ error: "Blockchain not configured" });
    const tx = await factory.setClaimed(Number(jobId), completer);
    const receipt = await tx.wait();
    const wss = req.app.locals.wss;
    if (wss) broadcastJobClaimed(wss, Number(jobId), completer);
    return res.json({ jobId: Number(jobId), completer, txHash: receipt.hash, status: "claimed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Claim failed" });
  }
}

/**
 * GET /jobs/browse?status=open&limit=20
 */
export async function browseJobs(req, res) {
  try {
    const { status = "open", limit = 20 } = req.query;
    const list = await Job.find({ status })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();
    return res.json({ jobs: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Browse failed" });
  }
}

/**
 * POST /jobs/:jobId/submit
 * Body: { ipfsHash, completer }
 * Updates DB and calls JobFactory.setSubmitted(jobId) on-chain so completeAndRelease can run.
 */
export async function submitWork(req, res) {
  try {
    const { jobId } = req.params;
    const { ipfsHash, completer } = req.body;
    if (!ipfsHash || !completer) {
      return res.status(400).json({ error: "Missing ipfsHash or completer" });
    }
    const job = await Job.findOneAndUpdate(
      { jobId: Number(jobId), status: "claimed" },
      { ipfsHash, status: "submitted" },
      { new: true }
    );
    if (!job) return res.status(404).json({ error: "Job not found or not in claimed state" });
    const factory = getContractJobFactory();
    if (factory) {
      const tx = await factory.setSubmitted(Number(jobId));
      await tx.wait();
      return res.json({ jobId: job.jobId, status: "submitted", txHash: tx.hash });
    }
    return res.json({ jobId: job.jobId, status: "submitted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Submit failed" });
  }
}

/**
 * POST /jobs/:jobId/verify
 * Body: { approved: boolean } — issuer or 3rd party verifies; on approval, backend calls completeAndRelease (JobFactory → Escrow).
 */
export async function verify(req, res) {
  try {
    const { jobId } = req.params;
    const { approved, split } = req.body;
    const job = await Job.findOne({ jobId: Number(jobId), status: "submitted" }).lean();
    if (!job) return res.status(404).json({ error: "Job not found or not submitted" });
    const newStatus = approved ? "completed" : "cancelled";
    await Job.updateOne({ jobId: Number(jobId) }, { status: newStatus });
    if (approved) {
      const factory = getContractJobFactory();
      if (!factory) return res.status(503).json({ error: "Blockchain not configured" });
      if (!job.completer) return res.status(400).json({ error: "Job has no completer" });
      const chainEscrow = await factory.escrow();
      const escrowLinkedFactory = await getEscrowJobFactory(chainEscrow);
      const ourFactoryAddress = (process.env.JOB_FACTORY_ADDRESS || "").toLowerCase();
      if (escrowLinkedFactory && escrowLinkedFactory.toLowerCase() !== ourFactoryAddress) {
        return res.status(400).json({
          error: "Escrow.jobFactory() does not match JOB_FACTORY_ADDRESS — release() would revert with Unauthorized.",
          jobId: Number(jobId),
          chainEscrow,
          escrowJobFactory: escrowLinkedFactory,
          envJobFactory: process.env.JOB_FACTORY_ADDRESS,
          fix: "Redeploy contracts (same deploy script) and set JOB_FACTORY_ADDRESS + ESCROW_ADDRESS from that deploy.",
        });
      }
      const depositAmount = await getEscrowDeposit(Number(jobId), chainEscrow);
      if (!depositAmount || depositAmount === 0n) {
        return res.status(400).json({
          error: "No bounty escrowed for this job on-chain. Call POST /jobs/:jobId/escrow first (backend wallet must hold the bounty).",
          jobId: Number(jobId),
          chainEscrow,
        });
      }

      if (split && Array.isArray(split) && split.length > 0) {
        // Multi-agent team split: split = [{ address, percent }] or [{ address, shareWei }]. Sum percent 100 or sum shareWei = deposit.
        const hasPercent = split.some((s) => s.percent != null);
        const hasShareWei = split.some((s) => s.shareWei != null);
        if (hasPercent && hasShareWei) {
          return res.status(400).json({ error: "Split entries must use either percent or shareWei, not both." });
        }
        const recipients = split.map((s) => s.address).filter(Boolean);
        if (recipients.length !== split.length) {
          return res.status(400).json({ error: "Every split entry must have address." });
        }
        let amounts;
        if (hasPercent) {
          const totalPercent = split.reduce((sum, s) => sum + (Number(s.percent) || 0), 0);
          if (Math.abs(totalPercent - 100) > 0.01) {
            return res.status(400).json({ error: "Split percent must sum to 100." });
          }
          const depositNum = Number(depositAmount);
          amounts = split.map((s) => {
            const p = Number(s.percent) || 0;
            return BigInt(Math.floor((depositNum * p) / 100));
          });
          const remainder = depositAmount - amounts.reduce((a, b) => a + b, 0n);
          if (remainder > 0n) amounts[0] += remainder;
        } else {
          amounts = split.map((s) => BigInt(s.shareWei ?? 0));
          const sum = amounts.reduce((a, b) => a + b, 0n);
          if (sum !== depositAmount) {
            return res.status(400).json({ error: "Split shareWei must sum to escrow deposit for this job." });
          }
        }
        const tx = await factory.completeAndReleaseSplit(
          Number(jobId),
          recipients,
          amounts.map((a) => a.toString()),
          { gasLimit: 200000 }
        );
        const receipt = await tx.wait();
        const reputation = getContractReputation();
        if (reputation) {
          try {
            await reputation.recordCompletion(job.completer, true);
          } catch (e) {
            console.error("Reputation.recordCompletion failed:", e.message);
          }
        }
        return res.json({ jobId: Number(jobId), status: newStatus, txHash: receipt.hash, split: true });
      }

      const tx = await factory.completeAndRelease(Number(jobId), job.completer, { gasLimit: 150000 });
      const receipt = await tx.wait();
      const reputation = getContractReputation();
      if (reputation) {
        try {
          await reputation.recordCompletion(job.completer, true);
        } catch (e) {
          console.error("Reputation.recordCompletion failed:", e.message);
        }
      }
      return res.json({ jobId: Number(jobId), status: newStatus, txHash: receipt.hash });
    }
    return res.json({ jobId: Number(jobId), status: newStatus });
  } catch (err) {
    console.error(err);
    const isNoDeposit = err.data === "0xd76ebd0f" || (err.info && err.info.error && err.info.error.data === "0xd76ebd0f");
    const reverted = err.receipt && err.receipt.status === 0;
    if ((err.code === "CALL_EXCEPTION" && isNoDeposit) || reverted) {
      const factory = getContractJobFactory();
      const chainEscrow = factory ? await factory.escrow() : null;
      return res.status(400).json({
        error: reverted
          ? "completeAndRelease tx reverted on-chain (NoDeposit or Unauthorized). Escrow that JobFactory uses has no deposit for this job."
          : "Escrow.release reverted (NoDeposit). JobFactory is calling a different Escrow than the one you deposit to.",
        fix: "Ensure step 2 (escrow) and step 5 (verify) use the same chain. Use a single MONAD_TESTNET_RPC URL. On explorer: JobFactory.escrow() must equal the contract that received the deposit in step 2.",
        setInEnv: chainEscrow ? "ESCROW_ADDRESS=" + chainEscrow : "Run: cd backend && node scripts/get-escrow-from-factory.js " + process.env.JOB_FACTORY_ADDRESS,
      });
    }
    return res.status(500).json({ error: err.message || "Verify failed" });
  }
}

/**
 * GET /reputation/:address
 * Returns on-chain score for an agent (completed, successTotal, tier: 0=none, 1=bronze, 2=silver, 3=gold).
 */
export async function getReputation(req, res) {
  try {
    const { address } = req.params;
    if (!address) return res.status(400).json({ error: "Missing address" });
    const score = await getReputationScore(address);
    if (score == null) return res.status(503).json({ error: "Reputation contract not configured" });
    const tierNames = { 0: "none", 1: "bronze", 2: "silver", 3: "gold" };
    return res.json({ ...score, tierName: tierNames[score.tier] ?? "none" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Reputation fetch failed" });
  }
}
