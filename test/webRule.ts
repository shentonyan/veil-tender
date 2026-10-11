import { expect } from "chai";
import { referenceAward } from "./helpers";

// The browser demo runs this module. It must agree with the same plaintext reference the contract is tested against.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require("../web/mechanism.js") as {
  award: (
    bids: number[],
    budget: number,
    handicaps: number[],
  ) => { winner: number | null; price: number | null; secondScore: number | null };
};

describe("web/mechanism.js (browser demo rule)", function () {
  it("matches the plaintext reference on 5000 random auctions", function () {
    let seed = 0xc0ffee;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    };
    for (let trial = 0; trial < 5000; trial++) {
      const n = 1 + rnd(8);
      const budget = 1 + rnd(2000);
      const prices: number[] = [];
      const handicaps: number[] = [];
      for (let i = 0; i < n; i++) {
        // small support makes ties likely; some bids exceed the budget
        prices.push(rnd(3) === 0 ? rnd(8) : rnd(budget + 600));
        handicaps.push(rnd(2) === 0 ? 0 : rnd(300));
      }
      const got = rule.award(prices, budget, handicaps);
      const want = referenceAward(prices.map(BigInt), BigInt(budget), handicaps.map(BigInt));
      expect(got.winner, `trial ${trial}`).to.equal(want.winner);
      if (want.winner !== null) expect(BigInt(got.price as number), `trial ${trial}`).to.equal(want.price);
      else expect(got.price).to.equal(null);
    }
  });

  it("handles the documented edge cases", function () {
    // one valid bid is paid the budget
    expect(rule.award([300], 1000, [0])).to.include({ winner: 0, price: 1000 });
    // everything over budget: no award
    expect(rule.award([2000, 3000], 1000, [0, 0])).to.include({ winner: null, price: null });
    // exact tie: earlier wins, price is the tied value
    expect(rule.award([500, 500, 900], 1000, [0, 0, 0])).to.include({ winner: 0, price: 500 });
    // a bid equal to the budget is valid
    expect(rule.award([1000], 1000, [0])).to.include({ winner: 0, price: 1000 });
    // the scenario shown on the demo site: lowest raw price loses to a handicap
    const demo = rule.award([420, 300, 510, 1500], 1000, [0, 150, 0, 0]);
    expect(demo).to.include({ winner: 0, price: 450, secondScore: 450 });
  });
});
