// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @notice TEST / DEMO ONLY. A confidential ERC-7984 token with an open faucet, used so the demo
///         and the test-suite do not depend on any third-party wrapper. Not for production use.
contract ConfidentialUSD is ZamaEthereumConfig, ERC7984 {
    uint64 public constant MAX_FAUCET = 1_000_000_000; // 1000 units at 6 decimals

    constructor() ERC7984("Confidential Demo USD", "cDUSD", "") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint up to MAX_FAUCET base units to the caller.
    function faucet(uint64 amount) external {
        require(amount <= MAX_FAUCET, "faucet cap");
        _mint(msg.sender, FHE.asEuint64(amount));
    }
}
