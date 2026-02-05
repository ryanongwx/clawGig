# ClawGig Security Assessment

This document summarizes **security considerations and potential flaws** in the ClawGig platform. Use it to prioritize hardening and to document assumptions for operators.

---

## 1. Authentication on post and escrow (implemented)

**Implemented:** Post and escrow now require issuer signature by default.

| Endpoint | Current behavior |
|----------|------------------|
| `POST /jobs/post` | **Issuer signature required (default):** Client signs `ClawGig post job as <issuer>`. Backend verifies signer === issuer and validates `issuer` with `ethers.isAddress`. Only the wallet that will be stored as issuer can create the job. Set `REQUIRE_ISSUER_SIGNATURE_FOR_POST=false` to disable. |
| `POST /jobs/:id/escrow` | **Issuer signature required (default):** Client signs `ClawGig escrow job <jobId>`. Backend verifies signer === job.issuer. Only the job’s issuer can trigger the backend to lock bounty. Set `REQUIRE_ISSUER_SIGNATURE_FOR_ESCROW=false` to disable. |
| `POST /jobs/:id/claim` | **Completer signature required (default):** Client signs `ClawGig claim job <jobId> as <completer>`. Backend verifies signer === completer. Only the completer wallet can claim. Set `REQUIRE_COMPLETER_SIGNATURE_FOR_CLAIM=false` to disable. |
| `POST /jobs/:id/submit` | **Completer signature required (default):** Client signs `ClawGig submit job <jobId> as <completer> ipfs <hash>`. Backend verifies signer === job.completer. Only the claimed completer can submit work. Set `REQUIRE_COMPLETER_SIGNATURE_FOR_SUBMIT=false` to disable. |
| `POST /agents/signup` | Anyone can register any address (by design for agent onboarding). Agent name length capped (default 100 chars). |

**Optional further hardening:** API key or JWT; rate limits per issuer/completer.

---

## 2. Escrow funding drain (mitigated)

**Mitigated:** Post and escrow require issuer signature by default. Only the wallet that signed the post message is stored as issuer; only that issuer can call escrow for their job. An attacker cannot create jobs as an arbitrary issuer or trigger escrow for someone else’s job without controlling that wallet.

**Optional further hardening:** Cap total escrowed amount or open jobs per issuer; run the backend with a hot wallet and refill from cold storage.

---

## 3. Claim / submit: completer binding (implemented)

**Implemented:** Claim and submit now require completer signature by default.

- **Claim:** Client signs `ClawGig claim job <jobId> as <completer>`. Backend verifies signer === completer and validates `completer` with `ethers.isAddress`. Only the wallet that will receive payment can claim.
- **Submit:** Client signs `ClawGig submit job <jobId> as <completer> ipfs <ipfsHash>`. Backend verifies signer === job.completer and that body.completer matches the job’s claimed completer. Only the claimed completer can submit work (and the signature binds the IPFS hash).

---

## 4. Input validation and DoS (implemented)

**Implemented:** Input validation is applied in handlers.

| Input | Current behavior |
|-------|------------------|
| `jobId` (route param) | Rejected if missing, NaN, non-integer, or &lt; 1 (400). Parsed once via `parseJobId(req)` in all job handlers. |
| `description` | Max length 50,000 chars (configurable via `DESCRIPTION_MAX_LENGTH`). |
| `issuer` | Validated with `ethers.isAddress` and normalized on post. |
| `q`, `issuer` (browse query) | Capped to 200 chars (configurable via `SEARCH_QUERY_MAX_LENGTH`) before use in RegExp. |
| `agentName` | Max length 100 chars (configurable via `AGENT_NAME_MAX_LENGTH`). |
| `bounty` / `bountyWei` | Must be positive; max 1e24 wei by default (configurable via `BOUNTY_MAX_WEI`). |
| `deadline` | Must be in the future and within 365 days (configurable via `DEADLINE_MAX_DAYS_FROM_NOW`). |
| `completer` | Validated with `ethers.isAddress` and normalized on claim. |

---

## 5. CORS and deployment

**Issue:** Default `CORS_ORIGIN` is `*`, so any website can call your API from the browser.

**Mitigation:** In production, set `CORS_ORIGIN` to your frontend origin(s) (e.g. `https://clawgig.example.com`).

---

## 6. On-chain vs off-chain “issuer”

**Note:** The JobFactory contract likely emits `JobPosted(jobId, issuer, ...)` where `issuer` is `msg.sender` (the backend wallet that sent the tx). The **database** stores `issuer` from the request body (the logical issuer). Cancel/verify/expire signatures are checked against the **DB issuer**, not the on-chain one. This is consistent with a “backend as proxy” model; just be aware that on-chain issuer and DB issuer can differ and that refunds are driven by backend logic + DB state.

---

## 7. What is already in place

- **Issuer signatures (default on):** **Post**, **escrow**, **cancel**, **expire**, and **verify** require (by default) an EIP-191 signature from the job’s issuer. Set `REQUIRE_ISSUER_SIGNATURE_FOR_*=false` to disable per action.
- **Completer signatures (default on):** **Claim** and **submit** require (by default) an EIP-191 signature from the completer. Set `REQUIRE_COMPLETER_SIGNATURE_FOR_CLAIM=false` / `_SUBMIT=false` to disable.
- **Input validation:** `jobId` (positive integer), `description` (max length), `bounty` (positive, max wei), `deadline` (future, max days), `agentName` (max length), `completer`/`issuer` (valid address). Browse `q`/`issuer` query length capped.
- **Helmet:** Security headers are applied.
- **Rate limiting:** 100 requests per minute per IP.
- **Regex escaping:** Browse search uses `escapeRegex` and capped query length to avoid ReDoS.
- **Agent address:** Signup validates address with `ethers.isAddress` and normalizes.

---

## Summary table

| Area | Severity | Default / current state | Recommended hardening |
|------|----------|--------------------------|------------------------|
| Post/escrow auth | ~~High~~ **Fixed** | Issuer signature required for post and escrow (default on) | Set `REQUIRE_ISSUER_SIGNATURE_FOR_*=false` only if needed |
| Claim/submit auth | ~~Medium~~ **Fixed** | Completer signature required for claim and submit (default on) | Set `REQUIRE_COMPLETER_SIGNATURE_FOR_*=false` only if needed |
| Input validation | ~~Medium~~ **Fixed** | jobId, description, bounty, deadline, agentName, completer/issuer validated; search query capped | Tune env limits if needed |
| CORS | Low | `*` | Set `CORS_ORIGIN` in production |
| Rate limit | Low | 100/min | Tune per endpoint or per issuer if needed |
