// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Reputation
 * @notice On-chain scores and badge tiers for ClawGig agents. Gas-optimized for Monad.
 * @dev Backend (owner) calls recordCompletion(agent, success) after job verify; badges are tier-based (no ERC721).
 */
contract Reputation is Ownable {
    /// @dev Badge tiers: 0 = none, 1 = bronze, 2 = silver, 3 = gold
    uint8 public constant BADGE_NONE = 0;
    uint8 public constant BADGE_BRONZE = 1;  // 1+ completed
    uint8 public constant BADGE_SILVER = 2;  // 5+ completed
    uint8 public constant BADGE_GOLD = 3;     // 20+ completed

    /// @dev agent => total jobs completed (claimed + reached submit)
    mapping(address => uint32) public completedCount;
    /// @dev agent => jobs verified successfully (issuer approved)
    mapping(address => uint32) public successCount;
    /// @dev agent => current badge tier (0–3)
    mapping(address => uint8) public badgeTier;

    event CompletionRecorded(address indexed agent, bool success, uint32 completed, uint32 successTotal);
    event BadgeAwarded(address indexed agent, uint8 tier);

    error Unauthorized();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Record a job completion (call after verify; backend/owner only).
     * @param agent Completer address
     * @param success True if issuer approved, false if rejected/cancelled
     */
    function recordCompletion(address agent, bool success) external onlyOwner {
        uint32 completed = completedCount[agent] + 1;
        uint32 successTotal = successCount[agent] + (success ? 1 : 0);
        completedCount[agent] = completed;
        successCount[agent] = successTotal;

        uint8 newTier = _tierFor(completed);
        uint8 prevTier = badgeTier[agent];
        if (newTier > prevTier) {
            badgeTier[agent] = newTier;
            emit BadgeAwarded(agent, newTier);
        }
        emit CompletionRecorded(agent, success, completed, successTotal);
    }

    function _tierFor(uint32 completed) internal pure returns (uint8) {
        if (completed >= 20) return BADGE_GOLD;
        if (completed >= 5) return BADGE_SILVER;
        if (completed >= 1) return BADGE_BRONZE;
        return BADGE_NONE;
    }

    /**
     * @notice Get score and tier for an agent.
     */
    function getScore(address agent) external view returns (
        uint32 completed,
        uint32 successTotal,
        uint8 tier
    ) {
        return (
            completedCount[agent],
            successCount[agent],
            badgeTier[agent]
        );
    }

    /// @dev Success rate in basis points (0–10000); 10000 = 100%
    function successRateBps(address agent) external view returns (uint256) {
        uint32 comp = completedCount[agent];
        if (comp == 0) return 0;
        return (uint256(successCount[agent]) * 10000) / uint256(comp);
    }
}
