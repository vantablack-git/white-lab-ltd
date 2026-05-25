// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../upgrades/WLABTreasuryUUPS.sol";

contract WLABTreasuryUUPSV2 is WLABTreasuryUUPS {
    function version() external pure returns (string memory) {
        return "v2";
    }
}
