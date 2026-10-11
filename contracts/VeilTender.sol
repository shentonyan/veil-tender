// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint32, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VeilTender
/// @notice Confidential sealed-bid TASK auction for AI agents.
///
///  - A poster escrows a public budget B in an ERC-7984 confidential token.
///  - Agents submit ENCRYPTED prices. The contract folds each bid, homomorphically and without any
///    branch on a ciphertext, into three encrypted values: lowest score, second-lowest score, and the
///    index of the lowest. Individual bids are never stored and never marked decryptable.
///  - After the deadline only (winner index, second-lowest score) are publicly decrypted and
///    verified on-chain with FHE.checkSignatures. The winner is paid the Vickrey-style threshold
///    price: second-lowest score minus the winner's own handicap, capped at B.
///  - score = bid + handicap, where handicap is a PUBLIC per-bidder number snapshotted at tender
///    creation (e.g. derived off-chain from an ERC-8004 reputation summary). handicap = 0 for all
///    bidders gives a plain lowest-bid-wins reverse Vickrey auction.
///  - Delivery is guarded by a native-currency bond posted with each bid (slashed on default).
///
/// What is private: every individual bid, the losing bidders' prices (only the unattributed
/// second-lowest score is revealed), and all token balances / transfer amounts on the token ledger.
/// What is public: budget, participants, handicaps, winner, clearing price, lifecycle.
contract VeilTender is ZamaEthereumConfig, ReentrancyGuard {
    // ------------------------------------------------------------------ constants

    /// @dev Budgets are bounded so that bid + handicap can never wrap a uint64 and so that
    ///      SCORE_SENT is strictly above every valid score.
    uint64 public constant MAX_BUDGET = (1 << 40) - 1;
    /// @dev Sentinel for "no valid bid yet". Strictly greater than any valid score (< 2^41).
    uint64 public constant SCORE_SENT = 1 << 62;
    uint32 public constant NONE = type(uint32).max;
    uint256 public constant MAX_BIDDERS = 255;
    uint256 public constant MAX_ALLOWLIST = 64;

    enum Phase {
        None,
        Funding, // created, waiting for the escrow to be funded and confirmed
        Open, // accepting encrypted bids
        Reveal, // deadline passed, winner index + second score are publicly decryptable
        Awarded, // winner known, waiting for delivery
        Delivered, // winner submitted a delivery hash, waiting for evaluator
        Settled, // paid
        Defaulted, // winner never delivered; bond slashed, escrow refunded
        Rejected, // evaluator rejected delivery; bond slashed, escrow refunded
        Cancelled // nobody (valid) bid or poster cancelled; escrow refunded
    }

    struct Tender {
        address poster;
        address evaluator;
        Phase phase;
        bool restricted; // allowlist mode (handicaps apply to listed bidders only)
        bool fundAttempted;
        uint64 budget;
        uint64 bidDeadline;
        uint32 executionPeriod;
        uint32 reviewPeriod;
        uint256 bondWei;
        // award data (public after finalize)
        address winner;
        uint64 price;
        uint64 deliveryDeadline;
        uint64 reviewDeadline;
        bytes32 deliveryHash;
    }

    /// @dev Encrypted per-tender state. Only `best`, `second` are never revealed except `second`.
    struct EncState {
        euint64 best; // lowest score so far   (NEVER made publicly decryptable)
        euint64 second; // second-lowest score    (revealed at finalize)
        euint32 winnerIdx; // index of lowest score  (revealed at finalize)
        ebool fundOk; // moved == budget        (revealed at funding confirmation)
        euint64 fundMoved; // amount the token really moved at funding
    }

    // ------------------------------------------------------------------ storage

    IERC7984 public immutable token;
    uint256 public tenderCount;

    mapping(uint256 => Tender) private _tenders;
    mapping(uint256 => EncState) private _enc;
    mapping(uint256 => address[]) private _bidders;
    mapping(uint256 => mapping(address => bool)) public hasBid;
    mapping(uint256 => mapping(address => bool)) public isAllowed;
    mapping(uint256 => mapping(address => uint64)) public handicapOf;
    mapping(uint256 => mapping(address => uint256)) public bondOf;
    mapping(address => uint256) public pendingEth;

    // ------------------------------------------------------------------ events

    event TenderCreated(
        uint256 indexed id,
        address indexed poster,
        uint64 budget,
        uint64 bidDeadline,
        address evaluator,
        uint256 bondWei,
        bool restricted
    );
    event FundingAttempted(uint256 indexed id, bytes32 fundOkHandle);
    event Funded(uint256 indexed id);
    event BidPlaced(uint256 indexed id, address indexed bidder, uint32 index);
    event RevealRequested(uint256 indexed id, bytes32 winnerIdxHandle, bytes32 secondScoreHandle);
    event Awarded(uint256 indexed id, address indexed winner, uint64 price);
    event DeliverySubmitted(uint256 indexed id, bytes32 deliveryHash);
    event Settled(uint256 indexed id, address indexed winner, uint64 price);
    event Defaulted(uint256 indexed id, address indexed winner);
    event Rejected(uint256 indexed id, address indexed winner);
    event Cancelled(uint256 indexed id);
    event BondWithdrawn(uint256 indexed id, address indexed bidder, uint256 amount);

    // ------------------------------------------------------------------ errors

    error BadPhase(Phase have);
    error NotPoster();
    error NotEvaluator();
    error NotWinner();
    error BadParams();
    error NotAllowed();
    error PosterCannotBid();
    error AlreadyBid();
    error WrongBond();
    error TooLate();
    error TooEarly();
    error NothingToWithdraw();

    constructor(IERC7984 payToken) {
        token = payToken;
    }

    // ------------------------------------------------------------------ create & fund

    /// @param budget       public maximum price B, in token base units (< 2^40)
    /// @param bidDeadline  unix time after which no bids are accepted
    /// @param executionPeriod seconds the winner has to deliver after the award
    /// @param reviewPeriod seconds the evaluator has to decide after delivery (silence = approval)
    /// @param bondWei      native-currency bond each bidder must post with its bid
    /// @param evaluator    who approves/rejects delivery (0 = poster). Visible to bidders before they bid.
    /// @param allowed      optional bidder allowlist (empty = open to anyone with handicap 0)
    /// @param handicaps    public handicap per allowlisted bidder, in token base units
    function createTender(
        uint64 budget,
        uint64 bidDeadline,
        uint32 executionPeriod,
        uint32 reviewPeriod,
        uint256 bondWei,
        address evaluator,
        address[] calldata allowed,
        uint64[] calldata handicaps
    ) external returns (uint256 id) {
        if (budget == 0 || budget > MAX_BUDGET) revert BadParams();
        if (bidDeadline <= block.timestamp) revert BadParams();
        if (executionPeriod == 0 || reviewPeriod == 0) revert BadParams();
        if (allowed.length != handicaps.length || allowed.length > MAX_ALLOWLIST) revert BadParams();

        id = ++tenderCount;
        Tender storage t = _tenders[id];
        t.poster = msg.sender;
        t.evaluator = evaluator == address(0) ? msg.sender : evaluator;
        t.phase = Phase.Funding;
        t.budget = budget;
        t.bidDeadline = bidDeadline;
        t.executionPeriod = executionPeriod;
        t.reviewPeriod = reviewPeriod;
        t.bondWei = bondWei;
        t.restricted = allowed.length > 0;

        for (uint256 i = 0; i < allowed.length; i++) {
            if (allowed[i] == address(0) || isAllowed[id][allowed[i]]) revert BadParams();
            if (handicaps[i] > MAX_BUDGET) revert BadParams();
            isAllowed[id][allowed[i]] = true;
            handicapOf[id][allowed[i]] = handicaps[i];
        }

        EncState storage e = _enc[id];
        e.best = FHE.asEuint64(SCORE_SENT);
        e.second = FHE.asEuint64(SCORE_SENT);
        e.winnerIdx = FHE.asEuint32(NONE);
        FHE.allowThis(e.best);
        FHE.allowThis(e.second);
        FHE.allowThis(e.winnerIdx);

        emit TenderCreated(id, msg.sender, budget, bidDeadline, t.evaluator, bondWei, t.restricted);
    }

    /// @notice Pull the budget into escrow. The poster must first call
    ///         `token.setOperator(address(this), until)`. Because a confidential transfer with
    ///         insufficient balance silently moves 0, the real moved amount is compared with the
    ///         budget under encryption and only that one boolean is revealed (confirmFunding).
    function fund(uint256 id) external {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Funding) revert BadPhase(t.phase);
        if (msg.sender != t.poster) revert NotPoster();
        if (t.fundAttempted) revert BadPhase(t.phase);

        euint64 amount = FHE.asEuint64(t.budget);
        FHE.allowTransient(amount, address(token));
        euint64 moved = token.confidentialTransferFrom(msg.sender, address(this), amount);
        FHE.allowThis(moved);

        ebool ok = FHE.eq(moved, t.budget);
        FHE.allowThis(ok);
        FHE.makePubliclyDecryptable(ok);

        EncState storage e = _enc[id];
        e.fundMoved = moved;
        e.fundOk = ok;
        t.fundAttempted = true;
        emit FundingAttempted(id, FHE.toBytes32(ok));
    }

    /// @notice Anyone may submit the publicly decrypted funding result together with its proof.
    function confirmFunding(uint256 id, bool ok, bytes calldata proof) external {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Funding || !t.fundAttempted) revert BadPhase(t.phase);

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_enc[id].fundOk);
        FHE.checkSignatures(handles, abi.encode(ok), proof);

        if (ok) {
            t.phase = Phase.Open;
            emit Funded(id);
        } else {
            // the token moved 0, so nothing is locked: allow another attempt
            t.fundAttempted = false;
        }
    }

    /// @notice Poster abandons the tender before any bid. Refunds whatever was escrowed.
    function cancel(uint256 id) external nonReentrant {
        Tender storage t = _tenders[id];
        if (msg.sender != t.poster) revert NotPoster();
        if (t.phase == Phase.Funding) {
            t.phase = Phase.Cancelled;
            if (t.fundAttempted) {
                // refund exactly what the token moved (an encrypted amount, possibly 0)
                euint64 moved = _enc[id].fundMoved;
                FHE.allowTransient(moved, address(token));
                token.confidentialTransfer(t.poster, moved);
            }
        } else if (t.phase == Phase.Open && _bidders[id].length == 0) {
            t.phase = Phase.Cancelled;
            _payOut(t.poster, t.budget);
        } else {
            revert BadPhase(t.phase);
        }
        emit Cancelled(id);
    }

    // ------------------------------------------------------------------ bidding

    /// @notice Submit an encrypted price. Constant FHE operation count regardless of the value,
    ///         no revert depends on the ciphertext (an over-budget bid is silently neutralised).
    function bid(uint256 id, externalEuint64 encPrice, bytes calldata inputProof) external payable {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Open) revert BadPhase(t.phase);
        if (block.timestamp >= t.bidDeadline) revert TooLate();
        if (msg.value != t.bondWei) revert WrongBond();
        if (msg.sender == t.poster || msg.sender == t.evaluator) revert PosterCannotBid();
        if (hasBid[id][msg.sender]) revert AlreadyBid();
        if (t.restricted && !isAllowed[id][msg.sender]) revert NotAllowed();
        address[] storage list = _bidders[id];
        if (list.length >= MAX_BIDDERS) revert BadParams();

        uint32 idx = uint32(list.length);
        list.push(msg.sender);
        hasBid[id][msg.sender] = true;
        bondOf[id][msg.sender] = msg.value;

        _fold(id, FHE.fromExternal(encPrice, inputProof), t.budget, handicapOf[id][msg.sender], idx);

        emit BidPlaced(id, msg.sender, idx);
    }

    // ------------------------------------------------------------------ reveal & award

    /// @notice After the deadline, mark ONLY the winner index and the second score decryptable.
    function requestReveal(uint256 id) external {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Open) revert BadPhase(t.phase);
        if (block.timestamp < t.bidDeadline) revert TooEarly();

        if (_bidders[id].length == 0) {
            t.phase = Phase.Cancelled;
            _payOut(t.poster, t.budget);
            emit Cancelled(id);
            return;
        }

        EncState storage e = _enc[id];
        FHE.makePubliclyDecryptable(e.winnerIdx);
        FHE.makePubliclyDecryptable(e.second);
        t.phase = Phase.Reveal;
        emit RevealRequested(id, FHE.toBytes32(e.winnerIdx), FHE.toBytes32(e.second));
    }

    /// @notice Anyone may finalize with the publicly decrypted values and the KMS proof.
    function finalize(uint256 id, uint32 winnerIdx, uint64 secondScore, bytes calldata proof) external {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Reveal) revert BadPhase(t.phase);

        EncState storage e = _enc[id];
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(e.winnerIdx);
        handles[1] = FHE.toBytes32(e.second);
        FHE.checkSignatures(handles, abi.encode(winnerIdx, secondScore), proof);

        if (winnerIdx == NONE) {
            // every bid was over budget
            t.phase = Phase.Cancelled;
            _payOut(t.poster, t.budget);
            emit Cancelled(id);
            return;
        }

        address winner = _bidders[id][winnerIdx];
        uint64 price = t.budget; // a single valid bid faces the budget as a phantom competitor
        if (secondScore < SCORE_SENT) {
            uint64 threshold = secondScore - handicapOf[id][winner];
            if (threshold < price) price = threshold;
        }

        t.winner = winner;
        t.price = price;
        t.phase = Phase.Awarded;
        t.deliveryDeadline = uint64(block.timestamp) + t.executionPeriod;
        emit Awarded(id, winner, price);
    }

    // ------------------------------------------------------------------ delivery & settlement

    function submitDelivery(uint256 id, bytes32 deliveryHash) external {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Awarded) revert BadPhase(t.phase);
        if (msg.sender != t.winner) revert NotWinner();
        if (block.timestamp > t.deliveryDeadline) revert TooLate();
        t.deliveryHash = deliveryHash;
        t.reviewDeadline = uint64(block.timestamp) + t.reviewPeriod;
        t.phase = Phase.Delivered;
        emit DeliverySubmitted(id, deliveryHash);
    }

    /// @notice Evaluator approves: winner is paid `price`, poster gets `budget - price` back.
    function approve(uint256 id) external nonReentrant {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Delivered) revert BadPhase(t.phase);
        if (msg.sender != t.evaluator) revert NotEvaluator();
        _settle(id, t);
    }

    /// @notice If the evaluator stays silent past the review window, anyone can settle in the
    ///         winner's favour.
    function settleAfterReview(uint256 id) external nonReentrant {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Delivered) revert BadPhase(t.phase);
        if (block.timestamp <= t.reviewDeadline) revert TooEarly();
        _settle(id, t);
    }

    /// @notice Evaluator rejects the delivery inside the review window.
    function reject(uint256 id) external nonReentrant {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Delivered) revert BadPhase(t.phase);
        if (msg.sender != t.evaluator) revert NotEvaluator();
        if (block.timestamp > t.reviewDeadline) revert TooLate();
        t.phase = Phase.Rejected;
        _slashWinnerAndRefund(id, t);
        emit Rejected(id, t.winner);
    }

    /// @notice Winner did not deliver in time: anyone can trigger the default.
    function claimDefault(uint256 id) external nonReentrant {
        Tender storage t = _tenders[id];
        if (t.phase != Phase.Awarded) revert BadPhase(t.phase);
        if (block.timestamp <= t.deliveryDeadline) revert TooEarly();
        t.phase = Phase.Defaulted;
        _slashWinnerAndRefund(id, t);
        emit Defaulted(id, t.winner);
    }

    /// @notice Withdraw a bond. Losers once the award is known; the winner after settlement;
    ///         everyone if the tender was cancelled. A slashed bond is gone (credited to the poster).
    function withdrawBond(uint256 id) external nonReentrant {
        Tender storage t = _tenders[id];
        Phase p = t.phase;
        bool released;
        if (p == Phase.Cancelled || p == Phase.Settled) {
            released = true;
        } else if (p == Phase.Awarded || p == Phase.Delivered || p == Phase.Defaulted || p == Phase.Rejected) {
            released = msg.sender != t.winner;
        }
        uint256 amount = bondOf[id][msg.sender];
        if (!released || amount == 0) revert NothingToWithdraw();
        bondOf[id][msg.sender] = 0;
        _sendEth(msg.sender, amount);
        emit BondWithdrawn(id, msg.sender, amount);
    }

    /// @notice Withdraw native currency credited to you (slashed bonds).
    function withdrawPending() external nonReentrant {
        uint256 amount = pendingEth[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingEth[msg.sender] = 0;
        _sendEth(msg.sender, amount);
    }

    // ------------------------------------------------------------------ views

    function getTender(uint256 id) external view returns (Tender memory) {
        return _tenders[id];
    }

    function bidders(uint256 id) external view returns (address[] memory) {
        return _bidders[id];
    }

    function bidderCount(uint256 id) external view returns (uint256) {
        return _bidders[id].length;
    }

    /// @notice The two handles that are (or will be) publicly decryptable for this tender.
    function revealHandles(uint256 id) external view returns (bytes32 winnerIdx, bytes32 secondScore) {
        EncState storage e = _enc[id];
        return (FHE.toBytes32(e.winnerIdx), FHE.toBytes32(e.second));
    }

    function fundOkHandle(uint256 id) external view returns (bytes32) {
        return FHE.toBytes32(_enc[id].fundOk);
    }

    /// @dev Handle of the lowest score. Exposed ONLY so tests can assert it is not publicly decryptable.
    function bestScoreHandle(uint256 id) external view returns (bytes32) {
        return FHE.toBytes32(_enc[id].best);
    }

    // ------------------------------------------------------------------ internals

    /// @dev Homomorphic fold of one bid into (best, second, winnerIdx). No branch on a ciphertext,
    ///      constant operation count, and the raw bid handle is never stored or exposed.
    function _fold(uint256 id, euint64 x, uint64 budget, uint64 handicap, uint32 idx) private {
        EncState storage e = _enc[id];

        // 1. validity first. `x + handicap` may wrap for a huge x, but the wrapped value is discarded by
        //    the select below, so an over-budget bid can only ever become the sentinel score.
        ebool valid = FHE.le(x, budget);
        euint64 score = FHE.select(valid, FHE.add(x, handicap), FHE.asEuint64(SCORE_SENT));

        // 2. all three new values are computed from the OLD best/second
        ebool beatsBest = FHE.lt(score, e.best);
        ebool beatsSecond = FHE.lt(score, e.second);
        euint64 newSecond = FHE.select(beatsBest, e.best, FHE.select(beatsSecond, score, e.second));
        euint64 newBest = FHE.select(beatsBest, score, e.best);
        euint32 newIdx = FHE.select(beatsBest, FHE.asEuint32(idx), e.winnerIdx);

        e.best = newBest;
        e.second = newSecond;
        e.winnerIdx = newIdx;
        FHE.allowThis(newBest);
        FHE.allowThis(newSecond);
        FHE.allowThis(newIdx);
    }

    function _settle(uint256 id, Tender storage t) private {
        t.phase = Phase.Settled;
        _payOut(t.winner, t.price);
        _payOut(t.poster, t.budget - t.price);
        emit Settled(id, t.winner, t.price);
    }

    function _slashWinnerAndRefund(uint256 id, Tender storage t) private {
        uint256 bond = bondOf[id][t.winner];
        if (bond > 0) {
            bondOf[id][t.winner] = 0;
            pendingEth[t.poster] += bond;
        }
        _payOut(t.poster, t.budget);
    }

    /// @dev Pays a PUBLIC amount from escrow through a trivially encrypted handle. The escrow was
    ///      verified to hold the full budget at funding, so this can never silently move 0.
    function _payOut(address to, uint64 amount) private {
        if (amount == 0) return;
        euint64 a = FHE.asEuint64(amount);
        FHE.allowTransient(a, address(token));
        token.confidentialTransfer(to, a);
    }

    function _sendEth(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ETH transfer failed");
    }
}
