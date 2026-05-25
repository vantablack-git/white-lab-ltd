// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title WLABTreasuryUUPS
 * @notice Upgradeable treasury — UUPS pattern, DAO timelock as admin
 */
contract WLABTreasuryUUPS is Initializable, UUPSUpgradeable, AccessControlUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant SPENDER_ROLE = keccak256("SPENDER_ROLE");

    bool public feeSwitchEnabled;
    uint16 public protocolFeeBps;

    event FeeSwitchUpdated(bool enabled, uint16 feeBps);
    event FundsWithdrawn(address indexed token, address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(SPENDER_ROLE, admin);
    }

    function setFeeSwitch(bool enabled, uint16 feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(feeBps <= 1000, "Treasury: fee too high");
        feeSwitchEnabled = enabled;
        protocolFeeBps = feeBps;
        emit FeeSwitchUpdated(enabled, feeBps);
    }

    function withdraw(address token, address to, uint256 amount) external onlyRole(SPENDER_ROLE) {
        require(to != address(0), "Treasury: zero to");
        IERC20(token).safeTransfer(to, amount);
        emit FundsWithdrawn(token, to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
