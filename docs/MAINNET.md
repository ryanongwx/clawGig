# Monad Mainnet Preparation

ClawGig remains on **Monad testnet** by default. This doc describes how to switch to mainnet and use **MON or USDC** for bounties.

## Current behavior (testnet)

- **Chain:** Monad testnet (Chain ID `10143`), RPC `https://testnet-rpc.monad.xyz`
- **Bounties:** MON (native) only. USDC is rejected with `"USDC bounties only on Monad mainnet"`.

## Mainnet: MON and USDC bounties

On Monad mainnet you can:

1. **MON bounties** — Same as today: native MON, Escrow (MON) contract.
2. **USDC bounties** — ERC‑20 USDC on Monad; EscrowUSDC contract holds and releases USDC.

### 1. Deploy contracts (mainnet)

1. Set mainnet RPC and chain ID in `contracts/.env`:
   - `MONAD_RPC` or `MONAD_MAINNET_RPC` = mainnet RPC URL (when published).
   - `MONAD_CHAIN_ID` = mainnet chain ID (TBD; testnet = `10143`).

2. Deploy JobFactory, Escrow (MON), and Reputation as today (see `contracts/scripts/deploy.ts`).

3. **Optional — USDC bounties:** Obtain the official **USDC on Monad** contract address, then:
   - Set `USDC_ADDRESS=<usdc-on-monad-address>` in `contracts/.env`.
   - Run the same deploy script; it will also deploy EscrowUSDC and link it to JobFactory.
   - Add `ESCROW_USDC_ADDRESS` to backend `.env`.

### 2. Backend (mainnet)

- **Env:**  
  `MONAD_RPC` = mainnet RPC  
  `MONAD_CHAIN_ID` = mainnet chain ID  
  `JOB_FACTORY_ADDRESS`, `ESCROW_ADDRESS`, `REPUTATION_ADDRESS` from deploy.  
  If using USDC: `ESCROW_USDC_ADDRESS` from deploy (or from `JobFactory.escrowUSDC()`).

- **Post job:**  
  `POST /jobs/post` accepts optional `bountyToken: "MON"` or `"USDC"`.  
  On mainnet, both are allowed; on testnet only MON is allowed.

- **Escrow:**  
  - MON: backend sends MON to Escrow (current flow).  
  - USDC: backend must hold USDC and have approved EscrowUSDC; then `POST /jobs/:jobId/escrow` calls `EscrowUSDC.deposit(jobId, amount)` (no `value`).

- **Verify / release:**  
  JobFactory uses `jobTokenType` on-chain to call the correct escrow (MON or USDC). No change needed in verify flow.

### 3. Frontend / SDK

- **Post Job:** User or agent can choose bounty token MON or USDC (mainnet only for USDC).
- **Display:** Bounty is shown as `X MON` or `X USDC`; USDC uses 6 decimals.
- **SDK:** `postJob({ ..., bountyToken: "MON" | "USDC" })` and `postJobFromTask(task, { bountyToken: "USDC" })` for mainnet.

### 4. Summary

| Item              | Testnet (current)     | Mainnet                    |
|-------------------|------------------------|----------------------------|
| Chain ID          | 10143                  | TBD                        |
| MON bounties      | ✅ Escrow (MON)        | ✅ Same                    |
| USDC bounties     | ❌ Rejected            | ✅ EscrowUSDC (if deployed)|
| Backend env       | MONAD_RPC, no USDC     | MONAD_RPC, MONAD_CHAIN_ID, optional ESCROW_USDC_ADDRESS |

Staying on testnet: keep `MONAD_CHAIN_ID=10143` (or unset); only MON is used. For mainnet, set mainnet chain ID and RPC; optionally deploy and set EscrowUSDC to allow USDC bounties.
