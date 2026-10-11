/*
 * The VeilTender award rule on plain numbers.
 *
 * This is the same fold the contract performs on ciphertexts (VeilTender._fold): one pass over the bids,
 * three running values (lowest score, second-lowest score, index of the lowest), no data-dependent branch
 * beyond "is this score smaller". It is used by the demo site. test/webRule.ts checks it against a
 * sort-based plaintext reference, and test/VeilTender.ts checks the contract against that same reference.
 */
(function (root) {
  "use strict";

  var SCORE_SENT = Math.pow(2, 62); // stands for "no valid bid yet", above every valid score

  /**
   * @param {number[]} bids      one price per agent, in arrival order
   * @param {number}   budget    public maximum price
   * @param {number[]} handicaps public handicap per agent (0 when reputation is not used)
   */
  function award(bids, budget, handicaps) {
    var best = SCORE_SENT;
    var second = SCORE_SENT;
    var idx = -1;
    var scores = [];
    var trace = [];

    for (var i = 0; i < bids.length; i++) {
      var k = handicaps[i] || 0;
      var valid = bids[i] <= budget; // over-budget bids are neutralised, never rejected
      var score = valid ? bids[i] + k : SCORE_SENT;
      var beatsBest = score < best;
      var beatsSecond = score < second;
      // all three new values are computed from the OLD state
      var newSecond = beatsBest ? best : beatsSecond ? score : second;
      var newBest = beatsBest ? score : best;
      var newIdx = beatsBest ? i : idx;
      best = newBest;
      second = newSecond;
      idx = newIdx;
      scores.push(valid ? score : null);
      trace.push({ index: i, valid: valid, score: valid ? score : null, best: best, second: second, winner: idx });
    }

    var winner = idx >= 0 ? idx : null;
    var price = null;
    if (winner !== null) {
      price = budget; // a single valid bid faces the budget as a phantom competitor
      if (second < SCORE_SENT) {
        var threshold = second - (handicaps[winner] || 0);
        if (threshold < price) price = threshold;
      }
    }
    return {
      winner: winner,
      price: price,
      secondScore: second < SCORE_SENT ? second : null,
      scores: scores,
      trace: trace,
    };
  }

  var api = { award: award, SCORE_SENT: SCORE_SENT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VeilRule = api;
})(typeof window !== "undefined" ? window : this);
