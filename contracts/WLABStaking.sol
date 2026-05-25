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
    uint256 public totalStaked;
    uint256 public accRewardPerWeight;
    uint256 public lastUpdateTime;
    uint256 public rewardEndTime;
    uint256 public reservedRewards;
    uint256 public constant EMERGENCY_PENALTY_BPS = 1000;
    uint256 public constant BPS = 10_000;
    uint64 public constant DEFAULT_REWARD_DURATION = 365 days;

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
    event RewardProgramUpdated(uint256 rewardRatePerSecond, uint256 rewardEndTime);

    constructor(address _stakingToken, address _rewardToken, address initialOwner) Ownable(initialOwner) {
        require(_stakingToken != address(0) && _rewardToken != address(0), "Staking: zero token");
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        lastUpdateTime = block.timestamp;
    }

    function setRewardRate(uint256 _ratePerSecond) external onlyOwner {
        _setRewardProgram(_ratePerSecond, DEFAULT_REWARD_DURATION);
    }

    function setRewardProgram(uint256 _ratePerSecond, uint64 duration) external onlyOwner {
        _setRewardProgram(_ratePerSecond, duration);
    }

    function _setRewardProgram(uint256 _ratePerSecond, uint64 duration) internal {
        _updatePool();
        lastUpdateTime = block.timestamp;
        if (_ratePerSecond == 0) {
            rewardRatePerSecond = 0;
            rewardEndTime = block.timestamp;
            emit RewardRateUpdated(0);
            emit RewardProgramUpdated(0, rewardEndTime);
            return;
        }

        require(duration > 0, "Staking: zero duration");
        uint256 futureObligation = _ratePerSecond * uint256(duration);
        require(
            reservedRewards + futureObligation <= _rewardBackingBalance(),
            "Staking: insufficient rewards"
        );
        rewardRatePerSecond = _ratePerSecond;
        rewardEndTime = block.timestamp + uint256(duration);
        emit RewardRateUpdated(_ratePerSecond);
        emit RewardProgramUpdated(_ratePerSecond, rewardEndTime);
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
        totalStaked += amount;
        // lockEnd uses max(existing, fresh) so a same-tier top-up never
        // silently shortens the user's commitment. Behavior is identical to
        // the previous unconditional write under today's monotone durations,
        // but encoding the invariant in source guards every future change to
        // tier durations or top-up paths from regressing into a silent
        // unlock-time reduction.
        uint64 newCandidate = uint64(block.timestamp + lockDurations[tierIndex]);
        if (newCandidate > s.lockEnd) {
            s.lockEnd = newCandidate;
        }
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
        totalStaked -= amount;
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

        totalStaked -= amount;
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
        uint256 applicableTime = _lastApplicableRewardTime();
        if (totalWeightedStake > 0 && applicableTime > lastUpdateTime) {
            uint256 timeElapsed = applicableTime - lastUpdateTime;
            acc += (timeElapsed * rewardRatePerSecond * 1e18) / totalWeightedStake;
        }

        return (s.weight * acc) / 1e18 - s.rewardDebt;
    }

    function _updatePool() internal {
        uint256 applicableTime = _lastApplicableRewardTime();
        if (applicableTime <= lastUpdateTime) return;
        if (totalWeightedStake == 0) {
            lastUpdateTime = applicableTime;
            return;
        }
        uint256 timeElapsed = applicableTime - lastUpdateTime;
        uint256 accrued = timeElapsed * rewardRatePerSecond;
        reservedRewards += accrued;
        accRewardPerWeight += (accrued * 1e18) / totalWeightedStake;
        lastUpdateTime = applicableTime;
    }

    function _harvest(address user) internal {
        StakeInfo storage s = stakes[user];
        uint256 pending = (s.weight * accRewardPerWeight) / 1e18 - s.rewardDebt;
        if (pending == 0) return;

        s.rewardDebt = (s.weight * accRewardPerWeight) / 1e18;
        reservedRewards -= pending;

        if (s.compound && s.amount > 0) {
            require(address(stakingToken) == address(rewardToken), "Staking: compound token mismatch");
            uint256 addedWeight = (pending * multipliers[s.tierIndex]) / 1e18;
            s.amount += pending;
            s.weight += addedWeight;
            totalStaked += pending;
            totalWeightedStake += addedWeight;
            s.rewardDebt = (s.weight * accRewardPerWeight) / 1e18;
        } else {
            rewardToken.safeTransfer(user, pending);
            emit RewardClaimed(user, pending);
        }
    }

    function _lastApplicableRewardTime() internal view returns (uint256) {
        return block.timestamp < rewardEndTime ? block.timestamp : rewardEndTime;
    }

    function _rewardBackingBalance() internal view returns (uint256) {
        uint256 balance = rewardToken.balanceOf(address(this));
        if (address(stakingToken) == address(rewardToken)) {
            return balance > totalStaked ? balance - totalStaked : 0;
        }
        return balance;
    }
}
