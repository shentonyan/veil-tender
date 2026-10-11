# Mechanism

VeilTender is a reverse (procurement) auction. This document states what the contract implements, what we claim
about it, what we do not claim, and the threat model.

## Rule

Notation: `B` public budget, `b_i` bid, `k_i` public handicap (0 for everyone unless the tender uses an
allowlist), `s_i = b_i + k_i` score, valid iff `b_i ≤ B`.

- **Allocation.** Among valid bids the lowest score wins. Exact ties go to the earlier submission. If no bid is
  valid, no award is made and the escrow is refunded.
- **Payment.** `p = min(s_(2) − k_w, B)` where `s_(2)` is the second-lowest valid score and `k_w` the winner's
  handicap. With one valid bid, `p = B`.
- **Homomorphic algorithm.** State is `(best, second, winnerIdx)`, initially `(SENT, SENT, NONE)` with
  `SENT = 2^62`. For each bid: `valid = le(x, B)`; `s = select(valid, x + k, SENT)`; then
  `second' = select(s < best, best, select(s < second, s, second))`, `best' = select(s < best, s, best)`,
  `idx' = select(s < best, i, idx)`. Eight FHE operations per bid on 64-bit values plus one 32-bit select,
  independent of the values. All three new values are computed from the old state.
- **Why `x + k` cannot wrap into a winning score.** `x` may be any `uint64`, so `x + k` can wrap, but the wrapped
  value is discarded by the outer select whenever `x > B`. A test covers `(2^64 − 1) + 5`.
- **Budget bound.** `B < 2^40` and `k ≤ 2^40`, so every valid score is below `2^41` and strictly below `SENT`.
- **What is revealed.** Only `winnerIdx` and `second`. `best` is never marked publicly decryptable.

## Claims (with their assumptions)

1. **Incentives.** Under private values (an agent's cost does not depend on rivals' bids), risk-neutral quasi-linear
   agents, no collusion, and a bond that does not depend on the bid, bidding one's true cost is a weakly dominant
   strategy. The rule is monotone in the own bid with a threshold payment (Vickrey 1961; Myerson 1981,
   single-parameter case).
2. **Individual rationality.** A truthful winner is paid at least its cost.
3. **Reserve.** `B` is a public reserve. We do not claim `B` is optimal for the buyer.
4. **Reputation handicaps.** With public, exogenous handicaps fixed at tender creation, the same monotone rule and
   threshold payment apply, so truthfulness holds in the same sense. If the handicaps equal the buyer's value
   differences it coincides with the VCG outcome. This is conditional on handicaps not being manipulable by the
   agents.
5. **Confidentiality.** Individual bids are encrypted and never made publicly decryptable. An observer learns the
   winner, the price, who participated, and what those imply. The clearing price equals one losing bid's value
   (unattributed for more than two bidders). This holds if the FHE scheme is secure and the decryption threshold
   is not corrupted.
6. **Data-independent execution.** Every bid triggers the same sequence of homomorphic operations, and no revert
   depends on a ciphertext, so cost and failure behaviour do not vary with bid values.

## What we do not claim

Collusion resistance, sybil-proofness, resistance to collusion between bidders and the decryption quorum,
optimality of the buyer's procurement cost, privacy of participation, privacy of the clearing price, or
truthfulness when agents manipulate their own reputation.

## Threat model

| Threat | Handling in the contract |
|---|---|
| Front-running, bid sniping | Bids are ciphertexts bound to (contract, sender) by the input proof. Nothing to react to. Hard deadline by block timestamp. |
| Buyer shill bid to cut the second price | The poster and evaluator cannot bid (`PosterCannotBid`) and are never granted decryption rights. A shill from another address would have to be placed blind. Sybils remain possible. |
| Bidder collusion | Not prevented. Known limitation of second-price auctions. |
| Winner does not deliver | Native-currency bond per bid, slashed to the poster on timeout or rejection. Full escrow refunded. |
| Poster does not pay | Full budget is escrowed and verified under encryption before bids are accepted. |
| Spam bids | One bid per address, a bond per bid, at most 255 bidders. |
| Auctioneer manipulation | No operator. Every step is a permissionless function. `finalize` accepts only values proven by the decryption network. |
| Gas side channel | Fixed operation count per bid. Over-budget bids are neutralised instead of reverting. |
| Event leakage | `BidPlaced` carries only the bidder and its index. No bid-derived value is emitted. |
| Replay or double finalise | Public state machine guards every transition. |
| Silent zero transfer | The escrow credit is verified with an encrypted equality and a proven boolean. Payouts use amounts already known to be escrowed. |
| Decryption trust | Out of the contract's control. A threshold of the decryption network must be honest. |

## Not implemented

- A first-price (pay-as-bid) mode. It is a one-line change but has no truthfulness guarantee and is not offered.
- Re-running the award after a default (this would reveal a new clearing price).
- Binding handicaps to an on-chain reputation registry.
- An ERC-8183 hook adapter.
