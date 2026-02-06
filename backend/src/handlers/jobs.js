import { ethers } from "ethers";
import { Job } from "../db.js";
import {
  getContractJobFactory,
  getEscrowAtAddress,
  getEscrowDeposit,
  getEscrowJobFactory,
  getEscrowUSDCAddress,
  getEscrowUSDCAtAddress,
  getContractReputation,
  getReputationScore,
  isMainnet,
} from "../contracts.js";
import {
  broadcastJobClaimed,
  broadcastWorkSubmitted,
  broadcastJobCompleted,
  broadcastJobCancelled,
  broadcastJobReopened,
} from "../ws.js";
import {
  buildPostMessage,
  buildEscrowMessage,
  buildCancelMessage,
  buildExpireMessage,
  buildVerifyMessage,
  verifyIssuerSignature,
  requireIssuerSignatureForPost,
  requireIssuerSignatureForEscrow,
  requireIssuerSignatureForCancel,
  requireIssuerSignatureForExpire,
  requireIssuerSignatureForVerify,
} from "../issuerAuth.js";
import {
  buildClaimMessage,
  buildSubmitMessage,
  verifyCompleterSignature,
  requireCompleterSignatureForClaim,
  requireCompleterSignatureForSubmit,
} from "../completerAuth.js";
import {
  parseJobId,
  validateDescription,
  validateBounty,
  validateDeadline,
  capSearchQuery,
} from "../validation.js";
import { logValidation, logSignatureFailure, logClientError, logError } from "../logger.js";

const TOKEN_MON = 0;
const HANDLER = Object.freeze({
  postJob: "postJob",
  escrowJob: "escrowJob",
  claimJob: "claimJob",
  getJobById: "getJobById",
  cancelJob: "cancelJob",
  expireJob: "expireJob",
  browseJobs: "browseJobs",
  getStats: "getStats",
  submitWork: "submitWork",
  verify: "verify",
  getReputation: "getReputation",
});
const TOKEN_USDC = 1;

/**
 * POST /jobs/post
 * Body: { description, bounty, deadline, issuer, bountyToken?, signature? } — bountyToken "MON" (default) or "USDC" (mainnet only).
 * If REQUIRE_ISSUER_SIGNATURE_FOR_POST=true, body must include { signature }; signer must equal issuer (proves control of issuer address).
 */
export async function postJob(req, res) {
  try {
    const { description, bounty, deadline, issuer, bountyToken: rawToken, signature } = req.body || {};
    if (!description || !bounty || !deadline || !issuer) {
      logValidation(HANDLER.postJob, "Missing description, bounty, deadline, or issuer", { issuer });
      return res.status(400).json({ error: "Missing description, bounty, deadline, or issuer" });
    }
    if (!ethers.isAddress(issuer)) {
      logValidation(HANDLER.postJob, "Invalid issuer address", { issuer });
      return res.status(400).json({ error: "Invalid issuer address" });
    }
    const descErr = validateDescription(description);
    if (descErr) {
      logValidation(HANDLER.postJob, descErr, { issuer });
      return res.status(400).json({ error: descErr });
    }
    const bountyErr = validateBounty(bounty);
    if (bountyErr) {
      logValidation(HANDLER.postJob, bountyErr, { issuer });
      return res.status(400).json({ error: bountyErr });
    }
    const deadlineErr = validateDeadline(deadline);
    if (deadlineErr) {
      logValidation(HANDLER.postJob, deadlineErr, { issuer });
      return res.status(400).json({ error: deadlineErr });
    }
    const normalizedIssuer = ethers.getAddress(issuer);
    if (requireIssuerSignatureForPost()) {
      if (!signature) {
        logSignatureFailure(HANDLER.postJob, "Issuer signature required for post (missing signature)", { issuer: normalizedIssuer });
        return res.status(403).json({
          error: "Issuer signature required for post. Sign the message from the issuer wallet and send { signature }.",
        });
      }
      const message = buildPostMessage(normalizedIssuer);
      const result = verifyIssuerSignature(message, signature, normalizedIssuer);
      if (!result.ok) {
        logSignatureFailure(HANDLER.postJob, result.error, { issuer: normalizedIssuer });
        return res.status(403).json({ error: result.error });
      }
    }
    const bountyToken = (rawToken || "MON").toUpperCase() === "USDC" ? "USDC" : "MON";
    if (bountyToken === "USDC" && !isMainnet()) {
      return res.status(400).json({ error: "USDC bounties only on Monad mainnet. Use MON on testnet." });
    }
    const factory = getContractJobFactory();
    if (!factory) return res.status(503).json({ error: "Blockchain not configured" });

    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
    const deadlineNum = Math.floor(new Date(deadline).getTime() / 1000);

    let tx;
    if (bountyToken === "USDC") {
      const escrowUSDCAddr = await getEscrowUSDCAddress();
      if (!escrowUSDCAddr) {
        return res.status(400).json({ error: "USDC escrow not configured. Set EscrowUSDC on JobFactory for mainnet." });
      }
      tx = await factory.postJobWithToken(descriptionHash, bounty, deadlineNum, TOKEN_USDC);
    } else {
      tx = await factory.postJob(descriptionHash, bounty, deadlineNum);
    }
    const receipt = await tx.wait();
    const event = receipt.logs?.find((l) => l.fragment?.name === "JobPosted");
    const jobId = event ? Number(event.args[0]) : null;
    if (jobId == null) return res.status(500).json({ error: "Job creation failed" });

    await Job.findOneAndUpdate(
      { jobId },
      {
        jobId,
        issuer: normalizedIssuer,
        descriptionHash,
        description,
        bounty: String(bounty),
        bountyToken,
        deadline: new Date(deadlineNum * 1000),
        status: "open",
        txHash: receipt.hash,
      },
      { upsert: true, new: true }
    );
    return res.json({ jobId, txHash: receipt.hash, bountyToken });
  } catch (err) {
    logError(HANDLER.postJob, err, { issuer: req.body?.issuer });
    return res.status(500).json({ error: err.message || "Post job failed" });
  }
}

/**
 * POST /jobs/:jobId/escrow
 * Body: { bountyWei?, signature? } — backend deposits bounty into Escrow (MON) or EscrowUSDC (USDC).
 * If REQUIRE_ISSUER_SIGNATURE_FOR_ESCROW=true, body must include { signature }; signer must equal job.issuer (only issuer can lock bounty).
 */
export async function escrowJob(req, res) {
  try {
    const parsed = parseJobId(req);
    if (!parsed.ok) {
      logValidation(HANDLER.escrowJob, parsed.error, { jobId: req.params?.jobId });
      return res.status(parsed.status).json({ error: parsed.error });
    }
    const { jobId } = parsed;
    const { bountyWei, signature } = req.body || {};
    const job = await Job.findOne({ jobId, status: "open" }).lean();
    if (!job) {
      logClientError(HANDLER.escrowJob, 404, "Job not found or not open", { jobId });
      return res.status(404).json({ error: "Job not found or not open" });
    }
    if (requireIssuerSignatureForEscrow()) {
      if (!signature) {
        logSignatureFailure(HANDLER.escrowJob, "Issuer signature required for escrow (missing signature)", { jobId, issuer: job.issuer });
        return res.status(403).json({
          error: "Issuer signature required for escrow. Sign the message from the issuer wallet and send { signature }.",
        });
      }
      const message = buildEscrowMessage(jobId);
      const result = verifyIssuerSignature(message, signature, job.issuer);
      if (!result.ok) {
        logSignatureFailure(HANDLER.escrowJob, result.error, { jobId, issuer: job.issuer });
        return res.status(403).json({ error: result.error });
      }
    }
    const amount = bountyWei ? BigInt(bountyWei) : BigInt(job.bounty);
    if (amount <= 0n) return res.status(400).json({ error: "Invalid bounty amount" });
    const factory = getContractJobFactory();
    if (!factory) return res.status(503).json({ error: "Blockchain not configured" });

    if (job.bountyToken === "USDC") {
      const escrowUSDCAddr = await getEscrowUSDCAddress();
      if (!escrowUSDCAddr) return res.status(503).json({ error: "EscrowUSDC not configured" });
      const escrowUSDC = getEscrowUSDCAtAddress(escrowUSDCAddr);
      if (!escrowUSDC) return res.status(503).json({ error: "PRIVATE_KEY not configured" });
      const tx = await escrowUSDC.deposit(jobId, amount, { gasLimit: 150000 });
      const receipt = await tx.wait();
      return res.json({
        jobId,
        txHash: receipt.hash,
        escrowAddress: escrowUSDCAddr,
        bountyToken: "USDC",
        checkOnExplorer: `Verify EscrowUSDC ${escrowUSDCAddr} has deposits(${jobId}) > 0`,
      });
    }

    const escrowAddress = await factory.escrow();
    const escrowContract = getEscrowAtAddress(escrowAddress);
    if (!escrowContract) return res.status(503).json({ error: "PRIVATE_KEY not configured" });
    const tx = await escrowContract.deposit(jobId, { value: amount, gasLimit: 100000 });
    const receipt = await tx.wait();
    return res.json({
      jobId,
      txHash: receipt.hash,
      escrowAddress,
      bountyToken: "MON",
      checkOnExplorer: `Verify Escrow ${escrowAddress} has deposits(${jobId}) > 0 and JobFactory.escrow() === ${escrowAddress}`,
    });
  } catch (err) {
    logError(HANDLER.escrowJob, err, { jobId: req.params?.jobId });
    const msg = err.message || "Escrow failed";
    const isRevert = msg.includes("revert") || msg.includes("reverted");
    const hint = isRevert
      ? " Backend wallet (PRIVATE_KEY) may not have enough testnet MON for this bounty, or (USDC) insufficient allowance/balance."
      : msg.includes("insufficient")
        ? " Ensure backend wallet has bounty + gas (MON) or USDC balance + approval (USDC)."
        : "";
    return res.status(500).json({ error: msg + hint });
  }
}

/**
 * POST /jobs/:jobId/claim
 * Body: { completer, signature? } — marks job as claimed on-chain and in DB; broadcasts to WebSocket.
 * If REQUIRE_COMPLETER_SIGNATURE_FOR_CLAIM=true, body must include { signature }; signer must equal completer (only completer wallet can claim).
 */
export async function claimJob(req, res) {
  try {
    const parsed = parseJobId(req);
    if (!parsed.ok) {
      logValidation(HANDLER.claimJob, parsed.error, { jobId: req.params?.jobId });
      return res.status(parsed.status).json({ error: parsed.error });
    }
    const { jobId } = parsed;
    const { completer, signature } = req.body || {};
    if (!completer) {
      logValidation(HANDLER.claimJob, "Missing completer address", { jobId });
      return res.status(400).json({ error: "Missing completer address" });
    }
    if (!ethers.isAddress(completer)) {
      logValidation(HANDLER.claimJob, "Invalid completer address", { jobId, completer });
      return res.status(400).json({ error: "Invalid completer address" });
    }
    const normalizedCompleter = ethers.getAddress(completer);
    if (requireCompleterSignatureForClaim()) {
      if (!signature) {
        logSignatureFailure(HANDLER.claimJob, "Completer signature required for claim (missing signature)", { jobId, completer: normalizedCompleter });
        return res.status(403).json({
          error: "Completer signature required for claim. Sign the message from the completer wallet and send { signature }.",
        });
      }
      const message = buildClaimMessage(jobId, normalizedCompleter);
      const result = verifyCompleterSignature(message, signature, normalizedCompleter);
      if (!result.ok) {
        logSignatureFailure(HANDLER.claimJob, result.error, { jobId, completer: normalizedCompleter });
        return res.status(403).json({ error: result.error });
      }
    }
    const job = await Job.findOneAndUpdate(
      { jobId, status: "open" },
      { completer: normalizedCompleter, status: "claimed" },
      { new: true }
    );
    if (!job) {
      logClientError(HANDLER.claimJob, 404, "Job not found or not open", { jobId });
      return res.status(404).json({ error: "Job not found or not open" });
    }
    const factory = getContractJobFactory();
    if (!factory) return res.status(503).json({ error: "Blockchain not configured" });
    const tx = await factory.setClaimed(jobId, normalizedCompleter);
    const receipt = await tx.wait();
    const wss = req.app.locals.wss;
    if (wss) broadcastJobClaimed(wss, jobId, normalizedCompleter);
    return res.json({ jobId, completer: normalizedCompleter, txHash: receipt.hash, status: "claimed" });
  } catch (err) {
    logError(HANDLER.claimJob, err, { jobId: req.params?.jobId, completer: req.body?.completer });
    return res.status(500).json({ error: err.message || "Claim failed" });
  }
}

/**
 * GET /jobs/:jobId — return a single job by ID (from DB). Includes expired: true when status=open and deadline < now.
 */
export async function getJobById(req, res) {
  try {
    const parsed = parseJobId(req);
    if (!parsed.ok) {
      logValidation(HANDLER.getJobById, parsed.error, { jobId: req.params?.jobId });
      return res.status(parsed.status).json({ error: parsed.error });
    }
    const { jobId } = parsed;
    const job = await Job.findOne({ jobId }).lean();
    if (!job) {
      logClientError(HANDLER.getJobById, 404, "Job not found", { jobId });
      return res.status(404).json({ error: "Job not found" });
    }
    const expired = job.status === "open" && job.deadline && new Date(job.deadline) < new Date();
    return res.json({ ...job, expired });
  } catch (err) {
    logError(HANDLER.getJobById, err, { jobId: req.params?.jobId });
    return res.status(500).json({ error: err.message || "Get job failed" });
  }
}

/**
 * POST /jobs/:jobId/cancel — cancel an open job and refund issuer (backend as JobFactory owner).
 * If REQUIRE_ISSUER_SIGNATURE_FOR_CANCEL=true, body must include { signature }; signer must equal job.issuer.
 */
export async function cancelJob(req, res) {
  try {
    const parsed = parseJobId(req);
    if (!parsed.ok) {
      logValidation(HANDLER.cancelJob, parsed.error, { jobId: req.params?.jobId });
      return res.status(parsed.status).json({ error: parsed.error });
    }
    const { jobId } = parsed;
    const job = await Job.findOne({ jobId, status: "open" }).lean();
    if (!job) {
      logClientError(HANDLER.cancelJob, 404, "Job not found or not open", { jobId });
      return res.status(404).json({ error: "Job not found or not open" });
    }
    if (requireIssuerSignatureForCancel()) {
      const { signature } = req.body || {};
      if (!signature) {
        logSignatureFailure(HANDLER.cancelJob, "Issuer signature required for cancel (missing signature)", { jobId, issuer: job.issuer });
        return res.status(403).json({ error: "Issuer signature required for cancel. Sign the message from the issuer wallet and send { signature }." });
      }
      const message = buildCancelMessage(jobId);
      const result = verifyIssuerSignature(message, signature, job.issuer);
      if (!result.ok) {
        logSignatureFailure(HANDLER.cancelJob, result.error, { jobId, issuer: job.issuer });
        return res.status(403).json({ error: result.error });
      }
    }
    const factory = getContractJobFactory();
    if (!factory) return res.status(503).json({ error: "Blockchain not configured" });
    await (await factory.cancelJobAsOwner(jobId)).wait();
    const chainEscrow = job.bountyToken === "USDC" ? await getEscrowUSDCAddress() : await factory.escrow();
    if (chainEscrow) {
      const deposit = await getEscrowDeposit(jobId, chainEscrow);
      if (deposit > 0n) await (await factory.refundToIssuer(jobId)).wait();
    }
    await Job.updateOne({ jobId }, { status: "cancelled" });
    const wss = req.app.locals.wss;
    if (wss) broadcastJobCancelled(wss, jobId, "cancel");
    return res.json({ jobId, status: "cancelled", refunded: true });
  } catch (err) {
    logError(HANDLER.cancelJob, err, { jobId: req.params?.jobId });
    return res.status(500).json({ error: err.message || "Cancel failed" });
  }
}

/**
 * POST /jobs/:jobId/expire — expire an open job past deadline: cancel + refund (backend as JobFactory owner).
 * If REQUIRE_ISSUER_SIGNATURE_FOR_EXPIRE=true, body must include { signature }; signer must equal job.issuer.
 */
export async function expireJob(req, res) {
  try {
    const parsed = parseJobId(req);
    if (!parsed.ok) return res.status(parsed.status).json({ error: parsed.error });
    const { jobId } = parsed;
    const job = await Job.findOne({ jobId, status: "open" }).lean();
    if (!job) return res.status(404).json({ error: "Job not found or not open" });
    const now = new Date();
    if (new Date(job.deadline) >= now) {
      return res.status(400).json({ error: "Job deadline has not passed yet" });
    }
    if (requireIssuerSignatureForExpire()) {
      const { signature } = req.body || {};
      if (!signature) return res.status(403).json({ error: "Issuer signature required for expire. Sign the message from the issuer wallet and send { signature }." });
      const message = buildExpireMessage(jobId);
      const result = verifyIssuerSignature(message, signature, job.issuer);
      if (!result.ok) return res.status(403).json({ error: result.error });
    }
    const factory = getContractJobFactory();
    if (!factory) return res.status(503).json({ error: "Blockchain not configured" });
    await (await factory.cancelJobAsOwner(jobId)).wait();
    const chainEscrow = job.bountyToken === "USDC" ? await getEscrowUSDCAddress() : await factory.escrow();
    if (chainEscrow) {
      const deposit = await getEscrowDeposit(jobId, chainEscrow);
      if (deposit > 0n) await (await factory.refundToIssuer(jobId)).wait();
    }
    await Job.updateOne({ jobId }, { status: "cancelled" });
    const wssExpire = req.app.locals.wss;
    if (wssExpire) broadcastJobCancelled(wssExpire, jobId, "expire");
    return res.json({ jobId, status: "cancelled", expired: true, refunded: true });
  } catch (err) {
    logError(HANDLER.expireJob, err, { jobId: req.params?.jobId });
    return res.status(500).json({ error: err.message || "Expire failed" });
  }
}

function escapeRegex(s) {
  if (typeof s !== "string") return "";
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /jobs/browse
 * Query: status, limit, offset, q (search description), minBounty, maxBounty (wei string), bountyToken, issuer, deadlineBefore (ISO), deadlineAfter (ISO), includeExpired (default true for open jobs).
 * Returns: { jobs, total, offset, limit, hasMore }. Each job includes expired: true when status=open and deadline < now.
 */
export async function browseJobs(req, res) {
  try {
    const {
      status = "open",
      limit = 20,
      offset = 0,
      q,
      minBounty,
      maxBounty,
      bountyToken,
      issuer,
      deadlineBefore,
      deadlineAfter,
      includeExpired,
    } = req.query;

    const filter = { status };
    const qCapped = capSearchQuery(q);
    if (qCapped) {
      filter.description = new RegExp(escapeRegex(qCapped), "i");
    }
    if (bountyToken && (bountyToken === "MON" || bountyToken === "USDC")) {
      filter.bountyToken = bountyToken;
    }
    const issuerCapped = capSearchQuery(issuer);
    if (issuerCapped) {
      filter.issuer = new RegExp(escapeRegex(issuerCapped), "i");
    }
    if (deadlineBefore) {
      filter.deadline = filter.deadline || {};
      filter.deadline.$lte = new Date(deadlineBefore);
    }
    if (deadlineAfter) {
      filter.deadline = filter.deadline || {};
      filter.deadline.$gte = new Date(deadlineAfter);
    }
    if (status === "open" && includeExpired === "false") {
      filter.deadline = filter.deadline || {};
      filter.deadline.$gte = new Date();
    }
    if ((minBounty !== undefined && minBounty !== "") || (maxBounty !== undefined && maxBounty !== "")) {
      const ands = [];
      if (minBounty !== undefined && minBounty !== "") {
        ands.push({ $gte: [{ $toLong: "$bounty" }, Number(minBounty)] });
      }
      if (maxBounty !== undefined && maxBounty !== "") {
        ands.push({ $lte: [{ $toLong: "$bounty" }, Number(maxBounty)] });
      }
      if (ands.length) filter.$expr = ands.length === 1 ? ands[0] : { $and: ands };
    }

    const skip = Math.max(0, Number(offset) || 0);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const [list, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum + 1).lean(),
      Job.countDocuments(filter),
    ]);

    const hasMore = list.length > limitNum;
    const jobs = (hasMore ? list.slice(0, limitNum) : list).map((j) => ({
      ...j,
      expired: j.status === "open" && j.deadline && new Date(j.deadline) < new Date(),
    }));

    return res.json({ jobs, total, offset: skip, limit: limitNum, hasMore });
  } catch (err) {
    logError(HANDLER.browseJobs, err);
    return res.status(500).json({ error: err.message || "Browse failed" });
  }
}

/**
 * GET /jobs/stats
 * Returns: { openJobs, completedJobs } — counts for landing page.
 */
export async function getStats(req, res) {
  try {
    const [openJobs, completedJobs] = await Promise.all([
      Job.countDocuments({ status: "open" }),
      Job.countDocuments({ status: "completed" }),
    ]);
    return res.json({ openJobs, completedJobs });
  } catch (err) {
    logError(HANDLER.getStats, err);
    return res.status(500).json({ error: err.message || "Stats failed" });
  }
}

/**
 * POST /jobs/:jobId/submit
 * Body: { ipfsHash, completer, signature? }
 * Updates DB and calls JobFactory.setSubmitted(jobId) on-chain so completeAndRelease can run.
 * If REQUIRE_COMPLETER_SIGNATURE_FOR_SUBMIT=true, body must include { signature }; signer must equal job.completer (only claimed completer can submit).
 */
export async function submitWork(req, res) {
  try {
    const parsed = parseJobId(req);
    if (!parsed.ok) return res.status(parsed.status).json({ error: parsed.error });
    const { jobId } = parsed;
    const { ipfsHash, completer, signature } = req.body || {};
    if (!ipfsHash || !completer) {
      return res.status(400).json({ error: "Missing ipfsHash or completer" });
    }
    const job = await Job.findOne({ jobId, status: "claimed" }).lean();
    if (!job) return res.status(404).json({ error: "Job not found or not in claimed state" });
    if ((completer || "").toLowerCase() !== (job.completer || "").toLowerCase()) {
      return res.status(400).json({ error: "Completer address must match the job's claimed completer" });
    }
    const normalizedCompleter = ethers.getAddress(completer);
    if (requireCompleterSignatureForSubmit()) {
      if (!signature) {
        return res.status(403).json({
          error: "Completer signature required for submit. Sign the message from the completer wallet and send { signature }.",
        });
      }
      const message = buildSubmitMessage(jobId, normalizedCompleter, String(ipfsHash).trim());
      const result = verifyCompleterSignature(message, signature, normalizedCompleter);
      if (!result.ok) return res.status(403).json({ error: result.error });
    }
    await Job.findOneAndUpdate(
      { jobId, status: "claimed" },
      { ipfsHash: String(ipfsHash).trim(), status: "submitted" },
      { new: true }
    );
    const factory = getContractJobFactory();
    if (factory) {
      const tx = await factory.setSubmitted(jobId);
      await tx.wait();
      const wssSubmit = req.app.locals.wss;
      if (wssSubmit) broadcastWorkSubmitted(wssSubmit, jobId, normalizedCompleter, ipfsHash);
      return res.json({ jobId, status: "submitted", txHash: tx.hash });
    }
    const wssSubmitNoChain = req.app.locals.wss;
    if (wssSubmitNoChain) broadcastWorkSubmitted(wssSubmitNoChain, jobId, normalizedCompleter, ipfsHash);
    return res.json({ jobId, status: "submitted" });
  } catch (err) {
    logError(HANDLER.submitWork, err, { jobId: req.params?.jobId, completer: req.body?.completer });
    return res.status(500).json({ error: err.message || "Submit failed" });
  }
}

/**
 * POST /jobs/:jobId/verify
 * Body: { approved: boolean, split?, reopen?, signature? } — on approval: completeAndRelease. On reject: reopen=true → rejectAndReopen (job open for another agent); reopen=false → setCompleted(false) + refundToIssuer.
 * If REQUIRE_ISSUER_SIGNATURE_FOR_VERIFY=true, body must include { signature }; signer must equal job.issuer. Message format: ClawGig verify job <jobId> approved <bool> reopen <bool>.
 */
export async function verify(req, res) {
  try {
    const parsed = parseJobId(req);
    if (!parsed.ok) {
      logValidation(HANDLER.verify, parsed.error, { jobId: req.params?.jobId });
      return res.status(parsed.status).json({ error: parsed.error });
    }
    const { jobId } = parsed;
    const { approved, split, reopen, signature } = req.body || {};
    const job = await Job.findOne({ jobId, status: "submitted" }).lean();
    if (!job) {
      logClientError(HANDLER.verify, 404, "Job not found or not submitted", { jobId });
      return res.status(404).json({ error: "Job not found or not submitted" });
    }
    if (requireIssuerSignatureForVerify()) {
      if (!signature) {
        logSignatureFailure(HANDLER.verify, "Issuer signature required for verify (missing signature)", { jobId, issuer: job.issuer });
        return res.status(403).json({ error: "Issuer signature required for verify. Sign the message from the issuer wallet and send { signature }." });
      }
      const message = buildVerifyMessage(jobId, !!approved, !!reopen);
      const result = verifyIssuerSignature(message, signature, job.issuer);
      if (!result.ok) {
        logSignatureFailure(HANDLER.verify, result.error, { jobId, issuer: job.issuer });
        return res.status(403).json({ error: result.error });
      }
    }

    if (!approved) {
      const factory = getContractJobFactory();
      if (!factory) return res.status(503).json({ error: "Blockchain not configured" });
      if (reopen) {
        await (await factory.rejectAndReopen(jobId)).wait();
        await Job.updateOne(
          { jobId },
          { status: "open", completer: null, ipfsHash: null }
        );
        const wssReopen = req.app.locals.wss;
        if (wssReopen) broadcastJobReopened(wssReopen, jobId);
        return res.json({ jobId, status: "open", reopened: true });
      }
      await (await factory.setCompleted(jobId, false)).wait();
      const chainEscrow = job.bountyToken === "USDC" ? await getEscrowUSDCAddress() : await factory.escrow();
      if (chainEscrow) {
        const deposit = await getEscrowDeposit(jobId, chainEscrow);
        if (deposit > 0n) await (await factory.refundToIssuer(jobId)).wait();
      }
      await Job.updateOne({ jobId }, { status: "cancelled" });
      const wssReject = req.app.locals.wss;
      if (wssReject) broadcastJobCancelled(wssReject, jobId, "reject_refund");
      return res.json({ jobId, status: "cancelled", refunded: true });
    }

    const newStatus = "completed";
    await Job.updateOne({ jobId }, { status: newStatus });
    {
      const factory = getContractJobFactory();
      if (!factory) return res.status(503).json({ error: "Blockchain not configured" });
      if (!job.completer) return res.status(400).json({ error: "Job has no completer" });
      const chainEscrow = job.bountyToken === "USDC" ? await getEscrowUSDCAddress() : await factory.escrow();
      if (!chainEscrow) return res.status(503).json({ error: "Escrow not configured for this job token" });
      const escrowLinkedFactory = await getEscrowJobFactory(chainEscrow);
      const ourFactoryAddress = (process.env.JOB_FACTORY_ADDRESS || "").toLowerCase();
      if (escrowLinkedFactory && escrowLinkedFactory.toLowerCase() !== ourFactoryAddress) {
        return res.status(400).json({
          error: "Escrow.jobFactory() does not match JOB_FACTORY_ADDRESS — release() would revert with Unauthorized.",
          jobId,
          chainEscrow,
          escrowJobFactory: escrowLinkedFactory,
          envJobFactory: process.env.JOB_FACTORY_ADDRESS,
          fix: "Redeploy contracts (same deploy script) and set JOB_FACTORY_ADDRESS + ESCROW_ADDRESS from that deploy.",
        });
      }
      const depositAmount = await getEscrowDeposit(jobId, chainEscrow);
      if (!depositAmount || depositAmount === 0n) {
        return res.status(400).json({
          error: "No bounty escrowed for this job on-chain. Call POST /jobs/:jobId/escrow first (backend wallet must hold the bounty).",
          jobId,
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
          jobId,
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
        const wssSplit = req.app.locals.wss;
        if (wssSplit) broadcastJobCompleted(wssSplit, jobId);
        return res.json({ jobId, status: newStatus, txHash: receipt.hash, split: true });
      }

      const tx = await factory.completeAndRelease(jobId, job.completer, { gasLimit: 150000 });
      const receipt = await tx.wait();
      const reputation = getContractReputation();
      if (reputation) {
        try {
          await reputation.recordCompletion(job.completer, true);
        } catch (e) {
          console.error("Reputation.recordCompletion failed:", e.message);
        }
      }
      const wssComplete = req.app.locals.wss;
      if (wssComplete) broadcastJobCompleted(wssComplete, jobId);
      return res.json({ jobId, status: newStatus, txHash: receipt.hash });
    }
  } catch (err) {
    logError(HANDLER.verify, err, { jobId: req.params?.jobId });
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
    logError(HANDLER.getReputation, err, { address: req.params?.address });
    return res.status(500).json({ error: err.message || "Reputation fetch failed" });
  }
}
