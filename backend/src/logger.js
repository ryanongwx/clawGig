/**
 * Structured logging for ClawGig API. Use for diagnosing OpenClaw agent and client errors.
 * All lines are prefixed with [ClawGig] and a tag so you can grep: [ClawGig] [ERROR]
 */

const PREFIX = "[ClawGig]";

function formatContext(ctx) {
  if (!ctx || typeof ctx !== "object") return "";
  const parts = Object.entries(ctx)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${String(v).slice(0, 50)}`);
  return parts.length ? " " + parts.join(" ") : "";
}

/**
 * Log an incoming request (method, path, and safe context like jobId, issuer suffix).
 * Call from middleware; do not log full signatures or long bodies.
 */
export function logRequest(method, path, context = {}) {
  const safe = { ...context };
  if (safe.issuer && typeof safe.issuer === "string" && safe.issuer.length > 10) {
    safe.issuer = safe.issuer.slice(0, 6) + "..." + safe.issuer.slice(-4);
  }
  if (safe.completer && typeof safe.completer === "string" && safe.completer.length > 10) {
    safe.completer = safe.completer.slice(0, 6) + "..." + safe.completer.slice(-4);
  }
  const ctx = formatContext(safe);
  console.log(`${PREFIX} [REQUEST] ${method} ${path}${ctx}`);
}

/**
 * Log a validation error (4xx due to missing/invalid input). Makes it clear what failed.
 */
export function logValidation(handler, message, context = {}) {
  const ctx = formatContext(context);
  console.warn(`${PREFIX} [VALIDATION] ${handler}: ${message}${ctx}`);
}

/**
 * Log a signature verification failure (403). Shows which check failed (issuer/completer) and why.
 */
export function logSignatureFailure(handler, message, context = {}) {
  const ctx = formatContext(context);
  console.warn(`${PREFIX} [SIGNATURE] ${handler}: ${message}${ctx}`);
}

/**
 * Log a not-found or business-rule error (404, 409, etc.) for easier diagnosis.
 */
export function logClientError(handler, status, message, context = {}) {
  const ctx = formatContext(context);
  console.warn(`${PREFIX} [CLIENT] ${handler} ${status}: ${message}${ctx}`);
}

/**
 * Log an unexpected server/contract error (5xx). Include handler name and context for debugging.
 */
export function logError(handler, err, context = {}) {
  const ctx = formatContext(context);
  const msg = err?.message || String(err);
  console.error(`${PREFIX} [ERROR] ${handler}: ${msg}${ctx}`);
  if (err?.stack && process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }
}

/**
 * Log response status for 4xx/5xx so you can correlate request -> response when diagnosing OpenClaw agent errors.
 */
export function logResponseStatus(status, method, path) {
  if (status >= 400) {
    const tag = status >= 500 ? "ERROR" : "CLIENT";
    console.warn(`${PREFIX} [RESPONSE] ${status} ${method} ${path}`);
  }
}
