// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WLABVesting
 * @notice Cliff + linear vesting per beneficiary; revocable by owner
 */
contract WLABVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    struct Schedule {
        uint256 totalAmount;
        uint256 released;
        uint64 start;
        uint64 cliffDuration;
        uint64 vestingDuration;
        bool revocable;
        bool revoked;
    }

    mapping(address => Schedule) public schedules;

    /// @notice Sum of unreleased obligations across all active schedules. The
    ///         vesting token balance held by this contract may never go below
    ///         this number — that invariant is what allows emergencyWithdraw to
    ///         exist without becoming a rug surface.
    uint256 public totalOutstanding;

    event ScheduleCreated(
        address indexed beneficiary,
        uint256 amount,
        uint64 start,
        uint64 cliff,
        uint64 duration,
        bool revocable
    );
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event ScheduleRevoked(address indexed beneficiary, uint256 refundAmount);
    event EmergencyWithdraw(address indexed token, uint256 amount);

    constructor(address _token, address initialOwner) Ownable(initialOwner) {
        require(_token != address(0), "Vesting: zero token");
        token = IERC20(_token);
    }

    /**
     * @notice Create vesting schedule for beneficiary
     */
    function createSchedule(
        address beneficiary,
        uint256 amount,
        uint64 start,
        uint64 cliffDuration,
        uint64 vestingDuration,
        bool revocable
    ) external onlyOwner {
        require(beneficiary != address(0), "Vesting: zero beneficiary");
        require(amount > 0, "Vesting: zero amount");
        require(schedules[beneficiary].totalAmount == 0, "Vesting: exists");
        require(vestingDuration > 0, "Vesting: zero duration");

        schedules[beneficiary] = Schedule({
            totalAmount: amount,
            released: 0,
            start: start,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            revocable: revocable,
            revoked: false
        });
        totalOutstanding += amount;

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit ScheduleCreated(beneficiary, amount, start, cliffDuration, vestingDuration, revocable);
    }

    /**
     * @notice Claim vested tokens
     */
    function release() external nonReentrant {
        uint256 amount = releasableAmount(msg.sender);
        require(amount > 0, "Vesting: nothing to release");

        Schedule storage s = schedules[msg.sender];
        s.released += amount;
        totalOutstanding -= amount;
        token.safeTransfer(msg.sender, amount);

        emit TokensReleased(msg.sender, amount);
    }

    /**
     * @notice Revoke schedule. Beneficiary keeps every token that was already
     *         vested at the moment of revocation; only the strictly unvested
     *         remainder is refunded to the owner. After revoke, the schedule
     *         is closed: no more releasable amount, no double-claim path,
     *         and the contract holds no obligation toward this beneficiary.
     *
     *         This protects the most basic vesting invariant: revocation
     *         affects future allocation only, never accrued entitlement.
     */
    function revoke(address beneficiary) external onlyOwner nonReentrant {
        Schedule storage s = schedules[beneficiary];
        require(s.totalAmount > 0, "Vesting: no schedule");
        require(s.revocable, "Vesting: not revocable");
        require(!s.revoked, "Vesting: already revoked");

        uint256 unreleased = releasableAmount(beneficiary);
        uint256 refund = s.totalAmount - s.released - unreleased;

        // Close the schedule's books before any external transfer so
        // releasableAmount() returns 0 even on re-entrant view calls and
        // future _vestedAmount math cannot grow past what we just paid.
        s.revoked = true;
        s.totalAmount = s.released + unreleased;
        totalOutstanding -= (unreleased + refund);

        if (unreleased > 0) {
            s.released += unreleased;
            token.safeTransfer(beneficiary, unreleased);
            emit TokensReleased(beneficiary, unreleased);
        }

        if (refund > 0) {
            token.safeTransfer(owner(), refund);
        }

        emit ScheduleRevoked(beneficiary, refund);
    }

    /**
     * @notice View releasable amount for beneficiary
     */
    function releasableAmount(address beneficiary) public view returns (uint256) {
        Schedule memory s = schedules[beneficiary];
        if (s.totalAmount == 0 || s.revoked) return 0;
        return _vestedAmount(s) - s.released;
    }

    function _vestedAmount(Schedule memory s) internal view returns (uint256) {
        if (block.timestamp < s.start + s.cliffDuration) {
            return 0;
        }
        if (block.timestamp >= s.start + s.cliffDuration + s.vestingDuration) {
            return s.totalAmount;
        }
        uint256 elapsed = block.timestamp - s.start - s.cliffDuration;
        return (s.totalAmount * elapsed) / s.vestingDuration;
    }

    /**
     * @notice Owner emergency withdraw, hard-restricted so it cannot violate
     *         outstanding obligations.
     *
     *         - For unrelated ERC20s mistakenly sent to this contract, the
     *           full balance is freely recoverable.
     *         - For the vesting token itself, only the strict excess of the
     *           contract's balance over `totalOutstanding` may be withdrawn.
     *           This makes it impossible for the owner to drain tokens that
     *           any active schedule still has a claim to.
     */
    function emergencyWithdraw(address erc20, uint256 amount) external onlyOwner {
        if (erc20 == address(token)) {
            uint256 bal = token.balanceOf(address(this));
            uint256 protectedBal = totalOutstanding;
            uint256 withdrawable = bal > protectedBal ? bal - protectedBal : 0;
            require(amount <= withdrawable, "Vesting: protected balance");
        }
        IERC20(erc20).safeTransfer(owner(), amount);
        emit EmergencyWithdraw(erc20, amount);
    }
}
