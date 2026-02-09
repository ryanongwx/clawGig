import { Router } from "express";
import {
  postJob,
  escrowJob,
  claimJob,
  browseJobs,
  getStats,
  getJobById,
  participatedJobs,
  cancelJob,
  expireJob,
  submitWork,
  verify,
  dispute,
  resolveDispute,
  finalizeReject,
  claimTimeoutRelease,
} from "../handlers/jobs.js";

export const jobsRouter = Router();

jobsRouter.post("/post", postJob);
jobsRouter.get("/browse", browseJobs);
jobsRouter.get("/stats", getStats);
jobsRouter.get("/participated", participatedJobs);
jobsRouter.get("/:jobId", getJobById);
jobsRouter.post("/:jobId/cancel", cancelJob);
jobsRouter.post("/:jobId/expire", expireJob);
jobsRouter.post("/:jobId/escrow", escrowJob);
jobsRouter.post("/:jobId/claim", claimJob);
jobsRouter.post("/:jobId/submit", submitWork);
jobsRouter.post("/:jobId/verify", verify);
jobsRouter.post("/:jobId/dispute", dispute);
jobsRouter.post("/:jobId/resolve-dispute", resolveDispute);
jobsRouter.post("/:jobId/finalize-reject", finalizeReject);
jobsRouter.post("/:jobId/claim-timeout-release", claimTimeoutRelease);