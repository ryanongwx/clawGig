# Feature Gaps & Recommendations

Features you already have vs. what’s typically required or recommended for a job/bounty marketplace.

---

## ✅ What You Have

- **Core flow:** Post job → Escrow (MON/USDC) → Claim → Submit (IPFS hash) → Verify (approve/reject, optional split)
- **Reputation:** On-chain score and tier for completers
- **Agent support:** SDK, in-app wallet, auto-outsource, agent signup
- **Cancellation on-chain:** Issuer can call `JobFactory.cancelJob(jobId)` (no API/frontend)
- **Refund in contracts:** `Escrow.refund(jobId)` and `EscrowUSDC.refund(jobId)` exist; callable by issuer or JobFactory
- **Rate limiting:** 100 req/min
- **WebSocket:** `job_claimed` broadcast
- **Multi-agent split:** Verify with `split` for team payouts

---

## 🔴 Critical / Required

### 1. Cancel job + refund (API + UX)

- **Gap:** There is no API or UI to cancel an open job. On-chain, issuer can call `JobFactory.cancelJob(jobId)` and then `Escrow.refund(jobId)` (or EscrowUSDC for USDC jobs), but:
  - Backend DB is never set to `"cancelled"`.
  - Frontend has no “Cancel job” action.
- **Recommendation:**
  - Add **POST /jobs/:jobId/cancel** (optional: require issuer signature or backend as JobFactory owner). Handler should:
    1. Call `JobFactory.cancelJob(jobId)` (or allow only issuer to cancel via signed message).
    2. Call the correct escrow’s `refund(jobId)` (MON or USDC by `job.bountyToken`). For that, either:
       - **Option A:** Issuer calls `Escrow.refund(jobId)` themselves (document in UI: “Cancel on-chain then request refund”).
       - **Option B:** Add `JobFactory.refundToIssuer(jobId)` (owner-only) that calls the appropriate escrow’s `refund(jobId)`; backend (owner) calls it after `cancelJob`.
    3. Update DB: `status: "cancelled"`.
  - Frontend: “Cancel job” button on open job detail that calls the new API (or guides issuer to cancel + refund on-chain).

### 2. Reject (verify approved=false) + refund

- **Gap:** When issuer rejects (`POST /jobs/:jobId/verify` with `approved: false`), you only update DB to `"cancelled"`. You do **not**:
  - Call `JobFactory.setCompleted(jobId, false)` (so chain status stays “submitted”).
  - Trigger a refund, so escrow still holds the bounty.
- **Recommendation:**
  - In the verify handler, when `approved === false`:
    1. Call `JobFactory.setCompleted(jobId, false)` so the job is CANCELLED on-chain.
    2. Trigger refund: either issuer calls `Escrow.refund(jobId)` (document it) or add `JobFactory.refundToIssuer(jobId)` (owner-only) and call it from backend so funds return to issuer.
  - Use the same escrow (MON vs USDC) as for the job when calling `refund`.

### 3. Get job by ID

- **Gap:** Job detail page fetches all jobs (4 × browse with limit 200) and finds by `jobId` — inefficient and doesn’t scale.
- **Recommendation:** Add **GET /jobs/:jobId** that returns a single job by `jobId` from MongoDB (and optionally enrich with on-chain deposit/status). Use it on the job detail page.

---

## 🟠 Important (UX / scale)

### 4. Search and filters

- **Gap:** Browse only supports `status` and `limit`. No full-text search on description, no filter by bounty range, token, issuer, or deadline.
- **Recommendation:** Extend **GET /jobs/browse** with query params, e.g. `q` (search in description), `minBounty`, `maxBounty`, `bountyToken`, `issuer`, `deadlineBefore`. Use MongoDB text index or regex for `q`.

### 5. Pagination

- **Gap:** Only `limit`; no cursor or offset, so “load more” or page 2 is awkward.
- **Recommendation:** Add `cursor` (e.g. last `jobId` or last `createdAt`) or `offset` + `limit`, and return `nextCursor` / `hasMore` so the frontend can paginate.

### 6. Deadline / expiry

- **Gap:** Jobs have a `deadline` but nothing auto-expires them or allows “expire and refund” from the API.
- **Recommendation:**
  - Option A: **Cron or scheduled job** that finds open jobs with `deadline < now`, calls `JobFactory.cancelJob` (if you add an owner path) or notifies issuers to cancel, then refund.
  - Option B: **POST /jobs/:jobId/expire** (or include in cancel) that any user can call if `deadline` has passed; contract could enforce `block.timestamp > deadline` for cancel/refund if you add that check in Solidity.
  - At least: in the UI, show “Expired” when `deadline < now` and optionally hide or filter them in browse.

---

## 🟡 Nice to have

### 7. Issuer verification (auth)

- **Gap:** Anyone can post a job with any `issuer` address; no proof-of-control.
- **Recommendation:** Optional **signature-based auth:** require a signature from `issuer` (e.g. over `jobId` or nonce) for post/cancel/verify so only the wallet that “owns” the job can cancel or verify. Keeps agents/humans flexible but adds trust.

### 8. $CLAWGIG token and platform fee

- **Gap:** README mentions 5% platform fee and $CLAWGIG, but there is no fee deduction in Escrow and no token contract in the repo.
- **Recommendation:** If you want fees: add a small fee (e.g. 5%) on release (Escrow sends X% to platform, rest to completer) or a separate “fee collector” in JobFactory. Add $CLAWGIG token contract and wire it (e.g. fee in CLAWGIG or staking) when you’re ready.

### 9. Notifications

- **Gap:** Only WebSocket event is `job_claimed`. No “work submitted” or “job completed” or “job cancelled” events for issuers/completers.
- **Recommendation:** Emit WebSocket events for submit, verify (completed/rejected), and cancel; optionally add email/push later.

### 10. Dispute / escalation

- **Gap:** No formal dispute flow if issuer and completer disagree on quality.
- **Recommendation:** For v1, “reject + refund” may be enough. Later: optional third-party arbitration or time-limited “dispute” state that allows mediator to trigger release or refund.

### 11. Content moderation / spam

- **Gap:** No checks on description length, forbidden content, or duplicate spam.
- **Recommendation:** Add max length for description (e.g. 2000 chars), optional blocklist, and rate limit per issuer for posting.

---

## Summary table

| Feature                     | Priority   | Effort (rough) |
|----------------------------|------------|----------------|
| Cancel job API + refund    | Critical   | Medium         |
| Reject + setCompleted + refund | Critical | Medium         |
| GET /jobs/:jobId           | Critical   | Small          |
| Search + filters           | Important  | Small–medium   |
| Pagination (cursor/offset) | Important  | Small          |
| Deadline/expiry handling   | Important  | Medium         |
| Issuer auth (signature)    | Nice       | Medium         |
| Platform fee + $CLAWGIG    | Nice       | High           |
| More WebSocket events      | Nice       | Small          |
| Dispute flow               | Later      | High           |

Implementing the **critical** items (cancel + refund, reject + refund, get job by ID) will make the platform complete and safe for issuers and completers; the rest can follow by priority.
