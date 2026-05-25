// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WLABVeToken
 * @notice veCRV-style vote escrow — lock WLAB up to 4 years for voting power
 */
contract WLABVeToken is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable wlab;
    uint256 public constant MAX_LOCK = 4 * 365 days;

    struct Lock {
        uint256 amount;
        uint256 unlockTime;
        uint256 votingPower;
    }

    mapping(address => Lock[]) public locks;
    mapping(address => uint256) public totalVotingPower;
    mapping(address => uint256) public usedGaugeWeight;
    mapping(address => mapping(uint256 => uint256)) public userGaugeWeight;

    mapping(uint256 => address) public gaugeToken;
    mapping(uint256 => uint256) public gaugeWeight;
    uint256 public gaugeCount;

    event Locked(address indexed user, uint256 amount, uint256 unlockTime, uint256 votingPower);
    event Withdrawn(address indexed user, uint256 amount);
    event GaugeCreated(uint256 indexed gaugeId, address token);
    event GaugeVoted(address indexed user, uint256 gaugeId, uint256 weight);

    constructor(address _wlab, address initialOwner) Ownable(initialOwner) {
        require(_wlab != address(0), "veWLAB: zero token");
        wlab = IERC20(_wlab);
    }

    /**
     * @notice Lock tokens — voting power = amount * (lockDuration / MAX_LOCK)
     */
    function createLock(uint256 amount, uint256 lockDuration) external nonReentrant {
        require(amount > 0, "veWLAB: zero amount");
        require(lockDuration >= 7 days && lockDuration <= MAX_LOCK, "veWLAB: invalid lock");

        uint256 unlockTime = block.timestamp + lockDuration;
        uint256 power = (amount * lockDuration) / MAX_LOCK;

        wlab.safeTransferFrom(msg.sender, address(this), amount);
        locks[msg.sender].push(Lock({amount: amount, unlockTime: unlockTime, votingPower: power}));
        totalVotingPower[msg.sender] += power;

        emit Locked(msg.sender, amount, unlockTime, power);
    }

    function withdraw(uint256 lockIndex) external nonReentrant {
        require(lockIndex < locks[msg.sender].length, "veWLAB: invalid index");
        Lock storage lk = locks[msg.sender][lockIndex];
        require(block.timestamp >= lk.unlockTime, "veWLAB: locked");

        uint256 amount = lk.amount;
        uint256 power = lk.votingPower;
        require(usedGaugeWeight[msg.sender] <= totalVotingPower[msg.sender] - power, "veWLAB: active votes");

        lk.amount = 0;
        lk.votingPower = 0;
        totalVotingPower[msg.sender] -= power;

        wlab.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function createGauge(address token) external onlyOwner returns (uint256) {
        uint256 id = gaugeCount++;
        gaugeToken[id] = token;
        emit GaugeCreated(id, token);
        return id;
    }

    function voteGauge(uint256 gaugeId, uint256 weight) external {
        require(gaugeId < gaugeCount, "veWLAB: invalid gauge");
        uint256 previous = userGaugeWeight[msg.sender][gaugeId];
        uint256 newUsed = usedGaugeWeight[msg.sender] - previous + weight;
        require(newUsed <= totalVotingPower[msg.sender], "veWLAB: insufficient power");

        if (weight > previous) {
            gaugeWeight[gaugeId] += weight - previous;
        } else {
            gaugeWeight[gaugeId] -= previous - weight;
        }

        userGaugeWeight[msg.sender][gaugeId] = weight;
        usedGaugeWeight[msg.sender] = newUsed;
        emit GaugeVoted(msg.sender, gaugeId, weight);
    }
}
