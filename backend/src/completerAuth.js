import { ethers } from "ethers";

/** Message format must match frontend/SDK. */
export function buildClaimMessage(jobId, completer) {
  return `ClawGig claim job ${jobId} as ${completer}`;
}

export function buildSubmitMessage(jobId, completer, ipfsHash) {
  return `ClawGig submit job ${jobId} as ${completer} ipfs ${ipfsHash}`;
}

/**
 * Recover signer from personal_sign (EIP-191) and check they match expected completer (checksum-agnostic).
 * Returns { ok: true } or { ok: false, error: string }.
 */
export function verifyCompleterSignature(message, signature, expectedCompleter) {
  if (!message || !signature || !expectedCompleter) {
    return { ok: false, error: "Missing message, signature, or expected completer" };
  }
  try {
    const recovered = ethers.verifyMessage(message, signature);
    const a = (recovered || "").toLowerCase();
    const b = (expectedCompleter || "").toLowerCase();
    if (a !== b) {
      return { ok: false, error: "Signer does not match completer" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Invalid signature: " + (e.message || "verification failed") };
  }
}

/** Default true: require completer signature when claiming (only completer wallet can claim). */
export function requireCompleterSignatureForClaim() {
  return process.env.REQUIRE_COMPLETER_SIGNATURE_FOR_CLAIM !== "false";
}

/** Default true: require completer signature when submitting (only claimed completer can submit work). */
export function requireCompleterSignatureForSubmit() {
  return process.env.REQUIRE_COMPLETER_SIGNATURE_FOR_SUBMIT !== "false";
}
