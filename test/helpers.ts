import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { ConfidentialUSD, VeilTender } from "../types";

export const Phase = {
  None: 0n,
  Funding: 1n,
  Open: 2n,
  Reveal: 3n,
  Awarded: 4n,
  Delivered: 5n,
  Settled: 6n,
  Defaulted: 7n,
  Rejected: 8n,
  Cancelled: 9n,
} as const;

export const NONE = 0xffffffff;
export const SCORE_SENT = 1n << 62n;
export const HOUR = 3600;

export async function deployAll() {
  const tokenFactory = await ethers.getContractFactory("ConfidentialUSD");
  const token = (await tokenFactory.deploy()) as unknown as ConfidentialUSD;
  await token.waitForDeployment();
  const tenderFactory = await ethers.getContractFactory("VeilTender");
  const tender = (await tenderFactory.deploy(await token.getAddress())) as unknown as VeilTender;
  await tender.waitForDeployment();
  return { token, tender, tokenAddress: await token.getAddress(), tenderAddress: await tender.getAddress() };
}

/** Mint `amount` base units to `user` and let the tender pull from them. */
export async function prepareWallet(
  token: ConfidentialUSD,
  tenderAddress: string,
  user: HardhatEthersSigner,
  amount: bigint,
) {
  await (await token.connect(user).faucet(amount)).wait();
  const until = (await time.latest()) + 365 * 24 * HOUR;
  await (await token.connect(user).setOperator(tenderAddress, until)).wait();
}

export async function balanceOf(token: ConfidentialUSD, who: HardhatEthersSigner): Promise<bigint> {
  const handle = await token.confidentialBalanceOf(who.address);
  if (handle === ethers.ZeroHash) return 0n;
  return fhevm.userDecryptEuint(FhevmType.euint64, handle, await token.getAddress(), who);
}

export interface TenderParams {
  budget: bigint;
  deadlineIn?: number; // seconds from now
  executionPeriod?: number;
  reviewPeriod?: number;
  bondWei?: bigint;
  evaluator?: string;
  allowed?: string[];
  handicaps?: bigint[];
}

/** Create a tender, fund it, and confirm funding through public decryption. Returns its id. */
export async function openTender(
  tender: VeilTender,
  token: ConfidentialUSD,
  tenderAddress: string,
  poster: HardhatEthersSigner,
  p: TenderParams,
): Promise<bigint> {
  await prepareWallet(token, tenderAddress, poster, p.budget);
  const deadline = BigInt((await time.latest()) + (p.deadlineIn ?? HOUR));
  const tx = await tender
    .connect(poster)
    .createTender(
      p.budget,
      deadline,
      p.executionPeriod ?? 7 * 24 * HOUR,
      p.reviewPeriod ?? 3 * 24 * HOUR,
      p.bondWei ?? 0n,
      p.evaluator ?? ethers.ZeroAddress,
      p.allowed ?? [],
      p.handicaps ?? [],
    );
  await tx.wait();
  const id = await tender.tenderCount();
  await (await tender.connect(poster).fund(id)).wait();
  const okHandle = await tender.fundOkHandle(id);
  const dec = await fhevm.publicDecrypt([okHandle]);
  await (await tender.confirmFunding(id, Boolean(dec.clearValues[okHandle as `0x${string}`]), dec.decryptionProof)).wait();
  return id;
}

export async function placeBid(
  tender: VeilTender,
  tenderAddress: string,
  id: bigint,
  bidder: HardhatEthersSigner,
  price: bigint,
  bondWei = 0n,
) {
  const input = await fhevm.createEncryptedInput(tenderAddress, bidder.address).add64(price).encrypt();
  return tender.connect(bidder).bid(id, input.handles[0], input.inputProof, { value: bondWei });
}

/** Move past the deadline, request the reveal, decrypt (winner index, second score) and finalize. */
export async function revealAndFinalize(tender: VeilTender, id: bigint) {
  const t = await tender.getTender(id);
  await time.increaseTo(t.bidDeadline);
  await (await tender.requestReveal(id)).wait();
  const [wHandle, sHandle] = await tender.revealHandles(id);
  const dec = await fhevm.publicDecrypt([wHandle, sHandle]);
  const w = BigInt(dec.clearValues[wHandle as `0x${string}`] as bigint);
  const s = BigInt(dec.clearValues[sHandle as `0x${string}`] as bigint);
  await (await tender.finalize(id, w, s, dec.decryptionProof)).wait();
  return { winnerIdx: w, secondScore: s };
}

/** Plaintext reference implementation of the award rule, for differential testing. */
export function referenceAward(bids: bigint[], budget: bigint, handicaps: bigint[]) {
  const scored = bids
    .map((b, i) => ({ i, score: b <= budget ? b + handicaps[i] : null }))
    .filter((x): x is { i: number; score: bigint } => x.score !== null)
    .sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : a.i - b.i));
  if (scored.length === 0) return { winner: null as number | null, price: 0n };
  const w = scored[0];
  let price = budget;
  if (scored.length > 1) {
    const threshold = scored[1].score - handicaps[w.i];
    if (threshold < price) price = threshold;
  }
  return { winner: w.i as number | null, price };
}
