/* English and Simplified Chinese copy for the demo site. Placeholders look like {name}. */
(function (root) {
  "use strict";

  var T = {
    en: {
      "doc.title": "VeilTender: sealed bids for AI agents",
      "nav.flow": "Flow",
      "nav.try": "Try it",
      "nav.run": "Real run",
      "nav.limits": "Limits",
      "nav.github": "GitHub",

      "hero.title": "Bids stay sealed. Only the price comes out.",
      "hero.lede":
        "AI agents bid for a task with encrypted prices. The contract picks the winner without reading a single bid, then reveals who won and what they are paid.",
      "hero.try": "Try your own auction",
      "hero.code": "Read the code",
      "board.hint": "Four agents have bid. Their prices are sealed.",
      "board.close": "Close the bidding",
      "board.reset": "Seal again",
      "board.sealed": "sealed",
      "board.winner": "winner",
      "board.stamp": "Second-lowest score: {score}. Whose it is stays unrevealed.",
      "board.result": "{name} wins and is paid {price}. No individual bid was opened.",
      "board.public": "Participants are public. Prices are not.",

      "why.title": "Why seal the bids?",
      "why.1.h": "Open bids invite undercutting.",
      "why.1.p": "On a public chain a pending bid is visible. Anyone can read it and bid just below.",
      "why.2.h": "A bid-taker who reads bids can cheat.",
      "why.2.p":
        "In a second-price auction a buyer who sees the bids can slip in a fake one and lower the price they pay.",
      "why.3.h": "Bidders keep their costs private.",
      "why.3.p": "A true cost is business information. Agents will bid it honestly only if nobody reads it.",
      "why.note":
        "VeilTender moves trust from an auctioneer to the FHE decryption network. That is a different assumption, not the absence of trust.",

      "flow.title": "From task to payout",
      "flow.public": "Everyone sees",
      "flow.sealed": "Stays sealed",
      "flow.s1.t": "Fund",
      "flow.s1.pub": "The budget is public. The escrow moves through a confidential token, so the transfer amount is encrypted.",
      "flow.s1.sealed": "Only one yes or no is revealed: the escrow holds the full budget.",
      "flow.s2.t": "Bid",
      "flow.s2.pub": "Who bid, and a bond. The price itself is an opaque ciphertext.",
      "flow.s2.sealed":
        "Each agent's price. The contract folds it into three encrypted values without reading it. An over-budget bid is neutralised, never rejected, so validity does not leak.",
      "flow.s3.t": "Close",
      "flow.s3.pub": "After the deadline anyone can ask for the reveal. Exactly two values are marked decryptable.",
      "flow.s3.sealed": "The lowest score is never marked decryptable. Neither is any single bid.",
      "flow.s4.t": "Reveal",
      "flow.s4.pub":
        "The winner index and the second-lowest score, checked on-chain against the decryption network's signatures. Nobody can forge them.",
      "flow.s4.sealed": "Every individual bid, including the winner's.",
      "flow.s5.t": "Settle",
      "flow.s5.pub":
        "The winner delivers, the evaluator approves, the winner is paid and the rest of the budget is refunded.",
      "flow.s5.sealed":
        "Balances and amounts on the token ledger. A winner who never delivers loses the bond.",

      "try.title": "Try an auction",
      "try.lede":
        "Change costs, handicaps and strategies. The page runs the contract's rule on plain numbers; the contract runs it on ciphertexts. Tests check both against one plaintext reference.",
      "try.budget": "Budget",
      "try.agent": "Agent",
      "try.cost": "True cost",
      "try.handicap": "Handicap",
      "try.strategy": "Strategy",
      "try.s.truth": "Bid the true cost",
      "try.s.high": "Bid 25% above cost",
      "try.s.low": "Bid 25% below cost",
      "try.col.bid": "Bid",
      "try.col.score": "Score",
      "try.col.result": "Result",
      "try.r.win": "Wins",
      "try.r.lost": "Lost",
      "try.r.over": "Over budget, ignored",
      "try.summary.win": "{name} wins and is paid {price}. Its profit is {profit}.",
      "try.summary.none": "No valid bid. The escrow is refunded.",
      "try.observer": "What the chain shows",
      "try.observer.note": "Illustrative handles. Real ciphertexts are produced by the FHE library.",
      "try.revealed": "Revealed at the deadline",
      "try.revealed.v": "winner index {idx}, second-lowest score {second}",
      "try.revealed.v1": "winner index {idx}; there is no second valid bid, so the price is the budget",
      "try.revealed.none": "nothing: every bid was over budget",
      "chart.title": "Pay-off for {name} as its bid changes",
      "chart.x": "its bid",
      "chart.y": "pay-off",
      "chart.cost": "true cost",
      "chart.now": "current bid",
      "chart.caption.win":
        "While {name} wins, its pay-off is flat at {payoff}, because the price does not depend on its own bid. Above {limit} it loses. With rivals' bids fixed, no bid does better than bidding the true cost.",
      "chart.caption.lose":
        "With these rivals {name} cannot win at a profit: no bid at or above its cost wins. Bidding the true cost is still never worse than any other bid.",

      "run.title": "A run of the contract",
      "run.lede":
        "Replay of the demo script on the local FHEVM mock, with the same four agents as the board above. The text is generated by the script and stays in English.",
      "run.toggle": "Show what only each party knows",
      "run.pub": "On-chain, visible to everyone",
      "run.priv": "Known only to {actor}",
      "run.missing": "No transcript found. Run npm run demo to generate web/transcript.js.",

      "limits.title": "What it promises, and what it does not",
      "limits.yes": "Promises",
      "limits.no": "Does not promise",
      "limits.yes.1": "The lowest score wins. Ties go to the earlier bid.",
      "limits.yes.2": "The winner is paid the second-lowest score minus its own handicap, never more than the budget.",
      "limits.yes.3": "No individual bid is ever decrypted.",
      "limits.yes.4": "Every bid costs the same computation, whatever its value.",
      "limits.no.1": "It does not stop bidders from colluding.",
      "limits.no.2": "Participants and the final price are public.",
      "limits.no.3": "It trusts the FHE decryption network to stay honest.",
      "limits.no.4": "It is a prototype: not audited, tested on a local mock, not yet on a public network.",

      "foot.src": "Source on GitHub",
      "foot.license": "BSD-3-Clause-Clear",
      "foot.built": "Built for the ETH Shenzhen 2026 Hackathon.",
    },

    zh: {
      "doc.title": "VeilTender:面向 AI Agent 的密封投标",
      "nav.flow": "流程",
      "nav.try": "试玩",
      "nav.run": "真实运行",
      "nav.limits": "边界",
      "nav.github": "GitHub",

      "hero.title": "报价始终密封,只公开价格。",
      "hero.lede":
        "AI Agent 用加密报价竞标任务。合约在不读取任何一份报价的情况下选出赢家,然后只公开谁赢了、报酬是多少。",
      "hero.try": "试一场自己的拍卖",
      "hero.code": "查看代码",
      "board.hint": "四个 Agent 已经投标,报价处于密封状态。",
      "board.close": "截止开标",
      "board.reset": "重新密封",
      "board.sealed": "已密封",
      "board.winner": "赢家",
      "board.stamp": "次低分:{score}。它属于谁,不会公开。",
      "board.result": "{name} 中标,获得 {price}。没有任何一份单独的报价被打开。",
      "board.public": "参与者是公开的,报价不是。",

      "why.title": "为什么要密封报价?",
      "why.1.h": "公开报价会招来压价。",
      "why.1.p": "在公链上,待确认的报价是可见的,任何人都可以读到并报一个略低的价格。",
      "why.2.h": "能看到报价的招标方可以作弊。",
      "why.2.p": "在二价拍卖里,看得到报价的买家可以塞入一个假报价,压低自己要付的价格。",
      "why.3.h": "投标方不愿暴露自己的成本。",
      "why.3.p": "真实成本是商业信息。只有在没人能读到时,Agent 才会如实报价。",
      "why.note": "VeilTender 把信任从拍卖人转移到了 FHE 解密网络。这是另一种假设,不是不再需要信任。",

      "flow.title": "从任务到付款",
      "flow.public": "所有人可见",
      "flow.sealed": "保持密封",
      "flow.s1.t": "托管",
      "flow.s1.pub": "预算是公开的。托管资金通过保密代币转入,转账金额是加密的。",
      "flow.s1.sealed": "只公开一个是非判断:托管金额是否等于完整预算。",
      "flow.s2.t": "投标",
      "flow.s2.pub": "谁投了标,以及保证金。价格本身是不可读的密文。",
      "flow.s2.sealed":
        "每个 Agent 的价格。合约在不读取的前提下把它折叠进三个加密值。超出预算的报价会被中和而不是被拒绝,所以有效性不会泄露。",
      "flow.s3.t": "截止",
      "flow.s3.pub": "截止后任何人都可以请求开标。只有两个值被标记为可解密。",
      "flow.s3.sealed": "最低分不会被标记为可解密,任何单个报价也不会。",
      "flow.s4.t": "开标",
      "flow.s4.pub": "赢家序号和次低分,在链上用解密网络的签名验证,任何人都无法伪造。",
      "flow.s4.sealed": "每一份单独的报价,包括赢家自己的。",
      "flow.s5.t": "结算",
      "flow.s5.pub": "赢家交付,评估人确认,赢家获得报酬,剩余预算退还。",
      "flow.s5.sealed": "代币账本上的余额和金额。从不交付的赢家会失去保证金。",

      "try.title": "试一场拍卖",
      "try.lede":
        "修改成本、handicap 和策略。页面在普通数字上运行合约的规则,合约则在密文上运行同一套规则。测试把两者都对照同一份明文参考实现。",
      "try.budget": "预算",
      "try.agent": "Agent",
      "try.cost": "真实成本",
      "try.handicap": "Handicap",
      "try.strategy": "策略",
      "try.s.truth": "按真实成本报价",
      "try.s.high": "高于成本 25% 报价",
      "try.s.low": "低于成本 25% 报价",
      "try.col.bid": "报价",
      "try.col.score": "得分",
      "try.col.result": "结果",
      "try.r.win": "中标",
      "try.r.lost": "落选",
      "try.r.over": "超出预算,忽略",
      "try.summary.win": "{name} 中标,获得 {price}。它的利润是 {profit}。",
      "try.summary.none": "没有有效报价,托管资金退还。",
      "try.observer": "链上能看到什么",
      "try.observer.note": "示意用的句柄。真实密文由 FHE 库生成。",
      "try.revealed": "截止时公开的内容",
      "try.revealed.v": "赢家序号 {idx},次低分 {second}",
      "try.revealed.v1": "赢家序号 {idx};没有第二个有效报价,因此价格就是预算",
      "try.revealed.none": "没有公开内容:所有报价都超出预算",
      "chart.title": "{name} 的收益随其报价变化",
      "chart.x": "它的报价",
      "chart.y": "收益",
      "chart.cost": "真实成本",
      "chart.now": "当前报价",
      "chart.caption.win":
        "只要 {name} 能中标,它的收益就固定在 {payoff},因为价格不取决于它自己的报价。报价高于 {limit} 就会落选。在其他人报价不变时,没有哪个报价比按真实成本报价更好。",
      "chart.caption.lose":
        "面对这些对手,{name} 无法盈利中标:任何不低于成本的报价都不会中标。按真实成本报价仍然不会比其他报价更差。",

      "run.title": "一次合约运行",
      "run.lede": "在本地 FHEVM mock 上运行演示脚本的回放,和上面棋盘用的是同样的四个 Agent。文本由脚本生成,保持英文。",
      "run.toggle": "显示只有各方自己知道的信息",
      "run.pub": "链上,所有人可见",
      "run.priv": "只有 {actor} 知道",
      "run.missing": "没有找到运行记录。运行 npm run demo 生成 web/transcript.js。",

      "limits.title": "它保证什么,不保证什么",
      "limits.yes": "保证",
      "limits.no": "不保证",
      "limits.yes.1": "最低分中标,平局时先提交者中标。",
      "limits.yes.2": "赢家获得次低分减去自身 handicap,且不超过预算。",
      "limits.yes.3": "任何单个报价都不会被解密。",
      "limits.yes.4": "无论报价多少,每次投标的计算量都相同。",
      "limits.no.1": "不能阻止投标方串谋。",
      "limits.no.2": "参与者和最终价格是公开的。",
      "limits.no.3": "它依赖 FHE 解密网络保持诚实。",
      "limits.no.4": "这是原型:未经审计,在本地 mock 上测试,尚未部署到公共网络。",

      "foot.src": "GitHub 源码",
      "foot.license": "BSD-3-Clause-Clear",
      "foot.built": "为 ETH Shenzhen 2026 黑客松而做。",
    },
  };

  function t(lang, key, vars) {
    var table = T[lang] || T.en;
    var s = table[key];
    if (s === undefined) s = T.en[key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  root.VeilI18n = { t: t, languages: Object.keys(T) };
})(typeof window !== "undefined" ? window : this);
