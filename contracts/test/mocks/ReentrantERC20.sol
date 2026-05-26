// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ReentrantERC20
 * @notice Minimal ERC20 that fires a configurable callback during transfer/transferFrom.
 *         The callback is fired AFTER debiting the sender but BEFORE crediting the
 *         recipient, so the re-entered context sees the sender's balance already
 *         reduced — making this token a realistic adversarial primitive for testing
 *         CEI violations and nonReentrant guards in consuming contracts.
 *
 *         A reentrancy guard (_inTransfer) prevents the callback from being fired
 *         recursively, which would otherwise cause an infinite loop or out-of-gas.
 */
contract ReentrantERC20 {
    string  public name;
    string  public symbol;
    uint8   public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public callbackTarget;
    bytes   public callbackData;
    bool    public callbackEnabled;
    bool    private _inTransfer;

    constructor(string memory name_, string memory symbol_) {
        name   = name_;
        symbol = symbol_;
    }

    function setCallback(address target, bytes calldata data) external {
        callbackTarget = target;
        callbackData   = data;
        callbackEnabled = true;
    }

    function disableCallback() external { callbackEnabled = false; }

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _debit(msg.sender, amount);

        _fireCallbackOnce();

        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        _debit(from, amount);

        _fireCallbackOnce();

        balanceOf[to] += amount;
        return true;
    }

    function _debit(address from, uint256 amount) private {
        uint256 bal = balanceOf[from];
        require(bal >= amount, "insufficient balance");
        balanceOf[from] = bal - amount;
    }

    function _fireCallbackOnce() private {
        if (!_inTransfer && callbackEnabled) {
            _inTransfer = true;
            (bool ok, ) = callbackTarget.call(callbackData);
            require(ok, "callback failed");
            _inTransfer = false;
        }
    }
}
