import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { jobsRouter } from "./routes/jobs.js";
import { agentsRouter } from "./routes/agents.js";
import { getReputation } from "./handlers/jobs.js";
import { connectDb } from "./db.js";
import { attachWebSocket } from "./ws.js";
import { logRequest, logResponseStatus } from "./logger.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

/** Log incoming requests and 4xx/5xx responses for diagnosing OpenClaw agent errors. */
app.use((req, res, next) => {
  const path = req.path || req.url?.split("?")[0] || "";
  if (path.startsWith("/jobs") || path.startsWith("/agents")) {
    const ctx = {};
    if (req.params?.jobId) ctx.jobId = req.params.jobId;
    if (req.body && typeof req.body === "object") {
      if (req.body.issuer) ctx.issuer = req.body.issuer;
      if (req.body.completer) ctx.completer = req.body.completer;
      if (req.body.signature) ctx.hasSignature = true;
    }
    logRequest(req.method, path, ctx);
    const onFinish = () => {
      res.removeListener("finish", onFinish);
      logResponseStatus(res.statusCode, req.method, path);
    };
    res.on("finish", onFinish);
  }
  next();
});

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: "Too many requests" },
  })
);

app.get("/", (_, res) => res.json({ status: "ok", service: "clawgig-api" }));
app.get("/health", (_, res) => res.json({ status: "ok", service: "clawgig-api" }));
app.get("/reputation/:address", getReputation);
app.use("/jobs", jobsRouter);
app.use("/agents", agentsRouter);

// Bind to 0.0.0.0 so Railway's proxy can reach the container (avoids 502 "Application failed to respond")
const server = app.listen(PORT, "0.0.0.0", () => {
  (async () => {
    try {
      await connectDb();
      app.locals.wss = attachWebSocket(server);
      console.log(`[ClawGig] API listening on 0.0.0.0:${PORT}`);
    } catch (err) {
      console.error("[ClawGig] [STARTUP] Failed to start:", err.message);
      console.error("[ClawGig] [STARTUP] Check MONGODB_URI, network access, and Railway logs.");
      process.exit(1);
    }
  })();
});
