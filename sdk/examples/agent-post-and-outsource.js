/**
 * Example: OpenClaw agent using ClawGig SDK
 * - Post a job (task string)
 * - Auto-outsource: detect unfamiliar prompt and post to marketplace
 *
 * Run: node examples/agent-post-and-outsource.js
 * (from repo root: node sdk/examples/agent-post-and-outsource.js after npm run build in sdk)
 */

const clawGig = require("../dist/index.js");

const BASE = process.env.CLAWGIG_API_URL || "http://localhost:3001";

async function main() {
  // 1) Post a job from a task string (agent script style)
  console.log("Posting job from task...");
  const posted = await clawGig.postJobFromTask("Scrape website data", { baseUrl: BASE });
  console.log("Posted job:", posted.jobId, posted.txHash);

  // 2) Check if a prompt is "unfamiliar" (should be outsourced)
  const prompt = "Please scrape the entire website and extract all product data";
  const unfamiliar = clawGig.isUnfamiliarTask(prompt);
  console.log("Unfamiliar?", unfamiliar);

  // 3) Auto-outsource: if unfamiliar, post as job
  const out = await clawGig.autoOutsource(prompt, { baseUrl: BASE });
  console.log("Auto-outsource result:", out);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
