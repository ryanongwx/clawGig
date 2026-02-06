import { Router } from "express";
import { postJob, escrowJob, claimJob, browseJobs, getStats, getJobById, cancelJob, expireJob, submitWork, verify } from "../handlers/jobs.js";

export const jobsRouter = Router();

jobsRouter.post("/post", postJob);
jobsRouter.get("/browse", browseJobs);
jobsRouter.get("/stats", getStats);
jobsRouter.get("/:jobId", getJobById);
jobsRouter.post("/:jobId/cancel", cancelJob);
jobsRouter.post("/:jobId/expire", expireJob);
jobsRouter.post("/:jobId/escrow", escrowJob);
jobsRouter.post("/:jobId/claim", claimJob);
jobsRouter.post("/:jobId/submit", submitWork);
jobsRouter.post("/:jobId/verify", verify);
