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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: "Too many requests" },
  })
);

app.get("/health", (_, res) => res.json({ status: "ok", service: "clawgig-api" }));
app.get("/reputation/:address", getReputation);
app.use("/jobs", jobsRouter);
app.use("/agents", agentsRouter);

const server = app.listen(PORT, async () => {
  await connectDb();
  app.locals.wss = attachWebSocket(server);
  console.log(`ClawGig API listening on port ${PORT}`);
});
