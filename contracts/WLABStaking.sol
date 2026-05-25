// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WLABStaking
 * @notice Stake WLAB with lock tiers (30/90/180/365 days) and dynamic rewards
 */
contract WLABStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;

    uint256 public rewardRatePerSecond;
    uint256 public totalWeightedStake;
    uint256 public accRewardPerWeight;
    uint256 public lastUpdateTime;
    uint256 public constant EMERGENCY_PENALTY_BPS = 1000;
    uint256 public constant BPS = 10_000;

    struct StakeInfo {
        uint256 amount;
        uint256 weight;
        uint256 rewardDebt;
        uint64 lockEnd;
        uint8 tierIndex;
        bool compound;
    }

    mapping(address => StakeInfo) public stakes;

    uint64[4] public lockDurations = [30 days, 90 days, 180 days, 365 days];
    uint256[4] public multipliers = [1e18, 15e17, 2e18, 3e18];

    event Staked(address indexed user, uint256 amount, uint8 tierIndex, uint64 lockEnd);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event EmergencyUnstaked(address indexed user, uint256 amount, uint256 penalty);
    event RewardRateUpdated(uint256 newRate);

    constructor(address _stakingToken, address _rewardToken, address initialOwner) Ownable(initialOwner) {
        require(_stakingToken != address(0) && _rewardToken != address(0), "Staking: zero token");
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        lastUpdateTime = block.timestamp;
    }

    function setRewardRate(uint256 _ratePerSecond) external onlyOwner {
        _updatePool();
        rewardRatePerSecond = _ratePerSecond;
        emit RewardRateUpdated(_ratePerSecond);
    }

    function stake(uint256 amount, uint8 tierIndex, bool compound) external nonReentrant {
        require(amount > 0, "Staking: zero amount");
        require(tierIndex < 4, "Staking: invalid tier");
        require(!compound || address(stakingToken) == address(rewardToken), "Staking: compound token mismatch");

        _updatePool();
        StakeInfo storage s = stakes[msg.sender];

        if (s.amount > 0) {
            require(s.tierIndex == tierIndex, "Staking: tier mismatch");
            _harvest(msg.sender);
        } else {
            s.rewardDebt = (s.weight * accRewardPerWeight) / 1e18;
        }

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 weight = (amount * multipliers[tierIndex]) / 1e18;
        s.amount += amount;
        s.weight += weight;
        s.lockEnd = uint64(block.timestamp + lockDurations[tierIndex]);
        s.tierIndex = tierIndex;
        s.compound = compound;
        s.rewardDebt = (s.weight * accRewardPerWeight) / 1e18;

        totalWeightedStake += weight;

        emit Staked(msg.sender, amount, tierIndex, s.lockEnd);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Staking: zero amount");
        StakeInfo storage s = stakes[msg.sender];
        require(s.amount >= amount, "Staking: insufficient");
        require(block.timestamp >= s.lockEnd, "Staking: locked");

        _updatePool();
        _harvest(msg.sender);

        uint256 weightReduction = (amount * multipliers[s.tierIndex]) / 1e18;
        s.amount -= amount;
        s.weight -= weightReduction;
        totalWeightedStake -= weightReduction;

        stakingToken.safeTransfer(msg.sender, amount);

        if (s.amount == 0) {
            s.lockEnd = 0;
            s.tierIndex = 0;
            s.compound = false;
            s.rewardDebt = 0;
        }

        emit Unstaked(msg.sender, amount);
    }

    function claimReward() external nonReentrant {
        _updatePool();
        _harvest(msg.sender);
    }

    function emergencyUnstake() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(s.amount > 0, "Staking: no stake");

        _updatePool();
        _harvest(msg.sender);

        uint256 amount = s.amount;
        uint256 penalty = (amount * EMERGENCY_PENALTY_BPS) / BPS;
        uint256 payout = amount - penalty;

        totalWeightedStake -= s.weight;
        delete stakes[msg.sender];

        stakingToken.safeTransfer(msg.sender, payout);
        if (penalty > 0) {
            stakingToken.safeTransfer(owner(), penalty);
        }

        emit EmergencyUnstaked(msg.sender, payout, penalty);
    }

    function pendingReward(address user) public view returns (uint256) {
        StakeInfo memory s = stakes[user];
        if (s.weight == 0) return 0;

        uint256 acc = accRewardPerWeight;
        if (totalWeightedStake > 0 && block.timestamp > lastUpdateTime) {
            uint256 timeElapsed = block.timestamp - lastUpdateTime;
            acc += (timeElapsed * rewardRatePerSecond * 1e18) / totalWeightedStake;
        }

        return (s.weight * acc) / 1e18 - s.rewardDebt;
    }

    function _updatePool() internal {
        if (block.timestamp <= lastUpdateTime) return;
        if (totalWeightedStake == 0) {
            lastUpdateTime = block.timestamp;
            return;
        }
        uint256 timeElapsed = block.timestamp - lastUpdateTime;
        accRewardPerWeight += (timeElapsed * rewardRatePerSecond * 1e18) / totalWeightedStake;
        lastUpdateTime = block.timestamp;
    }

    function _harvest(address user) internal {
        StakeInfo storage s = stakes[user];
        uint256 pending = (s.weight * accRewardPerWeight) / 1e18 - s.rewardDebt;
        if (pending == 0) return;

        s.rewardDebt = (s.weight * accRewardPerWeight) / 1e18;

        if (s.compound && s.amount > 0) {
            require(address(stakingToken) == address(rewardToken), "Staking: compound token mismatch");
            uint256 addedWeight = (pending * multipliers[s.tierIndex]) / 1e18;
            s.amount += pending;
            s.weight += addedWeight;
            totalWeightedStake += addedWeight;
            s.rewardDebt = (s.weight * accRewardPerWeight) / 1e18;
        } else {
            rewardToken.safeTransfer(user, pending);
            emit RewardClaimed(user, pending);
        }
    }
}
