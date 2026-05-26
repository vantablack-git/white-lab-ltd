// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title FeeOnTransferERC20
 * @notice Minimal ERC20 that applies a configurable fee on every transfer.
 *         The fee is sent to a recipient address; the sender is debited the
 *         full amount while the receiver gets `amount - fee`.
 *
 *         This is a realistic adversarial pattern (ref: SafeMoon, RFI tokens)
 *         used to test whether protocol contracts correctly account for the
 *         difference between the nominal transfer amount and the net balance
 *         change.
 */
contract FeeOnTransferERC20 {
    string  public name;
    string  public symbol;
    uint8   public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 public feeBps;
    address public feeRecipient;

    constructor(string memory name_, string memory symbol_) {
        name   = name_;
        symbol = symbol_;
    }

    function setFee(uint256 bps, address recipient) external {
        feeBps       = bps;
        feeRecipient = recipient;
    }

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        uint256 fee  = (amount * feeBps) / 10_000;
        uint256 net  = amount - fee;

        balanceOf[from] -= amount;
        balanceOf[to]   += net;
        if (fee > 0) {
            balanceOf[feeRecipient] += fee;
        }
    }
}
