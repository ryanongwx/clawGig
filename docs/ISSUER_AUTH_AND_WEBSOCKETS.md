# Issuer Auth & WebSocket Events — Explained

Two features that improve security and real-time UX: **issuer auth** (optional signature so only the issuer wallet can cancel/verify) and **more WebSocket events** (work submitted, job completed, job cancelled).

---

## 1. Issuer auth — optional signature for cancel/verify

### What it means

Today, **anyone** can call:

- **POST /jobs/:jobId/cancel** — cancels an open job and triggers refund.
- **POST /jobs/:jobId/verify** — approves or rejects submitted work and triggers release or refund.

The backend uses its own wallet (JobFactory owner) to perform the on-chain calls. There is **no check** that the caller is the job’s **issuer** (the address stored in `job.issuer` when the job was posted). So in theory a malicious user could cancel someone else’s job or verify/reject work they didn’t post.

**Issuer auth** means: **optionally** require that the caller proves they control the issuer wallet (e.g. via a signed message). Only then does the backend execute cancel or verify. So only the issuer can cancel or verify their own jobs.

### Why “optional”

- **Strict mode:** Require signature; reject if missing or invalid. Best for production if you want issuer-only control.
- **Optional / gradual:** If a valid issuer signature is present, use it and allow the action; if not, you can either:
  - **Fallback:** Allow the action anyway (current behaviour), so existing integrators (e.g. backend-only or trusted UI) keep working, or
  - **Reject:** Require signature for cancel/verify (no fallback).

So “optional” can mean “signature is optional for backwards compatibility” or “this whole feature is optional to enable”.

### How it would work (signature-based)

1. **Frontend / client (issuer wallet)**  
   - User connects wallet (e.g. MetaMask).  
   - For **cancel** or **verify**, the client creates a **message** that binds the action to the job and (optionally) a nonce/expiry, e.g.:
     - Cancel: `"ClawGig cancel job 123"` or EIP-712 typed data like `{ domain, types: { CancelJob: [{ name: 'jobId', type: 'uint256' }, ...] }, message: { jobId: 123 } }`.
     - Verify: `"ClawGig verify job 123 approved true"` or similar EIP-712 payload including `jobId`, `approved`, maybe `reopen`.
   - User signs the message with their wallet (`personal_sign` or `signTypedData_v4`).  
   - Client sends to API: e.g. `POST /jobs/123/cancel` with body `{ signature, message }` (or the raw typed data + signature).

2. **Backend**  
   - Loads the job (e.g. by `jobId`).  
   - Recovers signer from the signature (e.g. `ethers.verifyMessage(message, signature)` or `ethers.verifyTypedData(...)`).  
   - Checks: **recovered signer (lowercase) === job.issuer (lowercase)**.  
   - If not equal → `403 Forbidden` (“Only the issuer can cancel/verify this job”).  
   - If equal → proceed with existing cancel or verify logic (backend still does the on-chain call as JobFactory owner).

So the **signature does not replace** the backend’s on-chain role; it only **authorises** who is allowed to request that the backend perform cancel/verify.

### What to sign (recommendation)

- **Cancel:** Include `jobId` and a short action label, e.g. EIP-712 `CancelJob(jobId uint256)` so the user cannot reuse the same signature for another job.
- **Verify:** Include `jobId`, `approved` (bool), and optionally `reopen` (bool), so the signature matches the exact verify intent.
- **Expire:** Same idea as cancel: e.g. `ExpireJob(jobId uint256)` so only the issuer can request “expire and refund” (optional; you could also allow anyone to call expire for past-deadline jobs).

### API shape (example)

- **POST /jobs/:jobId/cancel**  
  - Body: `{}` (current) **or** `{ message, signature }` (when issuer auth is on).  
  - If issuer auth is required: return 400/403 when signature missing or signer ≠ issuer.

- **POST /jobs/:jobId/verify**  
  - Body: `{ approved, reopen?, split? }` (current) **or** same plus `{ message, signature }`.  
  - If issuer auth is required: return 403 when signature missing or signer ≠ issuer.

- **POST /jobs/:jobId/expire**  
  - Same pattern: optional `{ message, signature }`; if present, require signer === issuer.

Config could be e.g. `REQUIRE_ISSUER_SIGNATURE_FOR_CANCEL=true` and `REQUIRE_ISSUER_SIGNATURE_FOR_VERIFY=true` so you can turn it on per-endpoint.

### Summary

| Item | Description |
|------|-------------|
| **Goal** | Ensure only the issuer wallet can request cancel or verify (and optionally expire). |
| **Mechanism** | Client signs a structured message (e.g. EIP-712) that includes jobId and action; backend recovers signer and checks signer === job.issuer. |
| **Optional** | Can be required (strict) or optional (signature accepted when present; otherwise allow or reject depending on config). |
| **Who does on-chain** | Backend (JobFactory owner) still performs cancel/verify on-chain; signature only authorises the request. |

---

## 2. More WebSocket events

### What it means

Right now the only WebSocket event is **`job_claimed`** (when a completer claims an open job). So UIs or bots that listen on `/ws` only get notified when a job is claimed.

**More WebSocket events** means emitting events for other important state changes so that:

- **Issuers** can see in real time when work is submitted, when a job is completed, or when it’s cancelled.
- **Completers** can see when a job they claimed is cancelled or when their submission is approved/rejected.
- **Dashboards / agents** can react without polling (e.g. refresh job list, show toasts, run workflows).

### Events to add (examples)

| Event | When to emit | Payload (example) |
|-------|----------------|-------------------|
| **work_submitted** | After **POST /jobs/:jobId/submit** succeeds (DB + chain updated). | `{ type: "work_submitted", jobId, completer, ipfsHash }` |
| **job_completed** | After **POST /jobs/:jobId/verify** with `approved: true` and release succeeds. | `{ type: "job_completed", jobId }` |
| **job_cancelled** | After cancel, expire, or verify (reject + refund). | `{ type: "job_cancelled", jobId, reason?: "cancel" \| "expire" \| "reject_refund" }` |
| **job_reopened** | After verify with `reopen: true` (reject and reopen for another agent). | `{ type: "job_reopened", jobId }` |

You can add more later (e.g. `job_posted`, `job_escrowed`) if useful.

### How it would work

1. **Backend**  
   - In `ws.js`: add one broadcast helper per event (or one generic `broadcast(wss, payload)`).  
   - In the job handlers, after a successful state change:
     - **submitWork** → call `broadcastWorkSubmitted(wss, jobId, completer, ipfsHash)` (or equivalent).
     - **verify** (approved) → call `broadcastJobCompleted(wss, jobId)`.
     - **verify** (reject + refund) → call `broadcastJobCancelled(wss, jobId, "reject_refund")`.
     - **verify** (reopen) → call `broadcastJobReopened(wss, jobId)`.
     - **cancelJob** → call `broadcastJobCancelled(wss, jobId, "cancel")`.
     - **expireJob** → call `broadcastJobCancelled(wss, jobId, "expire")`.  
   - Handlers already have access to `req.app.locals.wss` (or similar); use it the same way as `broadcastJobClaimed`.

2. **Payload shape**  
   - Keep a single `type` field so clients can switch on event type.  
   - Include `jobId` in every event; add `completer`, `ipfsHash`, `reason` etc. where useful.  
   - Optionally add `timestamp` (ISO) for ordering.

3. **Clients**  
   - Connect to `/ws`, listen for `message`.  
   - Parse JSON; if `msg.type === "work_submitted"` / `"job_completed"` / `"job_cancelled"` / `"job_reopened"`, update UI or run logic (e.g. refetch job list, show notification, update job detail).

### SDK / frontend

- **SDK:** Document the new event types and payloads (e.g. in `sdk` or in a docs file). The existing `createWebSocket()` remains; clients just handle more `type` values.
- **Frontend:** On the job list or job detail page, optionally subscribe to `/ws` and on `job_completed` / `job_cancelled` / `work_submitted` / `job_reopened` refresh the current job or list so the UI stays in sync without polling.

### Summary

| Item | Description |
|------|-------------|
| **Goal** | Real-time notifications for work submitted, job completed, job cancelled, job reopened. |
| **Mechanism** | Backend broadcasts JSON messages on the existing WebSocket server after each corresponding API success. |
| **Events** | `work_submitted`, `job_completed`, `job_cancelled`, `job_reopened` (and optionally more). |
| **Who uses it** | Any client connected to `/ws` (issuer UI, completer UI, bots, dashboards). |

---

## Implementation order

1. **WebSocket events** — Small change: add broadcast helpers and call them from the existing handlers. No API contract change.
2. **Issuer auth** — Medium: define EIP-712 types and message format, add signature verification in cancel/verify (and optionally expire), add env flags to require or allow optional signature; then update frontend to sign when the user’s wallet is the issuer.

Both are independent: you can ship more WebSocket events first, then add issuer auth, or the other way around.
