// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IEscrow {
    function release(uint256 jobId, address payable completer) external;
    function releaseSplit(uint256 jobId, address payable[] calldata recipients, uint256[] calldata amounts) external;
    function refund(uint256 jobId) external;
}

/**
 * @title JobFactory
 * @notice Creates and registers jobs for the ClawGig marketplace. Gas-optimized for Monad.
 * @dev Issuers post jobs with description hash, bounty, and deadline; jobId is assigned and emitted.
 */
contract JobFactory is Ownable, ReentrancyGuard {
    /// @dev Packed job data to reduce SSTORE/SLOAD (gas efficiency)
    struct JobRecord {
        address issuer;       // 20 bytes
        uint64 deadline;      // 8 bytes
        uint64 createdAt;     // 8 bytes
        uint128 bounty;       // 16 bytes (enough for wei amounts in practice)
        bytes32 descriptionHash;
        address completer;    // set when claimed
        uint8 status;        // 0=Open, 1=Claimed, 2=Submitted, 3=Completed, 4=Cancelled
    }

    /// @dev status enum as constants to avoid extra storage
    uint8 internal constant STATUS_OPEN = 0;
    uint8 internal constant STATUS_CLAIMED = 1;
    uint8 internal constant STATUS_SUBMITTED = 2;
    uint8 internal constant STATUS_COMPLETED = 3;
    uint8 internal constant STATUS_CANCELLED = 4;

    /// @dev Next job id (1-indexed)
    uint256 private _nextJobId;

    /// @dev jobId => JobRecord
    mapping(uint256 => JobRecord) private _jobs;

    /// @dev Escrow for native MON bounties (testnet + mainnet)
    address public escrow;
    /// @dev Escrow for USDC bounties (mainnet only; optional)
    address public escrowUSDC;
    /// @dev jobId => token type: 0 = MON, 1 = USDC
    mapping(uint256 => uint8) public jobTokenType;

    // ---------- Events ----------
    event JobPosted(
        uint256 indexed jobId,
        address indexed issuer,
        bytes32 descriptionHash,
        uint256 bounty,
        uint256 deadline
    );
    event JobClaimed(uint256 indexed jobId, address indexed completer);
    event JobCancelled(uint256 indexed jobId);
    event JobReopened(uint256 indexed jobId);
    event EscrowSet(address indexed previousEscrow, address indexed newEscrow);
    event EscrowUSDCSet(address indexed previousEscrowUSDC, address indexed newEscrowUSDC);
    event JobPostedWithToken(uint256 indexed jobId, address indexed issuer, bytes32 descriptionHash, uint256 bounty, uint256 deadline, uint8 tokenType);

    error InvalidBounty();
    error InvalidDeadline();
    error InvalidDescription();
    error JobNotOpen();
    error JobNotFound();
    error Unauthorized();

    constructor() Ownable(msg.sender) {}

    /// @dev Token type: MON (native)
    uint8 public constant TOKEN_MON = 0;
    /// @dev Token type: USDC (ERC20 on Monad mainnet)
    uint8 public constant TOKEN_USDC = 1;

    /**
     * @notice Post a new job with MON bounty (testnet or mainnet). Bounty must be escrowed via Escrow.
     */
    function postJob(
        bytes32 descriptionHash,
        uint256 bounty,
        uint256 deadline
    ) external nonReentrant returns (uint256 jobId) {
        return _postJobWithToken(descriptionHash, bounty, deadline, TOKEN_MON);
    }

    /**
     * @notice Post a new job with specified bounty token (MON or USDC). For mainnet USDC, set escrowUSDC first.
     * @param tokenType 0 = MON (native), 1 = USDC
     */
    function postJobWithToken(
        bytes32 descriptionHash,
        uint256 bounty,
        uint256 deadline,
        uint8 tokenType
    ) external nonReentrant returns (uint256 jobId) {
        if (tokenType == TOKEN_USDC && escrowUSDC == address(0)) revert InvalidBounty();
        return _postJobWithToken(descriptionHash, bounty, deadline, tokenType);
    }

    function _postJobWithToken(
        bytes32 descriptionHash,
        uint256 bounty,
        uint256 deadline,
        uint8 tokenType
    ) internal returns (uint256 jobId) {
        if (descriptionHash == bytes32(0)) revert InvalidDescription();
        if (bounty == 0) revert InvalidBounty();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        jobId = ++_nextJobId;
        jobTokenType[jobId] = tokenType;
        unchecked {
            _jobs[jobId] = JobRecord({
                issuer: msg.sender,
                deadline: uint64(deadline),
                createdAt: uint64(block.timestamp),
                bounty: uint128(bounty),
                descriptionHash: descriptionHash,
                completer: address(0),
                status: STATUS_OPEN
            });
        }

        emit JobPosted(jobId, msg.sender, descriptionHash, bounty, deadline);
        emit JobPostedWithToken(jobId, msg.sender, descriptionHash, bounty, deadline, tokenType);
        return jobId;
    }

    /**
     * @notice Mark job as claimed by completer (called by Escrow/EscrowUSDC or backend after escrow lock).
     */
    function setClaimed(uint256 jobId, address completer) external {
        if (msg.sender != escrow && msg.sender != escrowUSDC && msg.sender != owner()) revert Unauthorized();
        JobRecord storage j = _jobs[jobId];
        if (j.issuer == address(0)) revert JobNotFound();
        if (j.status != STATUS_OPEN) revert JobNotOpen();
        j.completer = completer;
        j.status = STATUS_CLAIMED;
        emit JobClaimed(jobId, completer);
    }

    /**
     * @notice Mark job as submitted (Escrow/EscrowUSDC or backend calls after submitWork).
     */
    function setSubmitted(uint256 jobId) external {
        if (msg.sender != escrow && msg.sender != escrowUSDC && msg.sender != owner()) revert Unauthorized();
        JobRecord storage j = _jobs[jobId];
        if (j.issuer == address(0)) revert JobNotFound();
        if (j.status != STATUS_CLAIMED) revert JobNotOpen();
        j.status = STATUS_SUBMITTED;
    }

    /**
     * @notice Mark job completed or cancelled (Escrow/EscrowUSDC releases/refunds on completion).
     */
    function setCompleted(uint256 jobId, bool success) external {
        if (msg.sender != escrow && msg.sender != escrowUSDC && msg.sender != owner()) revert Unauthorized();
        JobRecord storage j = _jobs[jobId];
        if (j.issuer == address(0)) revert JobNotFound();
        j.status = success ? STATUS_COMPLETED : STATUS_CANCELLED;
    }

    /**
     * @notice Mark job completed and release escrow to completer (owner only). Call after verify(approved=true).
     */
    function completeAndRelease(uint256 jobId, address payable completer) external onlyOwner nonReentrant {
        JobRecord storage j = _jobs[jobId];
        if (j.issuer == address(0)) revert JobNotFound();
        if (j.status != STATUS_SUBMITTED) revert JobNotOpen();
        j.status = STATUS_COMPLETED;
        address esc = jobTokenType[jobId] == TOKEN_USDC ? escrowUSDC : escrow;
        IEscrow(esc).release(jobId, completer);
    }

    /**
     * @notice Mark job completed and release escrow to multiple recipients (team split). Owner only. Sum of amounts must equal escrow deposit.
     */
    function completeAndReleaseSplit(uint256 jobId, address payable[] calldata recipients, uint256[] calldata amounts) external onlyOwner nonReentrant {
        JobRecord storage j = _jobs[jobId];
        if (j.issuer == address(0)) revert JobNotFound();
        if (j.status != STATUS_SUBMITTED) revert JobNotOpen();
        j.status = STATUS_COMPLETED;
        address esc = jobTokenType[jobId] == TOKEN_USDC ? escrowUSDC : escrow;
        IEscrow(esc).releaseSplit(jobId, recipients, amounts);
    }

    /**
     * @notice Cancel an open job (issuer only).
     */
    function cancelJob(uint256 jobId) external nonReentrant {
        JobRecord storage j = _jobs[jobId];
        if (j.issuer != msg.sender) revert Unauthorized();
        if (j.status != STATUS_OPEN) revert JobNotOpen();
        j.status = STATUS_CANCELLED;
        emit JobCancelled(jobId);
    }

    /**
     * @notice Cancel an open job as owner (e.g. backend). Use with refundToIssuer so issuer gets bounty back.
     */
    function cancelJobAsOwner(uint256 jobId) external onlyOwner nonReentrant {
        JobRecord storage j = _jobs[jobId];
        if (j.issuer == address(0)) revert JobNotFound();
        if (j.status != STATUS_OPEN) revert JobNotOpen();
        j.status = STATUS_CANCELLED;
        emit JobCancelled(jobId);
    }

    /**
     * @notice Refund issuer (owner only). Call after cancelJob/cancelJobAsOwner or setCompleted(jobId, false). Sends escrowed bounty back to issuer.
     */
    function refundToIssuer(uint256 jobId) external onlyOwner nonReentrant {
        address esc = jobTokenType[jobId] == TOKEN_USDC ? escrowUSDC : escrow;
        if (esc == address(0)) revert InvalidBounty();
        IEscrow(esc).refund(jobId);
    }

    /**
     * @notice Reject submission and reopen job for another agent (owner only). Job must be SUBMITTED. Bounty stays in escrow.
     */
    function rejectAndReopen(uint256 jobId) external onlyOwner nonReentrant {
        JobRecord storage j = _jobs[jobId];
        if (j.issuer == address(0)) revert JobNotFound();
        if (j.status != STATUS_SUBMITTED) revert JobNotOpen();
        j.status = STATUS_OPEN;
        j.completer = address(0);
        emit JobReopened(jobId);
    }

    /**
     * @notice Set MON escrow contract (owner only).
     */
    function setEscrow(address newEscrow) external onlyOwner {
        address prev = escrow;
        escrow = newEscrow;
        emit EscrowSet(prev, newEscrow);
    }

    /**
     * @notice Set USDC escrow contract for mainnet (owner only). Optional; set when enabling USDC bounties.
     */
    function setEscrowUSDC(address newEscrowUSDC) external onlyOwner {
        address prev = escrowUSDC;
        escrowUSDC = newEscrowUSDC;
        emit EscrowUSDCSet(prev, newEscrowUSDC);
    }

    // ---------- Views ----------
    function getJob(uint256 jobId) external view returns (
        address issuer_,
        uint256 deadline_,
        uint256 createdAt_,
        uint256 bounty_,
        bytes32 descriptionHash_,
        address completer_,
        uint8 status_
    ) {
        JobRecord storage j = _jobs[jobId];
        if (j.issuer == address(0)) revert JobNotFound();
        return (
            j.issuer,
            uint256(j.deadline),
            uint256(j.createdAt),
            uint256(j.bounty),
            j.descriptionHash,
            j.completer,
            j.status
        );
    }

    function nextJobId() external view returns (uint256) {
        return _nextJobId;
    }

    function getStatus(uint256 jobId) external view returns (uint8) {
        return _jobs[jobId].status;
    }

    /// @dev Returns bounty token type for a job: 0 = MON, 1 = USDC
    function getJobTokenType(uint256 jobId) external view returns (uint8) {
        return jobTokenType[jobId];
    }
}
