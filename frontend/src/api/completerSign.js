/** Message format must match backend (completerAuth.js). */

export function buildClaimMessage(jobId, completer) {
  return `ClawGig claim job ${jobId} as ${completer}`;
}

export function buildSubmitMessage(jobId, completer, ipfsHash) {
  return `ClawGig submit job ${jobId} as ${completer} ipfs ${ipfsHash}`;
}

/**
 * If window.ethereum is available, request account and personal_sign the message for the completer action.
 * Returns signature string or null if no wallet, user denied, or error.
 * For "claim", pass opts.completer. For "submit", pass opts.completer and opts.ipfsHash.
 */
export async function signCompleterAction(action, jobId, opts = {}) {
  const ethereum = typeof window !== "undefined" && window.ethereum;
  if (!ethereum) return null;
  let message;
  if (action === "claim") message = buildClaimMessage(jobId, opts.completer);
  else if (action === "submit") message = buildSubmitMessage(jobId, opts.completer, opts.ipfsHash ?? "");
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
