import { Router } from "express";
import { postJob, escrowJob, claimJob, browseJobs, submitWork, verify } from "../handlers/jobs.js";

export const jobsRouter = Router();

jobsRouter.post("/post", postJob);
jobsRouter.get("/browse", browseJobs);
jobsRouter.post("/:jobId/escrow", escrowJob);
jobsRouter.post("/:jobId/claim", claimJob);
jobsRouter.post("/:jobId/submit", submitWork);
jobsRouter.post("/:jobId/verify", verify);
