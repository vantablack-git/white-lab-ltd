// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ReentrantReceiver
 * @notice Contract whose receive() calls back into a configurable target with
 *         configurable calldata, a configurable number of times.  This is an
 *         adversarial primitive for testing whether protocol contracts correctly
 *         protect against ETH reentrancy.
 *
 *         Example: if WithdrawFunds sends ETH to this contract, `receive` can
 *         call `withdrawFunds(address(this))` again, attempting to double-claim
 *         before the sender has zeroed its withdrawal balance.
 */
contract ReentrantReceiver {
    address public target;
    bytes   public data;
    uint256 public reentrancyCount;

    receive() external payable {
        if (reentrancyCount > 0) {
            reentrancyCount--;
            (bool ok, ) = target.call(data);
            require(ok, "reentrant call failed");
        }
    }

    function setReentrancy(address target_, bytes calldata data_, uint256 count) external {
        target         = target_;
        data           = data_;
        reentrancyCount = count;
    }
}
