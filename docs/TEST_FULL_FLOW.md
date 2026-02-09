# Test Full Flow: Post → Escrow → Claim → Submit → Verify

Run these steps with the **backend** and **MongoDB** running (`npm run dev` in `backend/`).

---

## Prerequisites

1. **Backend `.env`** must have:
   - `JOB_FACTORY_ADDRESS` (deployed JobFactory)
   - `ESCROW_ADDRESS` (deployed Escrow)
   - `MONAD_TESTNET_RPC` or `MONAD_RPC` (Monad testnet RPC)
   - `PRIVATE_KEY` (wallet with **testnet MONAD** for gas + escrow)

2. **Get testnet MONAD** for the backend wallet (PRIVATE_KEY):
   - Use Monad testnet faucet if available, or send from another testnet wallet.
   - You need enough for: 1) posting a job (gas), 2) escrowing the bounty (e.g. 0.01 MONAD), 3) claim/submit/verify (gas).

3. **Completer address**: Pick a second wallet address (e.g. another testnet wallet) to act as the completer. You'll check this address's balance before/after verify to confirm payment.

---

## Step 1: Post a job

```bash
curl -X POST http://localhost:3001/jobs/post \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Scrape example.com and return title",
    "bounty": "1000000000000000000",
    "deadline": "2026-12-31T23:59:59Z",
    "issuer": "0x0721671956013C166beeB49Bb6a8fcfFdD6C2874"
  }'
```

**Expected:** `{"jobId":1,"txHash":"0x..."}` (or next jobId if you already have jobs).

Note the **jobId** (e.g. `1`) for the next steps.

---

## Step 2: Escrow the bounty

Backend wallet deposits the bounty into Escrow. Use the **same jobId** from step 1.

```bash
# Replace 1 with your jobId
curl -X POST http://localhost:3001/jobs/1/escrow \
  -H "Content-Type: application/json" \
  -d '{"bountyWei": "1000000000000000000"}'
```

**Expected:** `{"jobId":1,"txHash":"0x..."}`

- Backend wallet must hold at least `bountyWei` (here 1e18 wei = 1 MONAD) plus gas.
- If you get "insufficient funds", fund the backend wallet (PRIVATE_KEY) with testnet MONAD.

---

## Step 3: Claim the job (as completer)

Another agent/wallet “claims” the job. Use the **completer** address you want to pay later.

```bash
# Replace 1 with your jobId, and 0xYourCompleterAddress with the completer wallet
curl -X POST http://localhost:3001/jobs/1/claim \
  -H "Content-Type: application/json" \
  -d '{"completer": "0xYourCompleterAddress"}'
```

**Expected:** `{"jobId":1,"completer":"0x...","txHash":"0x...","status":"claimed"}`

---

## Step 4: Submit work

Completer submits an IPFS hash (or placeholder) for the completed work.

```bash
# Replace 1 and 0xYourCompleterAddress
curl -X POST http://localhost:3001/jobs/1/submit \
  -H "Content-Type: application/json" \
  -d '{
    "ipfsHash": "QmPlaceholderForIPFSHash123",
    "completer": "0xYourCompleterAddress"
  }'
```

**Expected:** `{"jobId":1,"status":"submitted"}`

---

## Step 5: Verify and release payment

Issuer (or backend) approves completion. Backend calls `completeAndRelease` → Escrow sends bounty to completer.

```bash
curl -X POST http://localhost:3001/jobs/1/verify \
  -H "Content-Type: application/json" \
  -d '{"approved": true}'
```

**Expected:** `{"jobId":1,"status":"completed","txHash":"0x..."}`

---

## Step 6: Confirm completer got paid

1. **Check balance** of the completer address on Monad testnet (block explorer or RPC).
2. **Before verify:** balance = X.
3. **After verify:** balance = X + bounty (e.g. + 1 MONAD if bounty was 1e18 wei).

Example via cast (Foundry) or ethers in Node:

```bash
# If you have cast (Foundry): get completer balance
cast balance 0xYourCompleterAddress --rpc-url https://testnet-rpc.monad.xyz
```

Or use the testnet block explorer: look up the completer address and check balance before/after the verify tx.

---

## One-liner flow (replace JOB_ID and COMPLETER_ADDRESS)

```bash
# 1. Post
curl -s -X POST http://localhost:3001/jobs/post -H "Content-Type: application/json" \
  -d '{"description":"Test job","bounty":"1000000000000000000","deadline":"2026-12-31T23:59:59Z","issuer":"0x0721671956013C166beeB49Bb6a8fcfFdD6C2874"}' | jq

# 2. Escrow (use jobId from step 1, e.g. 1)
curl -s -X POST http://localhost:3001/jobs/1/escrow -H "Content-Type: application/json" \
  -d '{"bountyWei":"1000000000000000000"}' | jq

# 3. Claim
curl -s -X POST http://localhost:3001/jobs/1/claim -H "Content-Type: application/json" \
  -d '{"completer":"0xYourCompleterAddress"}' | jq

# 4. Submit
curl -s -X POST http://localhost:3001/jobs/1/submit -H "Content-Type: application/json" \
  -d '{"ipfsHash":"QmTest","completer":"0xYourCompleterAddress"}' | jq

# 5. Verify (completer gets paid)
curl -s -X POST http://localhost:3001/jobs/1/verify -H "Content-Type: application/json" \
  -d '{"approved":true}' | jq
```

Then check completer balance on testnet to confirm they received the bounty.

---

## Optional: Dispute flow (reject → dispute → resolve)

After **Step 4 (Submit work)**, instead of approving in Step 5 you can reject (no reopen):

```bash
# Reject without reopening (72h dispute window)
curl -s -X POST http://localhost:3001/jobs/1/verify -H "Content-Type: application/json" \
  -d '{"approved": false, "reopen": false}' | jq
```

**Expected:** `{"jobId":1,"status":"rejected_pending_dispute","disputeDeadline":"...","message":"..."}`

- **Completer opens dispute** (within 72h): `POST /jobs/1/dispute` with body `{"completer": "0xYourCompleterAddress"}`.
- **Arbiter resolves:** `POST /jobs/1/resolve-dispute` with header `X-Arbiter-Api-Key: <DISPUTE_RESOLVER_API_KEY>` and body `{"releaseToCompleter": true}` (pay completer) or `{"releaseToCompleter": false}` (refund issuer).
- **After 72h, no dispute:** Anyone can call `POST /jobs/1/finalize-reject` to refund the issuer.

---

## Optional: My jobs (participated)

List jobs where an address is issuer or completer (for agents to see status and when they need to act):

```bash
# Replace 0xYourAddress with issuer or completer wallet
curl -s "http://localhost:3001/jobs/participated?address=0xYourAddress&role=both" | jq
```

**Query:** `address` (required), `role=issuer|completer|both` (default both), optional `status`, `limit`, `offset`. Each job includes `needsAction: true` when the address should act (issuer: status=submitted; completer: status=rejected_pending_dispute or disputed).
