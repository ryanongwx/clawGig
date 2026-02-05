// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title EscrowUSDC
 * @notice Holds and releases USDC bounties for ClawGig jobs on Monad mainnet.
 *         Issuer (or backend) transfers USDC to this contract; release sends to completer(s).
 */
contract EscrowUSDC is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public jobFactory;
    IERC20 public immutable usdc;

    /// @dev jobId => amount (USDC 6 decimals)
    mapping(uint256 => uint256) public deposits;
    /// @dev jobId => issuer (for refunds)
    mapping(uint256 => address) public issuerOf;

    event Deposited(uint256 indexed jobId, address indexed issuer, uint256 amount);
    event Released(uint256 indexed jobId, address indexed to, uint256 amount);
    event ReleasedSplit(uint256 indexed jobId, uint256 recipientCount);
    event Refunded(uint256 indexed jobId, address indexed to, uint256 amount);

    error Unauthorized();
    error NoDeposit();
    error InvalidAmount();

    constructor(address _usdc) Ownable(msg.sender) {
        if (_usdc == address(0)) revert InvalidAmount();
        usdc = IERC20(_usdc);
    }

    function setJobFactory(address newFactory) external onlyOwner {
        jobFactory = newFactory;
    }

    /**
     * @notice Escrow USDC bounty for a job. Caller must have approved this contract to spend amount.
     */
    function deposit(uint256 jobId, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        deposits[jobId] += amount;
        if (issuerOf[jobId] == address(0)) issuerOf[jobId] = msg.sender;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(jobId, msg.sender, amount);
    }

    /**
     * @notice Release USDC bounty to completer (callable by JobFactory only after setCompleted(jobId, true)).
     */
    function release(uint256 jobId, address payable completer) external nonReentrant {
        if (msg.sender != jobFactory) revert Unauthorized();
        uint256 amount = deposits[jobId];
        if (amount == 0) revert NoDeposit();
        deposits[jobId] = 0;
        usdc.safeTransfer(completer, amount);
        emit Released(jobId, completer, amount);
    }

    /**
     * @notice Release USDC bounty to multiple recipients (teams). Sum of amounts must equal deposits[jobId].
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
            if (amt > 0) usdc.safeTransfer(recipients[i], amt);
            unchecked { ++i; }
        }
        emit ReleasedSplit(jobId, recipients.length);
    }

    /**
     * @notice Refund issuer when job is cancelled or rejected.
     */
    function refund(uint256 jobId) external nonReentrant {
        uint256 amount = deposits[jobId];
        if (amount == 0) revert NoDeposit();
        bool allowed = msg.sender == jobFactory || msg.sender == issuerOf[jobId];
        if (!allowed) revert Unauthorized();
        deposits[jobId] = 0;
        usdc.safeTransfer(issuerOf[jobId], amount);
        emit Refunded(jobId, issuerOf[jobId], amount);
    }
}
