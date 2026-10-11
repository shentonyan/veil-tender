/**
 * End-to-end demo: four AI agents compete for one task, bidding ENCRYPTED prices.
 *
 *   npm run demo                                         # local FHEVM mock (fast, no network)
 *   npx hardhat test demo/run-demo.ts --network sepolia  # real FHE on Sepolia (needs funded account + RPC)
 *
 * On the mock network the run is also written to web/transcript.json and web/transcript.js
 * (the demo site in web/ replays it). Nothing is written for other networks.
 */
import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import * as fs from "fs";
import { ethers, fhevm, network } from "hardhat";
import * as path from "path";
import type { ConfidentialUSD, VeilTender } from "../types";

const U = 1_000_000n; // 6-decimal token units
const fmt = (n: bigint) => `${Number(n) / 1e6}`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Step {
  title: string;
  actor: string;
  public: string[]; // what any observer of the chain can see
  private?: string[]; // what only the acting party knows
}

async function waitUntil(ts: bigint) {
  if (fhevm.isMock) {
    await time.increaseTo(ts);
    return;
  }
  for (;;) {
    const block = await ethers.provider.getBlock("latest");
    if (BigInt(block!.timestamp) >= ts) return;
    await sleep(5000);
  }
}

async function main() {
  const signers = await ethers.getSigners();
  const poster = signers[0];

  // agent wallets: on mock reuse the default accounts, on a live network derive and fund them
  let wallets: (typeof poster)[];
  if (fhevm.isMock) {
    wallets = signers.slice(1, 5);
  } else {
    const derived = [1, 2, 3, 4].map((i) => ethers.Wallet.createRandom().connect(ethers.provider));
    for (const w of derived) {
      await (await poster.sendTransaction({ to: w.address, value: ethers.parseEther("0.01") })).wait();
    }
    wallets = derived as unknown as (typeof poster)[];
  }

  const agents = [
    { name: "ReliableRoute", cost: 420n * U, handicap: 0n, note: "high-reputation agent" },
    { name: "FreshStart", cost: 300n * U, handicap: 150n * U, note: "new agent, no track record: handicap 150" },
    { name: "SteadyHaul", cost: 510n * U, handicap: 0n, note: "high-reputation agent" },
    { name: "OverReach", cost: 1500n * U, handicap: 0n, note: "cost above the budget" },
  ];
  const budget = 1000n * U;
  const bond = ethers.parseEther(fhevm.isMock ? "0.01" : "0.0005");
  const steps: Step[] = [];

  // deploy
  const token = (await (await ethers.getContractFactory("ConfidentialUSD")).deploy()) as unknown as ConfidentialUSD;
  await token.waitForDeployment();
  const tender = (await (await ethers.getContractFactory("VeilTender")).deploy(
    await token.getAddress(),
  )) as unknown as VeilTender;
  await tender.waitForDeployment();
  const tenderAddress = await tender.getAddress();
  console.log(`ConfidentialUSD ${await token.getAddress()}\nVeilTender      ${tenderAddress}\n`);

  // 1. poster funds the escrow
  await (await token.connect(poster).faucet(budget)).wait();
  const latest = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  await (await token.connect(poster).setOperator(tenderAddress, Number(latest) + 30 * 86400)).wait();
  const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  const deadline = now + (fhevm.isMock ? 3600n : 240n);
  await (
    await tender.connect(poster).createTender(
      budget,
      deadline,
      7 * 86400,
      3 * 86400,
      bond,
      ethers.ZeroAddress,
      wallets.map((w) => w.address),
      agents.map((a) => a.handicap),
    )
  ).wait();
  const id = await tender.tenderCount();
  await (await tender.connect(poster).fund(id)).wait();
  const okHandle = await tender.fundOkHandle(id);
  const funding = await fhevm.publicDecrypt([okHandle]);
  await (await tender.confirmFunding(id, Boolean(funding.clearValues[okHandle as `0x${string}`]), funding.decryptionProof)).wait();
  steps.push({
    title: "Task posted and escrow funded",
    actor: "Poster",
    public: [
      `Tender #${id}: public budget ${fmt(budget)} cDUSD, bidding closes at a fixed time`,
      `Escrow moved into the contract through the confidential token: the transfer amount is encrypted on the token ledger`,
      `Only one boolean was revealed: "escrow holds the full budget" = true`,
      `Handicaps are public: ${agents.map((a, i) => `${short(wallets[i].address)}=${fmt(a.handicap)}`).join(", ")}`,
    ],
  });
  console.log(`Tender #${id} funded. Budget ${fmt(budget)} cDUSD.\n`);

  // 2. agents bid their true cost, encrypted
  const bidLines: string[] = [];
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const input = await fhevm.createEncryptedInput(tenderAddress, wallets[i].address).add64(a.cost).encrypt();
    await (await tender.connect(wallets[i]).bid(id, input.handles[0], input.inputProof, { value: bond })).wait();
    const handle = ethers.hexlify(input.handles[0]);
    bidLines.push(`${short(wallets[i].address)} submitted ciphertext ${handle.slice(0, 18)}…`);
    steps.push({
      title: `${a.name} bids`,
      actor: a.name,
      public: [`BidPlaced event from ${short(wallets[i].address)}`, `Encrypted input handle ${handle.slice(0, 18)}… (opaque)`, `Bond of ${ethers.formatEther(bond)} ETH locked`],
      private: [`True cost ${fmt(a.cost)} cDUSD, bids exactly that (truthful bidding is the dominant strategy)`, a.note],
    });
    console.log(`${a.name.padEnd(14)} bid (encrypted)  | private cost ${fmt(a.cost)}  ${a.note}`);
  }

  // 3. what an outside observer can learn before the reveal
  const best = await tender.bestScoreHandle(id);
  let bestLeak = "not decryptable";
  try {
    await fhevm.publicDecrypt([best]);
    bestLeak = "DECRYPTABLE (privacy bug!)";
  } catch {
    /* expected */
  }
  steps.push({
    title: "Observer tries to read the running lowest score",
    actor: "Observer",
    public: [`Running lowest score is the opaque handle ${best.slice(0, 18)}…`, `Public decryption request: ${bestLeak}`],
  });
  console.log(`\nObserver asks the network to decrypt the running lowest score: ${bestLeak}`);

  // 4. reveal winner index + second score only
  await waitUntil((await tender.getTender(id)).bidDeadline);
  await (await tender.requestReveal(id)).wait();
  const [wHandle, sHandle] = await tender.revealHandles(id);
  const dec = await fhevm.publicDecrypt([wHandle, sHandle]);
  const winnerIdx = BigInt(dec.clearValues[wHandle as `0x${string}`] as bigint);
  const secondScore = BigInt(dec.clearValues[sHandle as `0x${string}`] as bigint);
  await (await tender.finalize(id, winnerIdx, secondScore, dec.decryptionProof)).wait();
  const t = await tender.getTender(id);
  const winnerAgent = agents[Number(winnerIdx)];
  steps.push({
    title: "Deadline: only two values are decrypted",
    actor: "Anyone",
    public: [
      `Revealed winner index ${winnerIdx} → ${short(t.winner)}`,
      `Revealed second-lowest score ${fmt(secondScore)}; clearing price = second score − winner handicap = ${fmt(t.price)} cDUSD`,
      `Verified on-chain against the KMS signatures (FHE.checkSignatures). Nobody can forge a winner or price`,
      `No individual bid, and no losing bidder's price, was ever decrypted`,
    ],
  });
  console.log(`\nWinner: ${winnerAgent.name} (${short(t.winner)})  price ${fmt(t.price)} cDUSD  (second score ${fmt(secondScore)})`);
  console.log(`  ${winnerAgent.name}'s own cost was ${fmt(winnerAgent.cost)} → surplus ${fmt(t.price - winnerAgent.cost)}`);
  const cheapest = agents.reduce((m, a) => (a.cost < m.cost ? a : m));
  console.log(`  Lowest raw price was ${cheapest.name} at ${fmt(cheapest.cost)}, but its handicap ${fmt(cheapest.handicap)} gave it the worse score`);

  // 5. delivery and payout
  const winnerWallet = wallets[Number(winnerIdx)];
  await (await tender.connect(winnerWallet).submitDelivery(id, ethers.keccak256(ethers.toUtf8Bytes("deliverable-v1")))).wait();
  await (await tender.connect(poster).approve(id)).wait();
  const read = async (who: typeof poster) => {
    const h = await token.confidentialBalanceOf(who.address);
    return h === ethers.ZeroHash ? 0n : await fhevm.userDecryptEuint(FhevmType.euint64, h, await token.getAddress(), who);
  };
  const winnerBal = await read(winnerWallet);
  const posterBal = await read(poster);
  steps.push({
    title: "Delivery approved, escrow settled",
    actor: "Poster",
    public: ["Settled event; token balances and transfer amounts stay encrypted on the token ledger"],
    private: [`Winner decrypts own balance: ${fmt(winnerBal)} cDUSD`, `Poster decrypts own balance: ${fmt(posterBal)} cDUSD (refund of budget − price)`],
  });
  console.log(`\nSettled. Winner balance ${fmt(winnerBal)}, poster refund ${fmt(posterBal)} (each decrypted by its owner only)`);

  if (fhevm.isMock) {
    const out = {
      network: network.name,
      note: "Replay of a local FHEVM-mock run. Generated by demo/run-demo.ts",
      budget: fmt(budget),
      agents: agents.map((a, i) => ({ name: a.name, address: short(wallets[i].address), handicap: fmt(a.handicap), cost: fmt(a.cost), note: a.note })),
      result: { winner: winnerAgent.name, price: fmt(t.price), secondScore: fmt(secondScore) },
      steps,
    };
    const webDir = path.join(__dirname, "..", "web");
    fs.mkdirSync(webDir, { recursive: true });
    fs.writeFileSync(path.join(webDir, "transcript.json"), JSON.stringify(out, null, 2) + "\n");
    // "<" is escaped so no transcript string can close a <script> block
    const json = JSON.stringify(out).replace(/</g, "\\u003c");
    fs.writeFileSync(path.join(webDir, "transcript.js"), `window.VEIL_TRANSCRIPT = ${json};\n`);
    console.log("\nWrote web/transcript.json and web/transcript.js (the demo site replays them)");
  }
}

// Driven through `hardhat test` so the same code runs on the in-process FHEVM mock and on Sepolia.
describe("demo: four agents, one encrypted auction", function () {
  it("runs end to end", async function () {
    this.timeout(30 * 60 * 1000);
    await main();
  });
});
