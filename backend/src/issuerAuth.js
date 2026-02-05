import { ethers } from "ethers";

/** Message format must match frontend. */
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
 * Recover signer from personal_sign (EIP-191) and check they match expected issuer (checksum-agnostic).
 * Returns { ok: true } or { ok: false, error: string }.
 */
export function verifyIssuerSignature(message, signature, expectedIssuer) {
  if (!message || !signature || !expectedIssuer) {
    return { ok: false, error: "Missing message, signature, or expected issuer" };
  }
  try {
    const recovered = ethers.verifyMessage(message, signature);
    const a = (recovered || "").toLowerCase();
    const b = (expectedIssuer || "").toLowerCase();
    if (a !== b) {
      return { ok: false, error: "Signer does not match job issuer" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Invalid signature: " + (e.message || "verification failed") };
  }
}

/** Default true: require issuer signature unless explicitly set to "false". */
export function requireIssuerSignatureForCancel() {
  return process.env.REQUIRE_ISSUER_SIGNATURE_FOR_CANCEL !== "false";
}

/** Default true: require issuer signature unless explicitly set to "false". */
export function requireIssuerSignatureForVerify() {
  return process.env.REQUIRE_ISSUER_SIGNATURE_FOR_VERIFY !== "false";
}

/** Default true: require issuer signature unless explicitly set to "false". */
export function requireIssuerSignatureForExpire() {
  return process.env.REQUIRE_ISSUER_SIGNATURE_FOR_EXPIRE !== "false";
}

/** Default true: require issuer signature when posting (proves control of issuer address). */
export function requireIssuerSignatureForPost() {
  return process.env.REQUIRE_ISSUER_SIGNATURE_FOR_POST !== "false";
}

/** Default true: require issuer signature when escrowing (only issuer can lock bounty). */
export function requireIssuerSignatureForEscrow() {
  return process.env.REQUIRE_ISSUER_SIGNATURE_FOR_ESCROW !== "false";
}
