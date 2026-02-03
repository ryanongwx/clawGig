// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Escrow
 * @notice Holds and releases bounties for ClawGig jobs. Native token (Monad) only in this MVP.
 */
contract Escrow is Ownable, ReentrancyGuard {
    address public jobFactory;

    /// @dev jobId => amount wei held
    mapping(uint256 => uint256) public deposits;
    /// @dev jobId => issuer (to allow refunds)
    mapping(uint256 => address) public issuerOf;

    event Deposited(uint256 indexed jobId, address indexed issuer, uint256 amount);
    event Released(uint256 indexed jobId, address indexed to, uint256 amount);
    event ReleasedSplit(uint256 indexed jobId, uint256 recipientCount);
    event Refunded(uint256 indexed jobId, address indexed to, uint256 amount);

    error Unauthorized();
    error NoDeposit();
    error TransferFailed();
    error InvalidAmount();

    constructor() Ownable(msg.sender) {}

    function setJobFactory(address newFactory) external onlyOwner {
        jobFactory = newFactory;
    }

    /**
     * @notice Escrow bounty for a job (must be called after JobFactory.postJob).
     */
    function deposit(uint256 jobId) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        deposits[jobId] += msg.value;
        if (issuerOf[jobId] == address(0)) issuerOf[jobId] = msg.sender;
        emit Deposited(jobId, msg.sender, msg.value);
    }

    /**
     * @notice Release bounty to completer (callable by JobFactory only after setCompleted(jobId, true)).
     */
    function release(uint256 jobId, address payable completer) external nonReentrant {
        if (msg.sender != jobFactory) revert Unauthorized();
        uint256 amount = deposits[jobId];
        if (amount == 0) revert NoDeposit();
        deposits[jobId] = 0;
        (bool ok,) = completer.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Released(jobId, completer, amount);
    }

    /**
     * @notice Release bounty to multiple recipients (teams). Callable by JobFactory only. Sum of amounts must equal deposits[jobId].
     */
    function releaseSplit(uint256 jobId, address payable[] calldata recipients, uint256[] calldata amounts) external nonReentrant {
        if (msg.sender != jobFactory) revert Unauthorized();
        uint256 total = deposits[jobId];
        if (total == 0) revert NoDeposit();
        if (recipients.length != amounts.length || recipients.length == 0) revert InvalidAmount();
        uint256 sum;
        for (uint256 i; i < amounts.length; ) {
            sum += amounts[i];
            unchecked { ++i; }
        }
        if (sum != total) revert InvalidAmount();
        deposits[jobId] = 0;
        for (uint256 i; i < recipients.length; ) {
            uint256 amt = amounts[i];
            if (amt > 0) {
                (bool ok,) = recipients[i].call{value: amt}("");
                if (!ok) revert TransferFailed();
            }
            unchecked { ++i; }
        }
        emit ReleasedSplit(jobId, recipients.length);
    }

    /**
     * @notice Refund issuer when job is cancelled or rejected (JobFactory or issuer when cancelled).
     */
    function refund(uint256 jobId) external nonReentrant {
        uint256 amount = deposits[jobId];
        if (amount == 0) revert NoDeposit();
        bool allowed = msg.sender == jobFactory || msg.sender == issuerOf[jobId];
        if (!allowed) revert Unauthorized();
        deposits[jobId] = 0;
        address payable to = payable(issuerOf[jobId]);
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(jobId, to, amount);
    }
}
