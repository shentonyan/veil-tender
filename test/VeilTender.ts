import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import type { ConfidentialUSD, VeilTender } from "../types";
import {
  HOUR,
  NONE,
  Phase,
  SCORE_SENT,
  balanceOf,
  deployAll,
  openTender,
  placeBid,
  prepareWallet,
  referenceAward,
  revealAndFinalize,
} from "./helpers";

const BOND = ethers.parseEther("0.01");

describe("VeilTender", function () {
  let token: ConfidentialUSD;
  let tender: VeilTender;
  let tenderAddress: string;
  let poster: HardhatEthersSigner;
  let bidders: HardhatEthersSigner[];

  before(async function () {
    const signers = await ethers.getSigners();
    poster = signers[1];
    bidders = signers.slice(2, 10);
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This suite only runs against the FHEVM mock (use the default hardhat network).");
      this.skip();
    }
    ({ token, tender, tenderAddress } = await deployAll());
  });

  // ------------------------------------------------------------------ funding

  describe("funding", function () {
    it("escrows the budget and opens the tender after the funding proof", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      expect((await tender.getTender(id)).phase).to.eq(Phase.Open);
      expect(await balanceOf(token, poster)).to.eq(0n);
    });

    it("stays in Funding and can retry when the poster cannot cover the budget", async function () {
      await token.connect(poster).faucet(400n);
      await token.connect(poster).setOperator(tenderAddress, (await time.latest()) + 1000);
      const deadline = BigInt((await time.latest()) + HOUR);
      await tender.connect(poster).createTender(1000n, deadline, HOUR, HOUR, 0n, ethers.ZeroAddress, [], []);
      const id = await tender.tenderCount();

      await tender.connect(poster).fund(id);
      const okHandle = await tender.fundOkHandle(id);
      const dec = await fhevm.publicDecrypt([okHandle]);
      expect(dec.clearValues[okHandle as `0x${string}`]).to.eq(false);
      await tender.confirmFunding(id, false, dec.decryptionProof);
      expect((await tender.getTender(id)).phase).to.eq(Phase.Funding);
      expect(await balanceOf(token, poster)).to.eq(400n); // nothing was locked

      // top up and retry
      await token.connect(poster).faucet(600n);
      await tender.connect(poster).fund(id);
      const ok2 = await tender.fundOkHandle(id);
      const dec2 = await fhevm.publicDecrypt([ok2]);
      await tender.confirmFunding(id, true, dec2.decryptionProof);
      expect((await tender.getTender(id)).phase).to.eq(Phase.Open);
    });

    it("rejects a forged funding result", async function () {
      await token.connect(poster).faucet(400n);
      await token.connect(poster).setOperator(tenderAddress, (await time.latest()) + 1000);
      const deadline = BigInt((await time.latest()) + HOUR);
      await tender.connect(poster).createTender(1000n, deadline, HOUR, HOUR, 0n, ethers.ZeroAddress, [], []);
      const id = await tender.tenderCount();
      await tender.connect(poster).fund(id);
      const okHandle = await tender.fundOkHandle(id);
      const dec = await fhevm.publicDecrypt([okHandle]); // real value: false
      await expect(tender.confirmFunding(id, true, dec.decryptionProof)).to.be.reverted;
    });

    it("lets the poster cancel before any bid and refunds the escrow", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await tender.connect(poster).cancel(id);
      expect((await tender.getTender(id)).phase).to.eq(Phase.Cancelled);
      expect(await balanceOf(token, poster)).to.eq(1000n);
    });
  });

  // ------------------------------------------------------------------ the auction rule

  describe("award rule", function () {
    it("lowest bid wins and is paid the second-lowest bid (Vickrey-style)", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await placeBid(tender, tenderAddress, id, bidders[0], 700n);
      await placeBid(tender, tenderAddress, id, bidders[1], 450n);
      await placeBid(tender, tenderAddress, id, bidders[2], 600n);

      const { winnerIdx, secondScore } = await revealAndFinalize(tender, id);
      expect(winnerIdx).to.eq(1n);
      expect(secondScore).to.eq(600n);

      const t = await tender.getTender(id);
      expect(t.phase).to.eq(Phase.Awarded);
      expect(t.winner).to.eq(bidders[1].address);
      expect(t.price).to.eq(600n);
    });

    it("a single valid bid is paid the budget (budget is the phantom second bid)", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await placeBid(tender, tenderAddress, id, bidders[0], 300n);
      await revealAndFinalize(tender, id);
      const t = await tender.getTender(id);
      expect(t.winner).to.eq(bidders[0].address);
      expect(t.price).to.eq(1000n);
    });

    it("neutralises an over-budget bid without reverting", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await placeBid(tender, tenderAddress, id, bidders[0], 5_000_000n); // way over budget
      await placeBid(tender, tenderAddress, id, bidders[1], (1n << 64n) - 1n); // would wrap an unclamped add
      await placeBid(tender, tenderAddress, id, bidders[2], 800n);
      await revealAndFinalize(tender, id);
      const t = await tender.getTender(id);
      expect(t.winner).to.eq(bidders[2].address);
      expect(t.price).to.eq(1000n);
    });

    it("an over-budget bid cannot wrap around its handicap and win", async function () {
      // (2^64 - 1) + 5 wraps to 4 in uint64 arithmetic; it must still be treated as over budget
      const id = await openTender(tender, token, tenderAddress, poster, {
        budget: 1000n,
        allowed: [bidders[0].address, bidders[1].address],
        handicaps: [5n, 0n],
      });
      await placeBid(tender, tenderAddress, id, bidders[0], (1n << 64n) - 1n);
      await placeBid(tender, tenderAddress, id, bidders[1], 800n);
      await revealAndFinalize(tender, id);
      const t = await tender.getTender(id);
      expect(t.winner).to.eq(bidders[1].address);
      expect(t.price).to.eq(1000n);
    });

    it("cancels and refunds when every bid is over budget", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await placeBid(tender, tenderAddress, id, bidders[0], 2000n);
      await placeBid(tender, tenderAddress, id, bidders[1], 3000n);
      const { winnerIdx } = await revealAndFinalize(tender, id);
      expect(winnerIdx).to.eq(BigInt(NONE));
      expect((await tender.getTender(id)).phase).to.eq(Phase.Cancelled);
      expect(await balanceOf(token, poster)).to.eq(1000n);
    });

    it("cancels and refunds when nobody bids", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await time.increase(HOUR + 1);
      await tender.requestReveal(id);
      expect((await tender.getTender(id)).phase).to.eq(Phase.Cancelled);
      expect(await balanceOf(token, poster)).to.eq(1000n);
    });

    it("breaks ties by earliest submission and prices at the tied value", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await placeBid(tender, tenderAddress, id, bidders[0], 500n);
      await placeBid(tender, tenderAddress, id, bidders[1], 500n);
      await placeBid(tender, tenderAddress, id, bidders[2], 900n);
      await revealAndFinalize(tender, id);
      const t = await tender.getTender(id);
      expect(t.winner).to.eq(bidders[0].address);
      expect(t.price).to.eq(500n);
    });

    it("accepts a bid exactly equal to the budget", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await placeBid(tender, tenderAddress, id, bidders[0], 1000n);
      await revealAndFinalize(tender, id);
      const t = await tender.getTender(id);
      expect(t.winner).to.eq(bidders[0].address);
      expect(t.price).to.eq(1000n);
    });

    it("a reputation handicap can beat a lower raw price, and the winner is paid the threshold", async function () {
      // bidders[0]: raw 400 but handicap 300 (score 700); bidders[1]: raw 600, handicap 0 (score 600)
      // bidders[2]: raw 650, handicap 0 (score 650)
      const id = await openTender(tender, token, tenderAddress, poster, {
        budget: 1000n,
        allowed: [bidders[0].address, bidders[1].address, bidders[2].address],
        handicaps: [300n, 0n, 0n],
      });
      await placeBid(tender, tenderAddress, id, bidders[0], 400n);
      await placeBid(tender, tenderAddress, id, bidders[1], 600n);
      await placeBid(tender, tenderAddress, id, bidders[2], 650n);
      const { secondScore } = await revealAndFinalize(tender, id);
      expect(secondScore).to.eq(650n);
      const t = await tender.getTender(id);
      expect(t.winner).to.eq(bidders[1].address); // lowest SCORE, not lowest price
      expect(t.price).to.eq(650n); // threshold: the most it could have bid and still won
    });

    it("never marks the lowest score or any individual bid publicly decryptable", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await placeBid(tender, tenderAddress, id, bidders[0], 450n);
      await placeBid(tender, tenderAddress, id, bidders[1], 600n);
      await time.increase(HOUR + 1);
      await tender.requestReveal(id);

      const best = await tender.bestScoreHandle(id);
      await expect(fhevm.publicDecrypt([best])).to.be.rejected;

      // the two revealed handles do decrypt, to exactly (winner index, second score)
      const [wH, sH] = await tender.revealHandles(id);
      const dec = await fhevm.publicDecrypt([wH, sH]);
      expect(dec.clearValues[wH as `0x${string}`]).to.eq(0n);
      expect(dec.clearValues[sH as `0x${string}`]).to.eq(600n);
    });

    it("rejects a forged winner or price", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n });
      await placeBid(tender, tenderAddress, id, bidders[0], 450n);
      await placeBid(tender, tenderAddress, id, bidders[1], 600n);
      await time.increase(HOUR + 1);
      await tender.requestReveal(id);
      const [wH, sH] = await tender.revealHandles(id);
      const dec = await fhevm.publicDecrypt([wH, sH]);
      await expect(tender.finalize(id, 1n, 600n, dec.decryptionProof)).to.be.reverted; // wrong winner
      await expect(tender.finalize(id, 0n, 100n, dec.decryptionProof)).to.be.reverted; // wrong price
      await tender.finalize(id, 0n, 600n, dec.decryptionProof);
      await expect(tender.finalize(id, 0n, 600n, dec.decryptionProof)).to.be.revertedWithCustomError(
        tender,
        "BadPhase",
      ); // no replay
    });

    it("matches a plaintext reference on randomized auctions (differential test)", async function () {
      this.timeout(10 * 60 * 1000);
      let seed = 0x5eed1234;
      const rnd = (n: number) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % n;
      };
      for (let trial = 0; trial < 20; trial++) {
        const n = 1 + rnd(6);
        const budget = BigInt(500 + rnd(1000));
        const useHandicaps = rnd(2) === 1;
        const prices: bigint[] = [];
        const handicaps: bigint[] = [];
        for (let i = 0; i < n; i++) {
          prices.push(BigInt(1 + rnd(Number(budget) + 400))); // some over budget, many ties are possible
          handicaps.push(useHandicaps ? BigInt(rnd(250)) : 0n);
        }
        const id = await openTender(tender, token, tenderAddress, poster, {
          budget,
          allowed: useHandicaps ? bidders.slice(0, n).map((b) => b.address) : [],
          handicaps: useHandicaps ? handicaps : [],
        });
        for (let i = 0; i < n; i++) await placeBid(tender, tenderAddress, id, bidders[i], prices[i]);

        const expected = referenceAward(prices, budget, handicaps);
        await revealAndFinalize(tender, id);
        const t = await tender.getTender(id);
        if (expected.winner === null) {
          expect(t.phase, `trial ${trial}`).to.eq(Phase.Cancelled);
        } else {
          expect(t.winner, `trial ${trial} winner`).to.eq(bidders[expected.winner].address);
          expect(t.price, `trial ${trial} price`).to.eq(expected.price);
          // individual rationality for the winner and the budget cap
          expect(t.price).to.be.lte(budget);
          expect(t.price).to.be.gte(prices[expected.winner]);
        }
      }
    });

    it("sanity: SCORE_SENT is above every valid score", async function () {
      expect(await tender.SCORE_SENT()).to.eq(SCORE_SENT);
      expect(await tender.MAX_BUDGET() * 2n).to.be.lt(SCORE_SENT);
    });
  });

  // ------------------------------------------------------------------ bid admission

  describe("bid admission", function () {
    it("enforces one bid per address, the exact bond, the deadline and the allowlist", async function () {
      const id = await openTender(tender, token, tenderAddress, poster, {
        budget: 1000n,
        bondWei: BOND,
        allowed: [bidders[0].address, bidders[1].address],
        handicaps: [0n, 0n],
      });
      await expect(placeBid(tender, tenderAddress, id, bidders[0], 500n, 0n)).to.be.revertedWithCustomError(
        tender,
        "WrongBond",
      );
      await placeBid(tender, tenderAddress, id, bidders[0], 500n, BOND);
      await expect(placeBid(tender, tenderAddress, id, bidders[0], 400n, BOND)).to.be.revertedWithCustomError(
        tender,
        "AlreadyBid",
      );
      await expect(placeBid(tender, tenderAddress, id, bidders[5], 400n, BOND)).to.be.revertedWithCustomError(
        tender,
        "NotAllowed",
      );
      await time.increase(HOUR + 1);
      await expect(placeBid(tender, tenderAddress, id, bidders[1], 400n, BOND)).to.be.revertedWithCustomError(
        tender,
        "TooLate",
      );
    });

    it("does not let the poster or the evaluator bid on their own tender", async function () {
      const evaluator = bidders[7];
      const id = await openTender(tender, token, tenderAddress, poster, { budget: 1000n, evaluator: evaluator.address });
      await expect(placeBid(tender, tenderAddress, id, poster, 100n)).to.be.revertedWithCustomError(
        tender,
        "PosterCannotBid",
      );
      await expect(placeBid(tender, tenderAddress, id, evaluator, 100n)).to.be.revertedWithCustomError(
        tender,
        "PosterCannotBid",
      );
    });

    it("does not accept bids before funding is confirmed", async function () {
      await prepareWallet(token, tenderAddress, poster, 1000n);
      const deadline = BigInt((await time.latest()) + HOUR);
      await tender.connect(poster).createTender(1000n, deadline, HOUR, HOUR, 0n, ethers.ZeroAddress, [], []);
      const id = await tender.tenderCount();
      await expect(placeBid(tender, tenderAddress, id, bidders[0], 500n)).to.be.revertedWithCustomError(
        tender,
        "BadPhase",
      );
    });

    it("validates tender parameters", async function () {
      const now = BigInt(await time.latest());
      const z = ethers.ZeroAddress;
      await expect(tender.createTender(0n, now + 100n, HOUR, HOUR, 0n, z, [], [])).to.be.revertedWithCustomError(
        tender,
        "BadParams",
      );
      await expect(
        tender.createTender(1n << 40n, now + 100n, HOUR, HOUR, 0n, z, [], []),
      ).to.be.revertedWithCustomError(tender, "BadParams");
      await expect(tender.createTender(10n, now - 1n, HOUR, HOUR, 0n, z, [], [])).to.be.revertedWithCustomError(
        tender,
        "BadParams",
      );
      await expect(
        tender.createTender(10n, now + 100n, HOUR, HOUR, 0n, z, [bidders[0].address], []),
      ).to.be.revertedWithCustomError(tender, "BadParams");
    });
  });

  // ------------------------------------------------------------------ delivery & settlement

  describe("delivery and settlement", function () {
    async function awarded(budget = 1000n) {
      const id = await openTender(tender, token, tenderAddress, poster, { budget, bondWei: BOND });
      await placeBid(tender, tenderAddress, id, bidders[0], 450n, BOND);
      await placeBid(tender, tenderAddress, id, bidders[1], 600n, BOND);
      await placeBid(tender, tenderAddress, id, bidders[2], 700n, BOND);
      await revealAndFinalize(tender, id);
      return id;
    }

    it("pays the winner the clearing price and refunds the rest to the poster", async function () {
      const id = await awarded();
      const hash = ethers.keccak256(ethers.toUtf8Bytes("deliverable-v1"));
      await tender.connect(bidders[0]).submitDelivery(id, hash);
      await tender.connect(poster).approve(id);

      expect((await tender.getTender(id)).phase).to.eq(Phase.Settled);
      expect(await balanceOf(token, bidders[0])).to.eq(600n);
      expect(await balanceOf(token, poster)).to.eq(400n);
    });

    it("returns bonds: losers right after the award, the winner after settlement", async function () {
      const id = await awarded();
      await expect(tender.connect(bidders[1]).withdrawBond(id)).to.changeEtherBalance(bidders[1], BOND);
      await expect(tender.connect(bidders[1]).withdrawBond(id)).to.be.revertedWithCustomError(
        tender,
        "NothingToWithdraw",
      );
      await expect(tender.connect(bidders[0]).withdrawBond(id)).to.be.revertedWithCustomError(
        tender,
        "NothingToWithdraw",
      ); // winner's bond stays locked until settlement
      await tender.connect(bidders[0]).submitDelivery(id, ethers.ZeroHash);
      await tender.connect(poster).approve(id);
      await expect(tender.connect(bidders[0]).withdrawBond(id)).to.changeEtherBalance(bidders[0], BOND);
    });

    it("auto-settles for the winner when the evaluator stays silent", async function () {
      const id = await awarded();
      await tender.connect(bidders[0]).submitDelivery(id, ethers.ZeroHash);
      await expect(tender.settleAfterReview(id)).to.be.revertedWithCustomError(tender, "TooEarly");
      await time.increase(3 * 24 * HOUR + 1);
      await tender.settleAfterReview(id);
      expect(await balanceOf(token, bidders[0])).to.eq(600n);
      expect(await balanceOf(token, poster)).to.eq(400n);
    });

    it("slashes the bond and refunds the full escrow when the winner never delivers", async function () {
      const id = await awarded();
      await expect(tender.claimDefault(id)).to.be.revertedWithCustomError(tender, "TooEarly");
      await time.increase(7 * 24 * HOUR + 1);
      await tender.claimDefault(id);

      expect((await tender.getTender(id)).phase).to.eq(Phase.Defaulted);
      expect(await balanceOf(token, poster)).to.eq(1000n);
      expect(await balanceOf(token, bidders[0])).to.eq(0n);
      await expect(tender.connect(poster).withdrawPending()).to.changeEtherBalance(poster, BOND);
      await expect(tender.connect(bidders[0]).withdrawBond(id)).to.be.revertedWithCustomError(
        tender,
        "NothingToWithdraw",
      );
    });

    it("lets the evaluator reject a delivery: bond slashed, escrow refunded", async function () {
      const id = await awarded();
      await tender.connect(bidders[0]).submitDelivery(id, ethers.ZeroHash);
      await expect(tender.connect(bidders[3]).reject(id)).to.be.revertedWithCustomError(tender, "NotEvaluator");
      await tender.connect(poster).reject(id);
      expect((await tender.getTender(id)).phase).to.eq(Phase.Rejected);
      expect(await balanceOf(token, poster)).to.eq(1000n);
      await expect(tender.connect(poster).withdrawPending()).to.changeEtherBalance(poster, BOND);
    });

    it("only the winner can deliver, and only before the execution deadline", async function () {
      const id = await awarded();
      await expect(tender.connect(bidders[1]).submitDelivery(id, ethers.ZeroHash)).to.be.revertedWithCustomError(
        tender,
        "NotWinner",
      );
      await time.increase(7 * 24 * HOUR + 1);
      await expect(tender.connect(bidders[0]).submitDelivery(id, ethers.ZeroHash)).to.be.revertedWithCustomError(
        tender,
        "TooLate",
      );
    });

    it("uses a separate evaluator when one is named", async function () {
      const evaluator = bidders[7];
      const id = await openTender(tender, token, tenderAddress, poster, {
        budget: 1000n,
        evaluator: evaluator.address,
      });
      await placeBid(tender, tenderAddress, id, bidders[0], 450n);
      await revealAndFinalize(tender, id);
      await tender.connect(bidders[0]).submitDelivery(id, ethers.ZeroHash);
      await expect(tender.connect(poster).approve(id)).to.be.revertedWithCustomError(tender, "NotEvaluator");
      await tender.connect(evaluator).approve(id);
      expect(await balanceOf(token, bidders[0])).to.eq(1000n);
    });
  });
});
