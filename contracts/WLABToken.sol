// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title WLABToken
 * @notice WhiteLab ($WLAB) utility token — max 1B supply, compliance hooks, optional fees
 * @dev OZ v5 removed ERC20Snapshot; governance uses ERC20Votes checkpoints + snapshotId event
 *
 * FIX (P0): _update() fee logic refactored — full fee deducted from sender in ONE super._update
 *   call per fee path (from→feeReceiver), then burnAmt burned from feeReceiver. This prevents
 *   triple-call vote-checkpoint drift under ERC20Votes. (Option A from KNOWN-ISSUES doc)
 */
contract WLABToken is ERC20, ERC20Permit, ERC20Votes, Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE     = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE     = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE     = keccak256("PAUSER_ROLE");
    bytes32 public constant SNAPSHOT_ROLE   = keccak256("SNAPSHOT_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    uint256 public latestSnapshotId;
    event Snapshot(uint256 indexed snapshotId, uint256 blockNumber);

    bool    public maxWalletEnabled;
    uint256 public maxWalletAmount;

    bool    public transferFeeEnabled;
    uint16  public transferFeeBps;
    uint16  public constant BPS_DENOMINATOR = 10_000;
    uint16  public burnShareBps = 7_000;
    address public feeReceiver;

    mapping(address => bool) public blacklisted;
    mapping(address => bool) public whitelisted;
    mapping(address => bool) public feeExempt;
    bool public whitelistModeEnabled;

    event MaxWalletUpdated(bool enabled, uint256 amount);
    event TransferFeeUpdated(bool enabled, uint16 feeBps, uint16 burnShareBps, address receiver);
    event BlacklistUpdated(address indexed account, bool status);
    event WhitelistUpdated(address indexed account, bool status);
    event FeeExemptUpdated(address indexed account, bool status);
    event WhitelistModeUpdated(bool enabled);
    event TokensBurned(address indexed account, uint256 amount);

    constructor(address admin, address _feeReceiver) ERC20("WhiteLab", "WLAB") ERC20Permit("WhiteLab") {
        require(admin != address(0), "WLAB: zero admin");
        require(_feeReceiver != address(0), "WLAB: zero fee receiver");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE,        admin);
        _grantRole(BURNER_ROLE,        admin);
        _grantRole(PAUSER_ROLE,        admin);
        _grantRole(SNAPSHOT_ROLE,      admin);
        _grantRole(COMPLIANCE_ROLE,    admin);
        feeReceiver    = _feeReceiver;
        maxWalletAmount = MAX_SUPPLY / 100;
    }

    // ─── Minting / Burning ───────────────────────────────────────────────────

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "WLAB: max supply");
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    // ─── Governance snapshot (ERC20Votes checkpoint compat) ─────────────────

    function snapshot() external onlyRole(SNAPSHOT_ROLE) returns (uint256) {
        latestSnapshotId += 1;
        emit Snapshot(latestSnapshotId, block.number);
        return latestSnapshotId;
    }

    // ─── Pause ───────────────────────────────────────────────────────────────

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ─── Admin setters ───────────────────────────────────────────────────────

    function setMaxWallet(bool enabled, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxWalletEnabled = enabled;
        maxWalletAmount  = amount;
        emit MaxWalletUpdated(enabled, amount);
    }

    function setTransferFee(
        bool    enabled,
        uint16  feeBps,
        uint16  _burnShareBps,
        address receiver
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(feeBps        <= 500,            "WLAB: fee too high");
        require(_burnShareBps <= BPS_DENOMINATOR,"WLAB: invalid burn share");
        require(receiver      != address(0),     "WLAB: zero receiver");
        transferFeeEnabled = enabled;
        transferFeeBps     = feeBps;
        burnShareBps       = _burnShareBps;
        feeReceiver        = receiver;
        emit TransferFeeUpdated(enabled, feeBps, _burnShareBps, receiver);
    }

    function setBlacklisted(address account, bool status) external onlyRole(COMPLIANCE_ROLE) {
        blacklisted[account] = status;
        emit BlacklistUpdated(account, status);
    }

    function setWhitelisted(address account, bool status) external onlyRole(COMPLIANCE_ROLE) {
        whitelisted[account] = status;
        emit WhitelistUpdated(account, status);
    }

    function setFeeExempt(address account, bool status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeExempt[account] = status;
        emit FeeExemptUpdated(account, status);
    }

    function setWhitelistMode(bool enabled) external onlyRole(COMPLIANCE_ROLE) {
        whitelistModeEnabled = enabled;
        emit WhitelistModeUpdated(enabled);
    }

    // ─── ERC20Permit / Nonces override ───────────────────────────────────────

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    // ─── _update (core transfer hook) ────────────────────────────────────────

    /**
     * @dev P0 FIX — fee accounting uses 2 super._update calls maximum:
     *   1. from → to   (net amount)
     *   2. from → feeReceiver (full fee)          ← single debit from sender
     *   3. feeReceiver → address(0) (burn share)  ← debit from feeReceiver, NOT from sender
     *
     * This ensures ERC20Votes only writes two checkpoint entries for the sender,
     * avoiding the stale-delegate drift caused by the original triple-debit pattern.
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
        whenNotPaused
    {
        // ── Compliance checks (skip mint/burn) ──────────────────────────────
        if (from != address(0) && to != address(0)) {
            require(!blacklisted[from] && !blacklisted[to], "WLAB: blacklisted");
            if (whitelistModeEnabled) {
                require(whitelisted[from] || whitelisted[to], "WLAB: not whitelisted");
            }
        }

        // ── Fee logic ────────────────────────────────────────────────────────
        if (
            transferFeeEnabled   &&
            from   != address(0) &&
            to     != address(0) &&
            !feeExempt[from] &&
            !feeExempt[to] &&
            transferFeeBps > 0
        ) {
            uint256 fee = (value * transferFeeBps) / BPS_DENOMINATOR;
            if (fee > 0) {
                uint256 burnAmt     = (fee * burnShareBps) / BPS_DENOMINATOR;
                uint256 net         = value - fee;

                // 1) Net transfer: from → to
                super._update(from, to, net);

                // 2) Full fee: from → feeReceiver  (single debit from sender)
                super._update(from, feeReceiver, fee);

                // 3) Burn share: feeReceiver → address(0)  (debit is from feeReceiver)
                if (burnAmt > 0) {
                    super._update(feeReceiver, address(0), burnAmt);
                }

                // ── maxWallet check on net recipient ────────────────────────
                if (maxWalletEnabled && to != address(0) && to != address(0xdead)) {
                    require(balanceOf(to) <= maxWalletAmount, "WLAB: max wallet");
                }
                return;
            }
        }

        // ── No fee path ──────────────────────────────────────────────────────
        super._update(from, to, value);

        if (maxWalletEnabled && to != address(0) && to != address(0xdead)) {
            require(balanceOf(to) <= maxWalletAmount, "WLAB: max wallet");
        }
    }
}
