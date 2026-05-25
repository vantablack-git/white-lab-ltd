// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WLABOFTAdapter
 * @notice Simplified lock-and-mint bridge adapter — replace with LayerZero OFT in production
 * @dev Production: use LayerZero OApp/OFT v2; this documents burn-and-mint flow
 */
contract WLABOFTAdapter is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    bool public bridgeEnabled;
    mapping(uint16 => address) public remoteAdapters;
    mapping(bytes32 => bool) public processedMessages;

    event BridgeEnabledUpdated(bool enabled);
    event BridgedOut(address indexed sender, uint16 dstChainId, uint256 amount);
    event BridgedIn(address indexed recipient, uint16 srcChainId, uint256 amount, bytes32 messageId);

    constructor(address _token, address initialOwner) Ownable(initialOwner) {
        token = IERC20(_token);
    }

    function setRemoteAdapter(uint16 chainId, address adapter) external onlyOwner {
        remoteAdapters[chainId] = adapter;
    }

    function setBridgeEnabled(bool enabled) external onlyOwner {
        bridgeEnabled = enabled;
        emit BridgeEnabledUpdated(enabled);
    }

    /// @notice Lock tokens on source chain (lock-and-mint model step 1)
    function bridgeOut(uint16 dstChainId, uint256 amount, address recipient) external {
        require(bridgeEnabled, "OFT: disabled stub");
        require(remoteAdapters[dstChainId] != address(0), "OFT: no remote");
        require(amount > 0, "OFT: zero amount");
        require(recipient != address(0), "OFT: zero recipient");
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit BridgedOut(recipient, dstChainId, amount);
    }

    /// @notice Mint/release on destination — only owner (relayer) in this stub
    function bridgeIn(
        uint16 srcChainId,
        address recipient,
        uint256 amount,
        bytes32 messageId
    ) external onlyOwner {
        require(bridgeEnabled, "OFT: disabled stub");
        require(recipient != address(0), "OFT: zero recipient");
        require(amount > 0, "OFT: zero amount");
        require(messageId != bytes32(0), "OFT: zero message");
        require(!processedMessages[messageId], "OFT: processed");
        processedMessages[messageId] = true;
        token.safeTransfer(recipient, amount);
        emit BridgedIn(recipient, srcChainId, amount, messageId);
    }
}
