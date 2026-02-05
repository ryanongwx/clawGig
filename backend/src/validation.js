/**
 * Input validation helpers. Use in handlers to reject invalid input early.
 */

const DESCRIPTION_MAX_LENGTH = Number(process.env.DESCRIPTION_MAX_LENGTH) || 50_000;
const AGENT_NAME_MAX_LENGTH = Number(process.env.AGENT_NAME_MAX_LENGTH) || 100;
const BOUNTY_MAX_WEI = BigInt(process.env.BOUNTY_MAX_WEI || "1000000000000000000000000"); // 1e24 default (1M tokens at 18 decimals)
const DEADLINE_MAX_DAYS_FROM_NOW = Number(process.env.DEADLINE_MAX_DAYS_FROM_NOW) || 365;
const SEARCH_QUERY_MAX_LENGTH = Number(process.env.SEARCH_QUERY_MAX_LENGTH) || 200;

/**
 * Parse jobId from req.params. Returns { ok: true, jobId } or { ok: false, status, error }.
 */
export function parseJobId(req) {
  const raw = req.params?.jobId;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: false, status: 400, error: "Missing job ID" };
  }
  const n = Number(raw);
  if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) {
    return { ok: false, status: 400, error: "Invalid job ID: must be a positive integer" };
  }
  return { ok: true, jobId: n };
}

/**
 * Validate description length. Returns null if valid, or error string.
 */
export function validateDescription(description) {
  if (typeof description !== "string") return "Description must be a string";
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`;
  }
  return null;
}

/**
 * Validate bounty (string or number). Returns null if valid, or error string.
 */
export function validateBounty(bounty) {
  if (bounty === undefined || bounty === null || bounty === "") return "Missing bounty";
  let value;
  try {
    value = BigInt(bounty);
  } catch {
    return "Invalid bounty: must be a number or numeric string";
  }
  if (value <= 0n) return "Bounty must be positive";
  if (value > BOUNTY_MAX_WEI) return `Bounty must be at most ${BOUNTY_MAX_WEI.toString()} wei`;
  return null;
}

/**
 * Validate deadline (Date, ISO string, or unix seconds). Returns null if valid, or error string.
 * Optionally allow past deadlines (e.g. for testing) via allowPast.
 */
export function validateDeadline(deadline, allowPast = false) {
  if (deadline === undefined || deadline === null) return "Missing deadline";
  let date;
  if (deadline instanceof Date) date = deadline;
  else if (typeof deadline === "number") date = new Date(deadline * 1000);
  else if (typeof deadline === "string") date = new Date(deadline);
  else return "Invalid deadline format";
  if (Number.isNaN(date.getTime())) return "Invalid deadline date";
  const now = new Date();
  if (!allowPast && date < now) return "Deadline must be in the future";
  const maxDate = new Date(now.getTime() + DEADLINE_MAX_DAYS_FROM_NOW * 24 * 60 * 60 * 1000);
  if (date > maxDate) return `Deadline must be within ${DEADLINE_MAX_DAYS_FROM_NOW} days`;
  return null;
}

/**
 * Validate agent name length. Returns null if valid, or error string.
 */
export function validateAgentName(name) {
  if (name === undefined || name === null) return null; // optional
  if (typeof name !== "string") return "Agent name must be a string";
  if (name.length > AGENT_NAME_MAX_LENGTH) {
    return `Agent name must be at most ${AGENT_NAME_MAX_LENGTH} characters`;
  }
  return null;
}

/**
 * Cap search query length to avoid ReDoS / heavy queries. Returns trimmed string or empty.
 */
export function capSearchQuery(q) {
  if (q == null || typeof q !== "string") return "";
  const s = q.trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
  return s;
}
