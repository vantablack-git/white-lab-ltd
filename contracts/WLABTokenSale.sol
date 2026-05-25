// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title WLABTokenSale
 * @notice Multi-phase IDO (Seed/Private/Public) with whitelist, caps, refund, and buyer claim.
 */
contract WLABTokenSale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Phase { None, Seed, Private, Public }

    struct PhaseConfig {
        uint256 priceWeiPerToken;
        uint256 tokenAllocation;
        uint256 tokensSold;
        uint256 hardCapWei;
        uint256 softCapWei;
        uint256 totalRaisedWei;
        uint256 maxPerWallet;
        bool    active;
        bool    finalized;
        bytes32 merkleRoot;
    }

    IERC20 public immutable saleToken;
    address public immutable paymentToken;

    Phase public currentPhase;
    mapping(Phase => PhaseConfig)                   public phases;
    mapping(Phase => mapping(address => uint256))   public purchasedWei;
    mapping(Phase => mapping(address => uint256))   public purchasedTokens;
    mapping(Phase => mapping(address => uint256))   public walletBoughtTokens;

    bool public saleFinalized;

    /// @notice Per-phase refund latch. Set true if and only if a phase failed
    ///         its softCap at finalization. Each phase's claim/refund path is
    ///         gated on its own latch — a failed phase cannot block a
    ///         successful phase's claims, and a successful phase cannot leak
    ///         into another phase's refunds.
    mapping(Phase => bool) public phaseRefundsEnabled;

    /// @notice Sum of raised wei from finalized successful phases that the
    ///         owner is entitled to withdraw. Failed-phase contributions stay
    ///         locked in escrow until refunded.
    uint256 public withdrawableRaisedWei;

    uint256 public totalUnclaimedTokens;

    event PhaseConfigured(Phase indexed phase, uint256 price, uint256 allocation, uint256 hardCap);
    event PhaseStarted(Phase indexed phase);
    event PhaseFinalized(Phase indexed phase, bool success);
    event Purchased(Phase indexed phase, address indexed buyer, uint256 paymentAmount, uint256 tokenAmount);
    event SaleFinalized(bool success);
    event Refunded(Phase indexed phase, address indexed buyer, uint256 amount);
    event TokensClaimed(Phase indexed phase, address indexed buyer, uint256 amount);

    constructor(
        address _saleToken,
        address _paymentToken,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_saleToken != address(0), "Sale: zero address");
        saleToken     = IERC20(_saleToken);
        paymentToken  = _paymentToken;
    }

    function configurePhase(
        Phase   phase,
        uint256 priceWeiPerToken,
        uint256 tokenAllocation,
        uint256 hardCapWei,
        uint256 softCapWei,
        bytes32 merkleRoot,
        uint256 maxPerWallet
    ) external onlyOwner {
        require(phase != Phase.None, "Sale: invalid phase");
        require(priceWeiPerToken > 0, "Sale: zero price");
        require(tokenAllocation > 0, "Sale: zero allocation");
        require(softCapWei <= hardCapWei, "Sale: invalid caps");
        PhaseConfig storage existing = phases[phase];
        require(!existing.active && !existing.finalized && existing.tokensSold == 0, "Sale: phase locked");

        phases[phase] = PhaseConfig({
            priceWeiPerToken : priceWeiPerToken,
            tokenAllocation  : tokenAllocation,
            tokensSold       : 0,
            hardCapWei       : hardCapWei,
            softCapWei       : softCapWei,
            totalRaisedWei   : 0,
            maxPerWallet     : maxPerWallet,
            active           : false,
            finalized        : false,
            merkleRoot       : merkleRoot
        });
        emit PhaseConfigured(phase, priceWeiPerToken, tokenAllocation, hardCapWei);
    }

    function startPhase(Phase phase) external onlyOwner {
        require(phases[phase].tokenAllocation > 0, "Sale: not configured");
        if (currentPhase != Phase.None) {
            phases[currentPhase].active = false;
        }
        currentPhase          = phase;
        phases[phase].active  = true;
        emit PhaseStarted(phase);
    }

    function buy(uint256 tokenAmount, bytes32[] calldata merkleProof) external payable nonReentrant {
        Phase phase = currentPhase;
        require(phase != Phase.None, "Sale: no active phase");
        PhaseConfig storage cfg = phases[phase];
        require(cfg.active && !cfg.finalized, "Sale: phase closed");
        require(tokenAmount > 0, "Sale: zero amount");

        if (cfg.merkleRoot != bytes32(0)) {
            bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
            require(MerkleProof.verify(merkleProof, cfg.merkleRoot, leaf), "Sale: not whitelisted");
        }

        uint256 paymentRequired = (tokenAmount * cfg.priceWeiPerToken) / 1e18;
        require(paymentRequired > 0, "Sale: payment rounds to zero");
        require(cfg.tokensSold + tokenAmount <= cfg.tokenAllocation, "Sale: allocation exceeded");
        require(cfg.totalRaisedWei + paymentRequired <= cfg.hardCapWei, "Sale: hard cap");
        if (cfg.maxPerWallet > 0) {
            require(
                walletBoughtTokens[phase][msg.sender] + tokenAmount <= cfg.maxPerWallet,
                "Sale: wallet cap"
            );
        }

        if (paymentToken == address(0)) {
            require(msg.value >= paymentRequired, "Sale: insufficient ETH");
            uint256 excess = msg.value - paymentRequired;
            if (excess > 0) {
                (bool refundExtra, ) = msg.sender.call{value: excess}("");
                require(refundExtra, "Sale: eth refund fail");
            }
        } else {
            require(msg.value == 0, "Sale: ETH not accepted");
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), paymentRequired);
        }

        cfg.tokensSold     += tokenAmount;
        cfg.totalRaisedWei += paymentRequired;
        purchasedWei[phase][msg.sender]       += paymentRequired;
        purchasedTokens[phase][msg.sender]    += tokenAmount;
        walletBoughtTokens[phase][msg.sender] += tokenAmount;
        totalUnclaimedTokens                  += tokenAmount;

        emit Purchased(phase, msg.sender, paymentRequired, tokenAmount);
    }

    /**
     * @notice Finalize a single phase without closing the entire sale.
     */
    function finalizePhase(Phase phase) external onlyOwner {
        require(phase != Phase.None, "Sale: invalid phase");
        PhaseConfig storage cfg = phases[phase];
        require(cfg.tokenAllocation > 0, "Sale: not configured");
        require(!cfg.finalized, "Sale: phase finalized");

        if (cfg.active) {
            cfg.active = false;
            if (currentPhase == phase) {
                currentPhase = Phase.None;
            }
        }

        cfg.finalized = true;
        _settleFinalizedPhase(phase, cfg);
    }

    /**
     * @notice Global sale wrap-up. Finalizes the active phase if needed, then locks withdrawals.
     */
    function finalizeSale() external onlyOwner {
        require(!saleFinalized, "Sale: already finalized");
        Phase phase = currentPhase;
        if (phase != Phase.None) {
            PhaseConfig storage cfg = phases[phase];
            require(cfg.active, "Sale: phase inactive");
            cfg.active    = false;
            cfg.finalized = true;
            currentPhase  = Phase.None;
            _settleFinalizedPhase(phase, cfg);
        } else {
            require(_anyPhaseFinalized(), "Sale: no phase ready");
        }

        saleFinalized = true;
        emit SaleFinalized(!refundsEnabled());
    }

    function _settleFinalizedPhase(Phase phase, PhaseConfig storage cfg) internal {
        bool succeeded = cfg.totalRaisedWei >= cfg.softCapWei;
        if (succeeded) {
            // Funds raised by a successful phase belong to the owner.
            withdrawableRaisedWei += cfg.totalRaisedWei;
        } else {
            // Funds raised by a failed phase must remain locked for buyer refunds.
            phaseRefundsEnabled[phase] = true;
        }
        emit PhaseFinalized(phase, succeeded);
    }

    function _anyPhaseFinalized() internal view returns (bool) {
        return phases[Phase.Seed].finalized
            || phases[Phase.Private].finalized
            || phases[Phase.Public].finalized;
    }

    /// @notice Aggregate view: true iff any phase is in refund mode. Useful
    ///         for legacy callers; per-phase decisions should read
    ///         `phaseRefundsEnabled(phase)` directly.
    function refundsEnabled() public view returns (bool) {
        return phaseRefundsEnabled[Phase.Seed]
            || phaseRefundsEnabled[Phase.Private]
            || phaseRefundsEnabled[Phase.Public];
    }

    function claim(Phase phase) external nonReentrant {
        require(phases[phase].finalized, "Sale: not finalized");
        require(!phaseRefundsEnabled[phase], "Sale: refunds active, claim disabled");
        uint256 tokens = purchasedTokens[phase][msg.sender];
        require(tokens > 0, "Sale: nothing to claim");
        purchasedTokens[phase][msg.sender] = 0;
        totalUnclaimedTokens              -= tokens;
        saleToken.safeTransfer(msg.sender, tokens);
        emit TokensClaimed(phase, msg.sender, tokens);
    }

    function refund(Phase phase) external nonReentrant {
        require(phaseRefundsEnabled[phase], "Sale: refunds off");
        uint256 paid = purchasedWei[phase][msg.sender];
        require(paid > 0, "Sale: nothing to refund");
        uint256 owedTokens = purchasedTokens[phase][msg.sender];

        purchasedWei[phase][msg.sender]       = 0;
        purchasedTokens[phase][msg.sender]    = 0;
        walletBoughtTokens[phase][msg.sender] = 0;
        totalUnclaimedTokens                 -= owedTokens;

        PhaseConfig storage cfg = phases[phase];
        cfg.tokensSold     -= owedTokens;
        cfg.totalRaisedWei -= paid;

        if (paymentToken == address(0)) {
            (bool ok, ) = msg.sender.call{value: paid}("");
            require(ok, "Sale: eth refund fail");
        } else {
            IERC20(paymentToken).safeTransfer(msg.sender, paid);
        }
        emit Refunded(phase, msg.sender, paid);
    }

    /// @notice Owner withdrawal is bounded by `withdrawableRaisedWei`, which
    ///         only accumulates from finalized successful phases. Funds owed
    ///         to refunds in failed phases are unreachable from this path.
    function withdrawFunds(address to) external onlyOwner nonReentrant {
        require(saleFinalized, "Sale: not allowed");
        require(to != address(0), "Sale: zero to");
        uint256 amount = withdrawableRaisedWei;
        require(amount > 0, "Sale: nothing to withdraw");
        withdrawableRaisedWei = 0;
        if (paymentToken == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "Sale: withdraw fail");
        } else {
            IERC20(paymentToken).safeTransfer(to, amount);
        }
    }

    function recoverUnsoldTokens(address to) external onlyOwner {
        require(saleFinalized, "Sale: not finalized");
        require(to != address(0), "Sale: zero to");
        uint256 bal        = saleToken.balanceOf(address(this));
        uint256 recoverable = bal > totalUnclaimedTokens ? bal - totalUnclaimedTokens : 0;
        require(recoverable > 0, "Sale: nothing recoverable");
        saleToken.safeTransfer(to, recoverable);
    }

    receive() external payable {}
}
