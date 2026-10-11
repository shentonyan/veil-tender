# Sources and verification status

Versions were read from the npm registry and the published package sources on 2026-10-11. Nothing below is from
memory unless marked.

## Verified

- Zama Protocol documentation: https://docs.zama.org/protocol
  - Public decryption flow (make a handle publicly decryptable, obtain the cleartext and proof from the relayer,
    verify on-chain with `FHE.checkSignatures`): https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle
  - Conditions: `FHE.select`, no `if` on encrypted booleans.
  - HCU limits (the page labels them "current devnet"): https://docs.zama.org/protocol/solidity-guides/development-guide/hcu.md
- npm packages (versions used here): `@fhevm/solidity` 0.11.1, `@fhevm/hardhat-plugin` 0.4.2,
  `@fhevm/mock-utils` 0.4.2, `@openzeppelin/confidential-contracts` 0.5.3, `encrypted-types` 0.0.4.
- Hardhat template: https://github.com/zama-ai/fhevm-hardhat-template
- ERC-7984 (Draft): https://eips.ethereum.org/EIPS/eip-7984
- Che (1993), RAND Journal of Economics 24(4), 668-680 (abstract read).
- Lucking-Reiley (2000), Journal of Economic Perspectives 14(3), 183-192.
- Rothkopf (2007), Operations Research 55(2), 191-197 (listing).
- Naor, Pinkas, Sumner, "Privacy Preserving Auctions and Mechanism Design" (paper read; venue not confirmed).

## Cited from memory, page numbers not re-checked

- Vickrey (1961), Journal of Finance 16(1).
- Myerson (1981), Mathematics of Operations Research 6(1).
- Rothkopf, Teisberg and Kahn (1990), Journal of Political Economy 98(1).

## Not verified

- Behaviour of `@fhevm/solidity` 0.13.x with the Hardhat plugin and OpenZeppelin package (not tested; 0.11.1 is
  pinned).
- Sepolia: decryption latency, the per-block FHE compute cap, real gas, and whether the Zama faucet and wrapper
  tokens are currently usable.
- `@zama-fhe/relayer-sdk` is marked deprecated in favour of `@zama-fhe/sdk`. The Hardhat plugin still uses the
  old one, and this project does not call either directly.
- ERC-8183, ERC-8004, ERC-8195, ERC-8414 and x402 were read through a summarising fetcher, not the raw text. This
  project does not depend on them.
