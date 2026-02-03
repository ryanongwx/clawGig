#!/usr/bin/env bash
# Test full flow: post → escrow → claim → submit → verify
# Usage: ./scripts/test-full-flow.sh [base_url] [completer_address]
# Example: ./scripts/test-full-flow.sh http://localhost:3001 0x1234...abcd

set -e
BASE_URL="${1:-http://localhost:3001}"
COMPLETER="${2:-}"
ISSUER="0x0721671956013C166beeB49Bb6a8fcfFdD6C2874"
# Use 0.001 MONAD (1e15) so faucet-funded wallets can run the flow; set BOUNTY_WEI to override (e.g. 1000000000000000000 = 1 MONAD)
BOUNTY_WEI="${BOUNTY_WEI:-1000000000000000}"

if [ -z "$COMPLETER" ]; then
  echo "Usage: $0 [base_url] <completer_address>"
  echo "Example: $0 http://localhost:3001 0xYourCompleterAddress"
  echo "Completer address is required to claim and receive payment."
  exit 1
fi

echo "=== 1. Post job ==="
RESP=$(curl -s -X POST "$BASE_URL/jobs/post" -H "Content-Type: application/json" \
  -d "{\"description\":\"Test job for full flow\",\"bounty\":\"$BOUNTY_WEI\",\"deadline\":\"2026-12-31T23:59:59Z\",\"issuer\":\"$ISSUER\"}")
echo "$RESP"
JOB_ID=$(echo "$RESP" | grep -o '"jobId":[0-9]*' | cut -d: -f2)
if [ -z "$JOB_ID" ]; then echo "Failed to get jobId"; exit 1; fi
echo "Created jobId: $JOB_ID"

echo ""
echo "=== 2. Escrow bounty ==="
curl -s -X POST "$BASE_URL/jobs/$JOB_ID/escrow" -H "Content-Type: application/json" \
  -d "{\"bountyWei\":\"$BOUNTY_WEI\"}" | head -c 500
echo ""

echo ""
echo "=== 3. Claim job (completer: $COMPLETER) ==="
curl -s -X POST "$BASE_URL/jobs/$JOB_ID/claim" -H "Content-Type: application/json" \
  -d "{\"completer\":\"$COMPLETER\"}" | head -c 500
echo ""

echo ""
echo "=== 4. Submit work ==="
curl -s -X POST "$BASE_URL/jobs/$JOB_ID/submit" -H "Content-Type: application/json" \
  -d "{\"ipfsHash\":\"QmTestFullFlow\",\"completer\":\"$COMPLETER\"}" | head -c 500
echo ""

echo ""
echo "=== 5. Verify (release payment to completer) ==="
curl -s -X POST "$BASE_URL/jobs/$JOB_ID/verify" -H "Content-Type: application/json" \
  -d '{"approved":true}' | head -c 500
echo ""

echo ""
echo "=== Done. Check completer balance on Monad testnet: $COMPLETER ==="
