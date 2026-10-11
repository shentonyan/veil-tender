/* English and Simplified Chinese copy for the demo site. Placeholders look like {name}. Values may be arrays (lists). */
(function (root) {
  "use strict";

  var T = {
    en: {
      "doc.title": "VeilTender: sealed bids for AI agents",
      "nav.demo": "The run",
      "nav.try": "Playground",
      "nav.privacy": "Who sees what",
      "nav.github": "GitHub",

      "hero.title": "Bids stay sealed. Only the price comes out.",
      "hero.lede":
        "AI agents bid for a task with encrypted prices. The contract picks the winner without reading a single bid — under fully homomorphic encryption — then reveals only who won and what they are paid.",
      "hero.demo": "Watch a real run",
      "hero.code": "Read the code",

      "cipher.title": "Everything the chain stores for one bid",
      "cipher.event": "event",
      "cipher.event.v": "BidPlaced from {addr}",
      "cipher.handle": "ciphertext",
      "cipher.bond": "bond",
      "cipher.bond.v": "0.01 ETH locked",
      "cipher.price": "price",
      "cipher.price.v": "never decrypted",
      "cipher.note": "From a real run of the contract on the local FHEVM mock.",

      "value.title": "Is this actually worth building?",
      "value.1.h": "Agents are starting to hire agents.",
      "value.1.p":
        "When software agents buy services from each other \u2014 compute, data, deliveries, work \u2014 something has to set the price. Posted prices leak margin; negotiation does not scale. The textbook answer is a sealed-bid auction.",
      "value.2.h": "The honest auction is the one nobody deploys.",
      "value.2.p":
        "Second-price auctions make truthful bidding optimal \u2014 on paper. In practice they are rare, and economists have asked why since Vickrey (Rothkopf et al. 1990): an auctioneer who sees the bids can cheat, and on a public chain every bid is readable before the deadline. Commit\u2013reveal patches that, then breaks when a loser simply refuses to reveal.",
      "value.3.h": "FHE removes the auctioneer.",
      "value.3.p":
        "Here the contract computes on encrypted bids. No auctioneer reads them, no rival can react to them, and nobody has to come back for a reveal phase. A mechanism that lived in textbooks becomes one you can deploy.",
      "value.note":
        "Concrete fits: task markets between AI agents (this demo), procurement where suppliers will not expose their cost structure, one-shot sealed-bid sales.",

      "demo.title": "One auction, end to end",
      "demo.lede":
        "Four agents, one task, a public budget of 1000. This replays a real run of the contract on the local FHEVM mock. Step through what the chain shows — and what it never will.",
      "demo.prev": "Back",
      "demo.next": "Next step",
      "demo.play": "Play all",
      "demo.pause": "Pause",
      "demo.restart": "Restart",
      "demo.pub": "On-chain · everyone sees",
      "demo.sealed": "Sealed · never in the clear",
      "demo.result": "ReliableRoute is paid 450. No individual bid was ever decrypted.",
      "demo.note":
        "Replay of the committed transcript from npm run demo on the local FHEVM mock — not a Sepolia deployment.",
      "demo.raw": "Raw transcript",

      "demo.s1.t": "Post & escrow",
      "demo.s1.pub": [
        "Tender #1 is posted. Budget 1000 cUSD, deadline, 0.01 ETH bond and the evaluator are all public.",
        "Per-bidder handicaps are fixed now, in public: FreshStart, a new agent with no track record, carries +150.",
        "The escrow arrives through a confidential ERC-7984 token. Exactly one boolean is revealed and proven: escrow equals the budget — true.",
      ],
      "demo.s1.sealed": [
        "The transfer amount on the token ledger.",
        "The poster's remaining balance.",
      ],
      "demo.s2.t": "Four sealed bids",
      "demo.s2.pub": [
        "Four BidPlaced events, one per agent, each locking a 0.01 ETH bond.",
        "Each bid is one opaque ciphertext handle:",
      ],
      "demo.s2.sealed": [
        "The prices inside: ReliableRoute 420 · FreshStart 300 · SteadyHaul 510 · OverReach 1500.",
        "You can read them here only because this is a replay. On chain, nobody can.",
      ],
      "demo.s3.t": "Fold, encrypted",
      "demo.s3.pub": [
        "On every bid the contract updates three ciphertexts: lowest score, second-lowest score, winner index.",
        "Every bid costs the same fixed sequence of FHE operations — 3 compares, 5 selects. Nothing branches on a secret.",
        "OverReach bid 1500 against a budget of 1000. The fold silently neutralises it; even that fact stays invisible.",
      ],
      "demo.s3.sealed": [
        "The running lowest score (420), second-lowest (450) and winner index (0) — all three stay ciphertexts.",
      ],
      "demo.s4.t": "Close & reveal",
      "demo.s4.pub": [
        "After the deadline, exactly two handles are marked publicly decryptable.",
        "The decryption network answers: winner index 0, second-lowest score 450 — verified on-chain against its signatures. A forged value reverts.",
      ],
      "demo.s4.sealed": [
        "The lowest score is never marked decryptable.",
        "Every individual bid, including the winner's own.",
      ],
      "demo.s5.t": "Award",
      "demo.s5.pub": [
        "Winner: ReliableRoute. Price = min(second score 450 − its handicap 0, budget 1000) = 450.",
        "FreshStart had the lowest raw price, 300 — but its +150 handicap scored it 450, and it lost.",
        "ReliableRoute bid its true cost, 420, and earns 30. The price came from a rival's score, so shading its own bid could not have raised it.",
      ],
      "demo.s5.sealed": [
        "What ReliableRoute actually bid.",
      ],
      "demo.s6.t": "Deliver & settle",
      "demo.s6.pub": [
        "ReliableRoute submits a delivery hash. The evaluator approves.",
        "Two confidential transfers settle it: the winner is paid, the poster is refunded the rest, bonds are returned. A winner who never delivers loses the bond instead.",
      ],
      "demo.s6.sealed": [
        "The amounts — 450 to the winner, 550 back to the poster. Each party decrypts only its own balance.",
      ],

      "scene.poster": "Poster",
      "scene.contract": "Contract",
      "scene.escrow": "Escrow 1000",
      "scene.slot.best": "lowest score",
      "scene.slot.second": "second score",
      "scene.slot.idx": "winner index",
      "scene.upset": "+150 handicap → score 450",
      "scene.pay": "pay 450",
      "scene.refund": "refund 550",

      "try.title": "Run your own",
      "try.lede":
        "Change costs, handicaps and strategies. The page runs the contract's exact award rule on plain numbers; the contract runs it on ciphertexts. A differential test checks both against one plaintext reference, 5000 random auctions at a time.",
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
      "try.observer": "What the chain would show",
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

      "privacy.title": "Why sealed — and who sees what",
      "privacy.why.1.h": "Open bids invite undercutting.",
      "privacy.why.1.p": "On a public chain a pending bid is visible. Anyone can read it and bid just below.",
      "privacy.why.2.h": "A bid-taker who reads bids can cheat.",
      "privacy.why.2.p": "In a second-price auction, a buyer who sees the bids can slip in a shill bid and move the price.",
      "privacy.why.3.h": "A true cost is business information.",
      "privacy.why.3.p": "Agents bid honestly only if nobody — including the auctioneer — can read the bid.",
      "privacy.pub.t": "Public",
      "privacy.pub.l": [
        "Budget, deadline, bond, evaluator",
        "Who bid, and each bidder's handicap",
        "The winner and the clearing price",
        "One unattributed value: the second-lowest score",
      ],
      "privacy.sealed.t": "Never decrypted",
      "privacy.sealed.l": [
        "Every individual bid, including the winner's",
        "Every losing bidder's price",
        "Balances and amounts on the token ledger",
        "The running lowest score",
      ],
      "privacy.note":
        "VeilTender moves trust from an auctioneer to the FHE decryption network's threshold. That is a different assumption, not the absence of one.",
      "code.title": "The fold, per bid",
      "code.note": "Simplified from VeilTender._fold. Constant work per bid; no branch ever touches a secret.",

      "limits.title": "Honest limits",
      "limits.l": [
        "It does not stop bidders from colluding, and it is not sybil-proof.",
        "Participants and the final price are public; with two bidders the losing price can be inferred.",
        "It trusts a threshold of the FHE decryption network to stay honest.",
        "Handicaps are trusted inputs set at tender creation; truthfulness assumes they are exogenous.",
        "Prototype: 30 tests pass on the local FHEVM mock; not audited, not yet on a public network.",
      ],

      "facts.1": "30 passing tests, incl. a randomised differential test of the FHE fold against a plaintext reference",
      "facts.2": "Pinned stack: Solidity 0.8.27 · @fhevm/solidity 0.11.1 · ERC-7984 confidential token",
      "facts.3": "This page's rule is the contract's rule: test/webRule.ts replays 5000 random auctions against both",

      "foot.src": "Source on GitHub",
      "foot.license": "BSD-3-Clause-Clear",
      "foot.built": "Built for the ETH Shenzhen 2026 Hackathon.",
    },

    zh: {
      "doc.title": "VeilTender:面向 AI Agent 的密封投标",
      "nav.demo": "完整运行",
      "nav.try": "试玩",
      "nav.privacy": "谁能看到什么",
      "nav.github": "GitHub",

      "hero.title": "报价始终密封,只公开价格。",
      "hero.lede":
        "AI Agent 用加密报价竞标任务。合约在全同态加密下、不读取任何一份报价的情况下选出赢家,最后只公开谁赢了、报酬是多少。",
      "hero.demo": "看一次真实运行",
      "hero.code": "查看代码",

      "cipher.title": "链上为一份报价存储的全部内容",
      "cipher.event": "事件",
      "cipher.event.v": "BidPlaced,来自 {addr}",
      "cipher.handle": "密文",
      "cipher.bond": "保证金",
      "cipher.bond.v": "锁定 0.01 ETH",
      "cipher.price": "价格",
      "cipher.price.v": "永不解密",
      "cipher.note": "来自合约在本地 FHEVM mock 上的一次真实运行。",

      "value.title": "这东西真的有价值吗?",
      "value.1.h": "Agent 正在开始雇佣 Agent。",
      "value.1.p":
        "当软件 Agent 互相购买服务——算力、数据、配送、劳务——总得有东西来定价。挂牌价暴露利润空间,逐一议价无法规模化。教科书给出的答案是密封投标拍卖。",
      "value.2.h": "最诚实的拍卖,恰恰没人部署。",
      "value.2.p":
        "二价拍卖让如实报价成为最优策略——这只是纸面上的。现实中它极少被使用,经济学家从 Vickrey 开始就在问为什么(Rothkopf 等,1990):看得到报价的拍卖人可以作弊,而公链上每份报价在截止前人人可读。commit\u2013reveal 能补这个洞,但只要一个落选者拒绝揭示,拍卖就卡死。",
      "value.3.h": "FHE 把拍卖人整个移除了。",
      "value.3.p":
        "在这里,合约直接在加密报价上计算。没有拍卖人读得到报价,没有对手能对报价做出反应,也不存在需要所有人回来配合的揭示阶段。一个只活在教科书里的机制,变成了可以部署的东西。",
      "value.note":
        "具体适用:AI Agent 之间的任务市场(本演示)、供应商不愿暴露成本结构的采购招标、一次性的密封投标出售。",

      "demo.title": "完整看一场拍卖",
      "demo.lede":
        "四个 Agent,一个任务,公开预算 1000。这里回放合约在本地 FHEVM mock 上的一次真实运行。一步步看链上公开什么——以及永远不会公开什么。",
      "demo.prev": "上一步",
      "demo.next": "下一步",
      "demo.play": "自动播放",
      "demo.pause": "暂停",
      "demo.restart": "重新开始",
      "demo.pub": "链上 · 所有人可见",
      "demo.sealed": "密封 · 从不以明文出现",
      "demo.result": "ReliableRoute 获得 450。没有任何一份单独的报价被解密。",
      "demo.note": "回放内容来自 npm run demo 在本地 FHEVM mock 上生成并提交到仓库的运行记录——不是 Sepolia 部署。",
      "demo.raw": "原始运行记录",

      "demo.s1.t": "发布与托管",
      "demo.s1.pub": [
        "招标 #1 发布。预算 1000 cUSD、截止时间、0.01 ETH 保证金和评审人,全部公开。",
        "各投标者的 handicap 此刻公开固定:没有履约记录的新 Agent FreshStart 背负 +150。",
        "托管资金通过保密代币 ERC-7984 转入。只揭示并证明一个布尔值:托管金额等于预算——为真。",
      ],
      "demo.s1.sealed": ["代币账本上的转账金额。", "发布者的剩余余额。"],
      "demo.s2.t": "四份密封报价",
      "demo.s2.pub": [
        "四条 BidPlaced 事件,每个 Agent 一条,各锁定 0.01 ETH 保证金。",
        "每份报价只是一个不可读的密文句柄:",
      ],
      "demo.s2.sealed": [
        "密文里的价格:ReliableRoute 420 · FreshStart 300 · SteadyHaul 510 · OverReach 1500。",
        "你能在这里看到它们,只因为这是回放。在链上,没有人能。",
      ],
      "demo.s3.t": "密文折叠",
      "demo.s3.pub": [
        "每来一份报价,合约就更新三个密文:最低分、次低分、赢家序号。",
        "每份报价消耗完全相同的一串 FHE 运算——3 次比较、5 次选择。任何分支都不接触秘密。",
        "OverReach 报了 1500,超出预算 1000。折叠把它静默中和;连这件事本身也不可见。",
      ],
      "demo.s3.sealed": ["滚动中的最低分(420)、次低分(450)和赢家序号(0)——三者始终是密文。"],
      "demo.s4.t": "截止与开标",
      "demo.s4.pub": [
        "截止之后,恰好两个句柄被标记为可公开解密。",
        "解密网络给出:赢家序号 0、次低分 450——在链上对照其签名验证。伪造的值会被拒绝。",
      ],
      "demo.s4.sealed": ["最低分从不被标记为可解密。", "每一份单独的报价,包括赢家自己的。"],
      "demo.s5.t": "定价",
      "demo.s5.pub": [
        "赢家:ReliableRoute。价格 = min(次低分 450 − 其 handicap 0, 预算 1000) = 450。",
        "FreshStart 的原始报价最低,只有 300——但 +150 的 handicap 让它得分 450,落选。",
        "ReliableRoute 按真实成本 420 报价,赚得 30。价格来自对手的得分,虚报自己的价格不可能让它多赚。",
      ],
      "demo.s5.sealed": ["ReliableRoute 实际报了多少。"],
      "demo.s6.t": "交付与结算",
      "demo.s6.pub": [
        "ReliableRoute 提交交付哈希,评审人确认。",
        "两笔保密转账完成结算:赢家获得报酬,发布者拿回剩余预算,保证金退还。从不交付的赢家则会失去保证金。",
      ],
      "demo.s6.sealed": ["金额本身——450 给赢家,550 退回发布者。每一方只能解密自己的余额。"],

      "scene.poster": "发布者",
      "scene.contract": "合约",
      "scene.escrow": "托管 1000",
      "scene.slot.best": "最低分",
      "scene.slot.second": "次低分",
      "scene.slot.idx": "赢家序号",
      "scene.upset": "handicap +150 → 得分 450",
      "scene.pay": "支付 450",
      "scene.refund": "退回 550",

      "try.title": "亲手跑一场",
      "try.lede":
        "修改成本、handicap 和策略。页面在普通数字上运行合约的同一条定标规则,合约在密文上运行它。差分测试用 5000 场随机拍卖同时核对两者与同一份明文参考实现。",
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
      "try.observer": "链上会显示什么",
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

      "privacy.title": "为什么密封——以及谁能看到什么",
      "privacy.why.1.h": "公开报价招来压价。",
      "privacy.why.1.p": "公链上待确认的报价是可见的,任何人都能读到并报一个略低的价格。",
      "privacy.why.2.h": "看得到报价的招标方可以作弊。",
      "privacy.why.2.p": "在二价拍卖里,看得到报价的买家可以塞入托价,改变自己要付的价格。",
      "privacy.why.3.h": "真实成本是商业信息。",
      "privacy.why.3.p": "只有在没人——包括拍卖人——能读到报价时,Agent 才会如实报价。",
      "privacy.pub.t": "公开",
      "privacy.pub.l": [
        "预算、截止时间、保证金、评审人",
        "谁投了标,以及各自的 handicap",
        "赢家与成交价",
        "一个无归属的数值:次低分",
      ],
      "privacy.sealed.t": "从不解密",
      "privacy.sealed.l": [
        "每一份单独的报价,包括赢家的",
        "每个落选者的价格",
        "代币账本上的余额与金额",
        "滚动中的最低分",
      ],
      "privacy.note": "VeilTender 把信任从拍卖人转移到 FHE 解密网络的阈值假设上。这是另一种假设,而不是不再需要假设。",
      "code.title": "每份报价的折叠",
      "code.note": "由 VeilTender._fold 简化而来。每份报价计算量恒定,任何分支都不接触秘密。",

      "limits.title": "诚实的边界",
      "limits.l": [
        "不能阻止投标方串谋,也不防女巫攻击。",
        "参与者与成交价公开;只有两个投标者时,落选价可被推断。",
        "依赖 FHE 解密网络的阈值诚实假设。",
        "handicap 是创建招标时设定的受信输入;如实报价的结论以其外生为前提。",
        "原型:30 项测试在本地 FHEVM mock 上通过;未经审计,尚未部署公共网络。",
      ],

      "facts.1": "30 项测试通过,含 FHE 折叠与明文参考实现的随机差分测试",
      "facts.2": "锁定技术栈:Solidity 0.8.27 · @fhevm/solidity 0.11.1 · ERC-7984 保密代币",
      "facts.3": "页面规则就是合约规则:test/webRule.ts 用 5000 场随机拍卖同时核对两者",

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
    if (Array.isArray(s)) return s.slice();
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  root.VeilI18n = { t: t, languages: Object.keys(T) };
})(typeof window !== "undefined" ? window : this);
