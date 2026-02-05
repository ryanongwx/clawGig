/** Message format must match backend (issuerAuth.js). */

export function buildPostMessage(issuer) {
  return `ClawGig post job as ${issuer}`;
}

export function buildEscrowMessage(jobId) {
  return `ClawGig escrow job ${jobId}`;
}

export function buildCancelMessage(jobId) {
  return `ClawGig cancel job ${jobId}`;
}

export function buildExpireMessage(jobId) {
  return `ClawGig expire job ${jobId}`;
}

export function buildVerifyMessage(jobId, approved, reopen) {
  return `ClawGig verify job ${jobId} approved ${!!approved} reopen ${!!reopen}`;
}

/**
 * If window.ethereum is available, request account and personal_sign the message for the given action.
 * Returns signature string or null if no wallet, user denied, or error.
 * For "post", pass opts.issuer (address). For "escrow", pass jobId.
 */
export async function signIssuerAction(action, jobId, opts = {}) {
  const ethereum = typeof window !== "undefined" && window.ethereum;
  if (!ethereum) return null;
  let message;
  if (action === "post") message = buildPostMessage(opts.issuer);
  else if (action === "escrow") message = buildEscrowMessage(jobId);
  else if (action === "cancel") message = buildCancelMessage(jobId);
  else if (action === "expire") message = buildExpireMessage(jobId);
  else if (action === "verify") message = buildVerifyMessage(jobId, !!opts.approved, !!opts.reopen);
  else return null;
  try {
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    const account = accounts?.[0];
    if (!account) return null;
    const hexMessage =
      "0x" +
      Array.from(new TextEncoder().encode(message))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const signature = await ethereum.request({
      method: "personal_sign",
      params: [hexMessage, account],
    });
    return signature ?? null;
  } catch (_) {
    return null;
  }
}
