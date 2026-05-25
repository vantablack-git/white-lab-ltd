// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title WLABERC1967Proxy
 * @notice Production ERC-1967 proxy used by the WhiteLab protocol.
 *
 *      Thin, deliberately empty subclass of OpenZeppelin's audited
 *      `ERC1967Proxy`. The reason for the wrapper is on-chain
 *      attribution: every block explorer (Basescan, Etherscan) shows the
 *      proxy under the name `WLABERC1967Proxy` instead of a generic
 *      `ERC1967Proxy`, which makes the upgrade-authority surface
 *      easier to identify when reviewing the protocol.
 *
 *      No additional state, no additional functions, no additional
 *      assembly — behavior is exactly OpenZeppelin's `ERC1967Proxy`.
 *      The `_authorizeUpgrade` gate lives on the implementation
 *      (`WLABTreasuryUUPS`) and is bound to `UPGRADER_ROLE`.
 *
 *      This contract is deployed exactly once per upgradeable component
 *      (currently: `WLABTreasuryUUPS`) by `scripts/deploy.js`.
 */
contract WLABERC1967Proxy is ERC1967Proxy {
    constructor(address implementation, bytes memory data)
        ERC1967Proxy(implementation, data)
    {}
}
