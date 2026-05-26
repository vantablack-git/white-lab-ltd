const { expect }  = require("chai");
const { ethers }  = require("hardhat");

describe("WLABTokenSale", function () {
  let token, sale, owner, buyer, buyer2, treasury;

  beforeEach(async function () {
    [owner, buyer, buyer2, treasury] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);

    // P0 fix: Sale constructor takes (saleToken, paymentToken, initialOwner) — no vesting
    const Sale = await ethers.getContractFactory("WLABTokenSale");
    sale = await Sale.deploy(await token.getAddress(), ethers.ZeroAddress, owner.address);

    // Fund sale contract with IDO allocation
    await token.connect(owner).mint(await sale.getAddress(), ethers.parseEther("1000000"));
  });

  // ── helpers ────────────────────────────────────────────────────────────────
  const PRICE      = ethers.parseEther("0.00004");   // price per token in ETH
  const ALLOCATION = ethers.parseEther("100000");
  const HARD_CAP   = ethers.parseEther("100");
  const SOFT_CAP   = ethers.parseEther("0.01"); // 250+ tokens @ PRICE meets cap

  async function setupPublicPhase() {
    await sale.configurePhase(3, PRICE, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0);
    await sale.startPhase(3);
  }

  function costOf(tokenAmt) {
    return (BigInt(tokenAmt) * BigInt(PRICE)) / ethers.parseEther("1");
  }

  function merkleLeafFor(account) {
    const inner = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [account])
    );
    return ethers.keccak256(ethers.solidityPacked(["bytes32"], [inner]));
  }

  it("enforces Merkle whitelist when root is set", async function () {
    const buyAmt = ethers.parseEther("100");
    const root   = merkleLeafFor(buyer.address);
    await sale.configurePhase(3, PRICE, ALLOCATION, HARD_CAP, SOFT_CAP, root, 0);
    await sale.startPhase(3);

    await sale.connect(buyer).buy(buyAmt, [], { value: costOf(buyAmt) });
    await expect(
      sale.connect(buyer2).buy(buyAmt, [], { value: costOf(buyAmt) })
    ).to.be.revertedWith("Sale: not whitelisted");
  });

  // ── basic phase config ─────────────────────────────────────────────────────
  it("configures and purchases in public phase", async function () {
    await setupPublicPhase();
    const buyAmt = ethers.parseEther("1000");
    const cost   = costOf(buyAmt);

    await sale.connect(buyer).buy(buyAmt, [], { value: cost });

    const cfg = await sale.phases(3);
    expect(cfg.tokensSold).to.equal(buyAmt);
  });

  // ── P0: purchasedTokens recorded ──────────────────────────────────────────
  it("records purchasedTokens for buyer after buy()", async function () {
    await setupPublicPhase();
    const buyAmt = ethers.parseEther("500");
    const cost   = costOf(buyAmt);

    await sale.connect(buyer).buy(buyAmt, [], { value: cost });

    const recorded = await sale.purchasedTokens(3, buyer.address);
    expect(recorded).to.equal(buyAmt);
  });

  // ── P0: E2E buy → finalize → claim → balance ──────────────────────────────
  it("E2E: buy → finalizeSale → claim → buyer balance increases", async function () {
    await setupPublicPhase();
    const buyAmt = ethers.parseEther("2000");
    const cost   = costOf(buyAmt);

    await sale.connect(buyer).buy(buyAmt, [], { value: cost });

    // Finalize (soft cap met)
    await sale.connect(owner).finalizeSale();
    expect(await sale.refundsEnabled()).to.equal(false);

    const balBefore = await token.balanceOf(buyer.address);
    await sale.connect(buyer).claim(3);
    const balAfter  = await token.balanceOf(buyer.address);

    expect(balAfter - balBefore).to.equal(buyAmt);
  });

  it("claims exact entitlement when sale is fee-exempt and transfer fees are enabled", async function () {
    await setupPublicPhase();
    const buyAmt = ethers.parseEther("1000");
    const cost   = costOf(buyAmt);

    await sale.connect(buyer).buy(buyAmt, [], { value: cost });
    await sale.connect(owner).finalizeSale();
    await token.connect(owner).setTransferFee(true, 100, 7000, treasury.address);
    await token.connect(owner).setFeeExempt(await sale.getAddress(), true);

    const balBefore = await token.balanceOf(buyer.address);
    await sale.connect(buyer).claim(3);
    const balAfter = await token.balanceOf(buyer.address);

    expect(balAfter - balBefore).to.equal(buyAmt);
  });

  // ── P0: claim clears entitlement (no double-claim) ────────────────────────
  it("prevents double-claim", async function () {
    await setupPublicPhase();
    const buyAmt = ethers.parseEther("500");
    const cost   = costOf(buyAmt);

    await sale.connect(buyer).buy(buyAmt, [], { value: cost });
    await sale.connect(owner).finalizeSale();
    await sale.connect(buyer).claim(3);

    await expect(sale.connect(buyer).claim(3)).to.be.revertedWith("Sale: nothing to claim");
  });

  it("does not allow finalization before a phase is active", async function () {
    await expect(sale.connect(owner).finalizeSale()).to.be.revertedWith("Sale: no phase ready");
  });

  it("locks phase configuration after purchases begin", async function () {
    await setupPublicPhase();
    const buyAmt = ethers.parseEther("100");
    await sale.connect(buyer).buy(buyAmt, [], { value: costOf(buyAmt) });

    await expect(
      sale.configurePhase(3, PRICE, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0)
    ).to.be.revertedWith("Sale: phase locked");
  });

  // ── refund when soft cap not met ──────────────────────────────────────────
  it("enables refund when soft cap not met", async function () {
    // Set the soft cap above the buyer's contribution but below the hard cap.
    await sale.configurePhase(
      3,
      ethers.parseEther("0.01"),
      ethers.parseEther("1000"),
      ethers.parseEther("100"),
      ethers.parseEther("1"),
      ethers.ZeroHash,
      0
    );
    await sale.startPhase(3);
    await sale.connect(buyer).buy(ethers.parseEther("10"), [], { value: ethers.parseEther("0.1") });
    await sale.connect(owner).finalizeSale();

    expect(await sale.refundsEnabled()).to.equal(true);

    const before = await ethers.provider.getBalance(buyer.address);
    const tx     = await sale.connect(buyer).refund(3);
    const rcpt   = await tx.wait();
    const gas    = rcpt.gasUsed * tx.gasPrice;
    const after  = await ethers.provider.getBalance(buyer.address);

    expect(after + gas).to.be.gt(before);
  });

  // ── claim disabled when refunds active ────────────────────────────────────
  it("claim reverts when refunds active", async function () {
    await sale.configurePhase(3, PRICE, ALLOCATION, HARD_CAP, ethers.parseEther("1"), ethers.ZeroHash, 0);
    await sale.startPhase(3);
    await sale.connect(buyer).buy(ethers.parseEther("100"), [], { value: costOf(ethers.parseEther("100")) });
    await sale.connect(owner).finalizeSale();

    await expect(sale.connect(buyer).claim(3)).to.be.revertedWith("Sale: refunds active, claim disabled");
  });

  // ── multiple buyers, each claims their own amount ─────────────────────────
  it("two buyers claim independently", async function () {
    await setupPublicPhase();
    const amt1 = ethers.parseEther("300");
    const amt2 = ethers.parseEther("700");

    await sale.connect(buyer).buy(amt1, [],  { value: costOf(amt1) });
    await sale.connect(buyer2).buy(amt2, [], { value: costOf(amt2) });
    await sale.connect(owner).finalizeSale();

    await sale.connect(buyer).claim(3);
    await sale.connect(buyer2).claim(3);

    expect(await token.balanceOf(buyer.address)).to.equal(amt1);
    expect(await token.balanceOf(buyer2.address)).to.equal(amt2);
  });

  // ── recoverUnsoldTokens cannot steal unclaimed buyer tokens ───────────────
  it("recoverUnsoldTokens leaves unclaimed obligations in contract", async function () {
    const buyAmt = ethers.parseEther("1000");
    const Sale = await ethers.getContractFactory("WLABTokenSale");
    const saleTight = await Sale.deploy(await token.getAddress(), ethers.ZeroAddress, owner.address);
    await token.connect(owner).mint(await saleTight.getAddress(), buyAmt);

    await saleTight.configurePhase(3, PRICE, buyAmt, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0);
    await saleTight.startPhase(3);
    await saleTight.connect(buyer).buy(buyAmt, [], { value: costOf(buyAmt) });
    await saleTight.connect(owner).finalizeSale();

    expect(await saleTight.totalUnclaimedTokens()).to.equal(buyAmt);
    await expect(saleTight.connect(owner).recoverUnsoldTokens(owner.address)).to.be.revertedWith(
      "Sale: nothing recoverable"
    );
    expect(await token.balanceOf(await saleTight.getAddress())).to.equal(buyAmt);
  });

  it("recoverUnsoldTokens returns only excess after all claims", async function () {
    await setupPublicPhase();
    const buyAmt = ethers.parseEther("500");
    await sale.connect(buyer).buy(buyAmt, [], { value: costOf(buyAmt) });
    await sale.connect(owner).finalizeSale();
    await sale.connect(buyer).claim(3);

    const saleAddr = await sale.getAddress();
    const bal = await token.balanceOf(saleAddr);
    const treasuryBefore = await token.balanceOf(owner.address);
    await sale.connect(owner).recoverUnsoldTokens(owner.address);
    const treasuryAfter = await token.balanceOf(owner.address);

    expect(treasuryAfter - treasuryBefore).to.equal(bal);
    expect(await token.balanceOf(saleAddr)).to.equal(0n);
  });

  it("recoverUnsoldTokens preserves all unclaimed obligations across successful phases", async function () {
    const easySoftCap = ethers.parseEther("0.0001");
    const publicBuy = ethers.parseEther("500");
    const privateBuy = ethers.parseEther("750");
    const totalOwed = publicBuy + privateBuy;

    await sale.configurePhase(3, PRICE, ALLOCATION, HARD_CAP, easySoftCap, ethers.ZeroHash, 0);
    await sale.configurePhase(2, PRICE, ALLOCATION, HARD_CAP, easySoftCap, ethers.ZeroHash, 0);

    await sale.startPhase(3);
    await sale.connect(buyer).buy(publicBuy, [], { value: costOf(publicBuy) });
    await sale.connect(owner).finalizePhase(3);

    await sale.startPhase(2);
    await sale.connect(buyer2).buy(privateBuy, [], { value: costOf(privateBuy) });
    await sale.connect(owner).finalizePhase(2);
    await sale.connect(owner).finalizeSale();

    expect(await sale.totalUnclaimedTokens()).to.equal(totalOwed);

    await sale.connect(owner).recoverUnsoldTokens(owner.address);
    expect(await token.balanceOf(await sale.getAddress())).to.equal(totalOwed);

    await sale.connect(buyer).claim(3);
    await sale.connect(buyer2).claim(2);
    expect(await sale.totalUnclaimedTokens()).to.equal(0n);
    expect(await token.balanceOf(buyer.address)).to.equal(publicBuy);
    expect(await token.balanceOf(buyer2.address)).to.equal(privateBuy);
  });

  it("reverts when payment rounds to zero", async function () {
    await sale.configurePhase(3, 1n, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0);
    await sale.startPhase(3);
    await expect(sale.connect(buyer).buy(1n, [], { value: 0 })).to.be.revertedWith("Sale: payment rounds to zero");
  });

  it("enforces per-wallet cap when configured", async function () {
    const cap = ethers.parseEther("1000");
    await sale.configurePhase(3, PRICE, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, cap);
    await sale.startPhase(3);
    const first = ethers.parseEther("600");
    const second = ethers.parseEther("500");
    await sale.connect(buyer).buy(first, [], { value: costOf(first) });
    await expect(
      sale.connect(buyer).buy(second, [], { value: costOf(second) })
    ).to.be.revertedWith("Sale: wallet cap");
  });

  it("syncs phase analytics after refund", async function () {
    await sale.configurePhase(3, ethers.parseEther("0.01"), ethers.parseEther("1000"), ethers.parseEther("100"), ethers.parseEther("1"), ethers.ZeroHash, 0);
    await sale.startPhase(3);
    const buyAmt = ethers.parseEther("10");
    const paid = ethers.parseEther("0.1");
    await sale.connect(buyer).buy(buyAmt, [], { value: paid });
    await sale.connect(owner).finalizeSale();
    await sale.connect(buyer).refund(3);
    const cfg = await sale.phases(3);
    expect(cfg.tokensSold).to.equal(0n);
    expect(cfg.totalRaisedWei).to.equal(0n);
  });

  // ── owner withdraws funds after success ───────────────────────────────────
  it("owner withdraws ETH after successful sale", async function () {
    await setupPublicPhase();
    const amt = ethers.parseEther("1000");
    await sale.connect(buyer).buy(amt, [], { value: costOf(amt) });
    await sale.connect(owner).finalizeSale();

    const before = await ethers.provider.getBalance(owner.address);
    const tx     = await sale.connect(owner).withdrawFunds(owner.address);
    const rcpt   = await tx.wait();
    const gas    = rcpt.gasUsed * tx.gasPrice;
    const after  = await ethers.provider.getBalance(owner.address);

    expect(after + gas).to.be.gt(before);
  });

  // ── Phase 1C regression: per-phase refund state ───────────────────────────
  // A failed phase must not block a successful phase's claims or owner withdrawal.
  describe("multi-phase refund isolation", function () {
    // Helpers configure each phase explicitly so per-scenario soft caps and
    // allocations are obvious in the test body, not in shared setup.
    async function configurePhaseWith(phase, allocation, softCap) {
      await sale.configurePhase(
        phase,
        PRICE,
        allocation,
        HARD_CAP,
        softCap,
        ethers.ZeroHash,
        0
      );
    }

    it("success + fail: successful phase claim works, failed phase refunds, withdrawal sweeps only success", async function () {
      const easySoftCap = ethers.parseEther("0.0001"); // any tiny buy meets this
      const hardSoftCap = ethers.parseEther("10");     // requires raising 10 ETH

      // Public succeeds.
      await configurePhaseWith(3, ALLOCATION, easySoftCap);
      // Seed will fail because the buyer's contribution is far below 10 ETH.
      await configurePhaseWith(1, ALLOCATION, hardSoftCap);

      await sale.startPhase(3);
      const publicBuy = ethers.parseEther("500");
      await sale.connect(buyer).buy(publicBuy, [], { value: costOf(publicBuy) });
      await sale.connect(owner).finalizePhase(3);

      await sale.startPhase(1);
      const seedBuy = ethers.parseEther("100");
      await sale.connect(buyer2).buy(seedBuy, [], { value: costOf(seedBuy) });
      await sale.connect(owner).finalizePhase(1);

      expect(await sale.phaseRefundsEnabled(3)).to.equal(false);
      expect(await sale.phaseRefundsEnabled(1)).to.equal(true);

      // Successful Public phase claim works despite failed Seed phase.
      const balBefore = await token.balanceOf(buyer.address);
      await sale.connect(buyer).claim(3);
      const balAfter = await token.balanceOf(buyer.address);
      expect(balAfter - balBefore).to.equal(publicBuy);

      // Failed Seed phase refunds work for the Seed buyer.
      const ethBefore = await ethers.provider.getBalance(buyer2.address);
      const refundTx = await sale.connect(buyer2).refund(1);
      const refundRcpt = await refundTx.wait();
      const refundGas = refundRcpt.gasUsed * refundTx.gasPrice;
      const ethAfter = await ethers.provider.getBalance(buyer2.address);
      expect(ethAfter + refundGas - ethBefore).to.equal(costOf(seedBuy));

      // Public buyer cannot refund a successful phase they bought into.
      await expect(sale.connect(buyer).refund(3)).to.be.revertedWith("Sale: refunds off");

      // Finalize the global sale flag now that no phase is active.
      await sale.connect(owner).finalizeSale();

      // Owner withdrawal: only the successful Public phase's raised wei.
      const expectedWithdraw = costOf(publicBuy);
      expect(await sale.withdrawableRaisedWei()).to.equal(expectedWithdraw);

      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const wTx = await sale.connect(owner).withdrawFunds(owner.address);
      const wRcpt = await wTx.wait();
      const wGas = wRcpt.gasUsed * wTx.gasPrice;
      const ownerAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerAfter + wGas - ownerBefore).to.equal(expectedWithdraw);
      expect(await sale.withdrawableRaisedWei()).to.equal(0n);
    });

    it("success + success: claims succeed across both phases, owner withdraws full sum", async function () {
      const easy = ethers.parseEther("0.0001");
      await configurePhaseWith(3, ALLOCATION, easy);
      await configurePhaseWith(2, ALLOCATION, easy);

      await sale.startPhase(3);
      const publicBuy = ethers.parseEther("500");
      await sale.connect(buyer).buy(publicBuy, [], { value: costOf(publicBuy) });
      await sale.connect(owner).finalizePhase(3);

      await sale.startPhase(2);
      const privateBuy = ethers.parseEther("750");
      await sale.connect(buyer2).buy(privateBuy, [], { value: costOf(privateBuy) });
      await sale.connect(owner).finalizePhase(2);

      expect(await sale.phaseRefundsEnabled(3)).to.equal(false);
      expect(await sale.phaseRefundsEnabled(2)).to.equal(false);

      await sale.connect(buyer).claim(3);
      await sale.connect(buyer2).claim(2);

      expect(await token.balanceOf(buyer.address)).to.equal(publicBuy);
      expect(await token.balanceOf(buyer2.address)).to.equal(privateBuy);

      await sale.connect(owner).finalizeSale();
      const total = costOf(publicBuy) + costOf(privateBuy);
      expect(await sale.withdrawableRaisedWei()).to.equal(total);
    });

    it("fail + fail: both refunds work, nothing claimable, withdrawableRaisedWei stays zero", async function () {
      const hardSoftCap = ethers.parseEther("10");
      await configurePhaseWith(1, ALLOCATION, hardSoftCap);
      await configurePhaseWith(2, ALLOCATION, hardSoftCap);

      await sale.startPhase(1);
      const seedBuy = ethers.parseEther("100");
      await sale.connect(buyer).buy(seedBuy, [], { value: costOf(seedBuy) });
      await sale.connect(owner).finalizePhase(1);

      await sale.startPhase(2);
      const privateBuy = ethers.parseEther("100");
      await sale.connect(buyer2).buy(privateBuy, [], { value: costOf(privateBuy) });
      await sale.connect(owner).finalizePhase(2);

      expect(await sale.phaseRefundsEnabled(1)).to.equal(true);
      expect(await sale.phaseRefundsEnabled(2)).to.equal(true);
      expect(await sale.refundsEnabled()).to.equal(true);

      await expect(sale.connect(buyer).claim(1)).to.be.revertedWith(
        "Sale: refunds active, claim disabled"
      );
      await expect(sale.connect(buyer2).claim(2)).to.be.revertedWith(
        "Sale: refunds active, claim disabled"
      );

      await sale.connect(buyer).refund(1);
      await sale.connect(buyer2).refund(2);

      await sale.connect(owner).finalizeSale();
      expect(await sale.withdrawableRaisedWei()).to.equal(0n);
      await expect(sale.connect(owner).withdrawFunds(owner.address)).to.be.revertedWith(
        "Sale: nothing to withdraw"
      );
    });
  });

  // ── Phase 9 branch coverage: defensive paths and ERC20 payment flow ────────
  describe("branch coverage", function () {
    it("constructor rejects zero sale token", async function () {
      const Sale = await ethers.getContractFactory("WLABTokenSale");
      await expect(
        Sale.deploy(ethers.ZeroAddress, ethers.ZeroAddress, owner.address)
      ).to.be.revertedWith("Sale: zero address");
    });

    it("configurePhase rejects every input invariant", async function () {
      await expect(
        sale.configurePhase(0, PRICE, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0)
      ).to.be.revertedWith("Sale: invalid phase");
      await expect(
        sale.configurePhase(3, 0, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0)
      ).to.be.revertedWith("Sale: zero price");
      await expect(
        sale.configurePhase(3, PRICE, 0, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0)
      ).to.be.revertedWith("Sale: zero allocation");
      await expect(
        sale.configurePhase(3, PRICE, ALLOCATION, ethers.parseEther("1"), ethers.parseEther("2"), ethers.ZeroHash, 0)
      ).to.be.revertedWith("Sale: invalid caps");
    });

    it("startPhase rejects an unconfigured phase", async function () {
      await expect(sale.startPhase(2)).to.be.revertedWith("Sale: not configured");
    });

    it("buy rejects when there is no active phase", async function () {
      await expect(
        sale.connect(buyer).buy(ethers.parseEther("100"), [], { value: 0 })
      ).to.be.revertedWith("Sale: no active phase");
    });

    it("buy rejects after the phase is finalized but before another phase starts", async function () {
      await setupPublicPhase();
      await sale.connect(owner).finalizePhase(3);
      await expect(
        sale.connect(buyer).buy(ethers.parseEther("100"), [], { value: 0 })
      ).to.be.revertedWith("Sale: no active phase");
    });

    it("buy rejects zero token amount and insufficient ETH", async function () {
      await setupPublicPhase();
      await expect(
        sale.connect(buyer).buy(0, [], { value: 0 })
      ).to.be.revertedWith("Sale: zero amount");

      const buyAmt = ethers.parseEther("100");
      await expect(
        sale.connect(buyer).buy(buyAmt, [], { value: 0 })
      ).to.be.revertedWith("Sale: insufficient ETH");
    });

    it("buy refunds the excess ETH to the buyer when overpaid", async function () {
      await setupPublicPhase();
      const buyAmt = ethers.parseEther("100");
      const cost = costOf(buyAmt);
      const overpay = cost + ethers.parseEther("0.01");

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await sale.connect(buyer).buy(buyAmt, [], { value: overpay });
      const rcpt = await tx.wait();
      const gas = rcpt.gasUsed * tx.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);

      // Net ETH spent must equal exactly cost + gas — excess refund kicked in.
      expect(balBefore - balAfter - gas).to.equal(cost);
    });

    it("buy rejects when allocation or hard cap would be exceeded", async function () {
      // Tiny allocation with a moderate hard cap.
      await sale.configurePhase(
        3,
        PRICE,
        ethers.parseEther("100"),  // allocation
        HARD_CAP,
        SOFT_CAP,
        ethers.ZeroHash,
        0
      );
      await sale.startPhase(3);
      await expect(
        sale.connect(buyer).buy(ethers.parseEther("101"), [], { value: costOf(ethers.parseEther("101")) })
      ).to.be.revertedWith("Sale: allocation exceeded");

      // Reset for hard-cap test in a separate phase. Tiny hard cap, large allocation.
      await sale.configurePhase(
        2,
        PRICE,
        ALLOCATION,
        ethers.parseEther("0.001"),
        ethers.parseEther("0.0001"),
        ethers.ZeroHash,
        0
      );
      await sale.startPhase(2);
      await expect(
        sale.connect(buyer).buy(ethers.parseEther("100"), [], { value: costOf(ethers.parseEther("100")) })
      ).to.be.revertedWith("Sale: hard cap");
    });

    it("finalizePhase rejects None, unconfigured, or already-finalized phases", async function () {
      await expect(sale.connect(owner).finalizePhase(0)).to.be.revertedWith("Sale: invalid phase");
      await expect(sale.connect(owner).finalizePhase(2)).to.be.revertedWith("Sale: not configured");

      await setupPublicPhase();
      await sale.connect(owner).finalizePhase(3);
      await expect(sale.connect(owner).finalizePhase(3)).to.be.revertedWith("Sale: phase finalized");
    });

    it("finalizeSale rejects double-finalize and accepts the no-active-phase happy path", async function () {
      await setupPublicPhase();
      await sale.connect(buyer).buy(ethers.parseEther("250"), [], { value: costOf(ethers.parseEther("250")) });
      await sale.connect(owner).finalizePhase(3);
      // No active phase, but a finalized one exists — finalizeSale should succeed.
      await sale.connect(owner).finalizeSale();
      await expect(sale.connect(owner).finalizeSale()).to.be.revertedWith("Sale: already finalized");
    });

    it("claim rejects before finalization and when nothing was purchased", async function () {
      await setupPublicPhase();
      await expect(sale.connect(buyer).claim(3)).to.be.revertedWith("Sale: not finalized");

      await sale.connect(buyer).buy(ethers.parseEther("250"), [], { value: costOf(ethers.parseEther("250")) });
      await sale.connect(owner).finalizeSale();
      // buyer2 never bought into phase 3.
      await expect(sale.connect(buyer2).claim(3)).to.be.revertedWith("Sale: nothing to claim");
    });

    it("refund rejects when the phase did not enter refund mode", async function () {
      await setupPublicPhase();
      await sale.connect(buyer).buy(ethers.parseEther("250"), [], { value: costOf(ethers.parseEther("250")) });
      await sale.connect(owner).finalizeSale();
      await expect(sale.connect(buyer).refund(3)).to.be.revertedWith("Sale: refunds off");
    });

    it("refund rejects when the caller has no contribution in a refund-eligible phase", async function () {
      await sale.configurePhase(
        3,
        PRICE,
        ALLOCATION,
        ethers.parseEther("100"),
        ethers.parseEther("10"),
        ethers.ZeroHash,
        0
      );
      await sale.startPhase(3);
      await sale.connect(buyer).buy(ethers.parseEther("100"), [], { value: costOf(ethers.parseEther("100")) });
      await sale.connect(owner).finalizeSale();
      await expect(sale.connect(buyer2).refund(3)).to.be.revertedWith("Sale: nothing to refund");
    });

    it("withdrawFunds rejects pre-finalize and zero-address recipient", async function () {
      await setupPublicPhase();
      await expect(sale.connect(owner).withdrawFunds(owner.address)).to.be.revertedWith(
        "Sale: not allowed"
      );

      await sale.connect(buyer).buy(ethers.parseEther("250"), [], { value: costOf(ethers.parseEther("250")) });
      await sale.connect(owner).finalizeSale();
      await expect(
        sale.connect(owner).withdrawFunds(ethers.ZeroAddress)
      ).to.be.revertedWith("Sale: zero to");
    });

    it("recoverUnsoldTokens rejects pre-finalize and zero-address recipient", async function () {
      await setupPublicPhase();
      await expect(
        sale.connect(owner).recoverUnsoldTokens(owner.address)
      ).to.be.revertedWith("Sale: not finalized");

      await sale.connect(buyer).buy(ethers.parseEther("250"), [], { value: costOf(ethers.parseEther("250")) });
      await sale.connect(owner).finalizeSale();
      await expect(
        sale.connect(owner).recoverUnsoldTokens(ethers.ZeroAddress)
      ).to.be.revertedWith("Sale: zero to");
    });

    it("non-owner cannot configure, start, finalize, withdraw, or recover", async function () {
      const expectOwnerRevert = (call) =>
        expect(call).to.be.revertedWithCustomError(sale, "OwnableUnauthorizedAccount");

      await expectOwnerRevert(
        sale.connect(buyer).configurePhase(3, PRICE, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0)
      );
      await expectOwnerRevert(sale.connect(buyer).startPhase(3));
      await expectOwnerRevert(sale.connect(buyer).finalizePhase(3));
      await expectOwnerRevert(sale.connect(buyer).finalizeSale());
      await expectOwnerRevert(sale.connect(buyer).withdrawFunds(buyer.address));
      await expectOwnerRevert(sale.connect(buyer).recoverUnsoldTokens(buyer.address));
    });

    describe("ERC20 payment token path", function () {
      let payment, saleErc20;
      const PRICE_ERC20 = ethers.parseEther("0.5"); // 0.5 USDC-ish per token
      const ALLOCATION_ERC20 = ethers.parseEther("10000");
      const HARD_CAP_ERC20 = ethers.parseEther("10000");
      const SOFT_CAP_ERC20 = ethers.parseEther("100");

      beforeEach(async function () {
        const Token = await ethers.getContractFactory("WLABToken");
        payment = await Token.deploy(owner.address, treasury.address);
        await token.connect(owner).setFeeExempt(buyer.address, true);
        await payment.connect(owner).setFeeExempt(buyer.address, true);
        await payment.connect(owner).setFeeExempt(owner.address, true);
        await payment.connect(owner).mint(buyer.address, ethers.parseEther("1000"));

        const Sale = await ethers.getContractFactory("WLABTokenSale");
        saleErc20 = await Sale.deploy(
          await token.getAddress(),
          await payment.getAddress(),
          owner.address
        );
        await token.connect(owner).mint(await saleErc20.getAddress(), ethers.parseEther("100000"));

        await saleErc20.configurePhase(
          3,
          PRICE_ERC20,
          ALLOCATION_ERC20,
          HARD_CAP_ERC20,
          SOFT_CAP_ERC20,
          ethers.ZeroHash,
          0
        );
        await saleErc20.startPhase(3);
      });

      it("buy rejects ETH when an ERC20 payment token is configured", async function () {
        await payment.connect(buyer).approve(await saleErc20.getAddress(), ethers.parseEther("1000"));
        await expect(
          saleErc20.connect(buyer).buy(ethers.parseEther("100"), [], { value: 1n })
        ).to.be.revertedWith("Sale: ETH not accepted");
      });

      it("ERC20 buy → claim transfers exact entitlement", async function () {
        const tokenAmt = ethers.parseEther("400");
        const cost = (tokenAmt * PRICE_ERC20) / ethers.parseEther("1");

        await payment.connect(buyer).approve(await saleErc20.getAddress(), cost);
        await saleErc20.connect(buyer).buy(tokenAmt, [], {});
        await saleErc20.connect(owner).finalizeSale();

        await saleErc20.connect(buyer).claim(3);
        expect(await token.balanceOf(buyer.address)).to.equal(tokenAmt);
        expect(await saleErc20.totalUnclaimedTokens()).to.equal(0n);
      });

      it("ERC20 refund flow returns the payment-token contribution", async function () {
        const tokenAmt = ethers.parseEther("100");
        const cost = (tokenAmt * PRICE_ERC20) / ethers.parseEther("1");

        await payment.connect(buyer).approve(await saleErc20.getAddress(), cost);
        await saleErc20.connect(buyer).buy(tokenAmt, [], {});
        await saleErc20.connect(owner).finalizeSale();

        // Soft cap is 100 ether of payment, contribution was 50 ether — should fail.
        expect(await saleErc20.phaseRefundsEnabled(3)).to.equal(true);
        const before = await payment.balanceOf(buyer.address);
        await saleErc20.connect(buyer).refund(3);
        const after = await payment.balanceOf(buyer.address);
        expect(after - before).to.equal(cost);
      });

      it("ERC20 withdrawFunds sweeps successful-phase payment tokens to the owner", async function () {
        const tokenAmt = ethers.parseEther("400");
        const cost = (tokenAmt * PRICE_ERC20) / ethers.parseEther("1");

        await payment.connect(buyer).approve(await saleErc20.getAddress(), cost);
        await saleErc20.connect(buyer).buy(tokenAmt, [], {});
        await saleErc20.connect(owner).finalizeSale();

        const before = await payment.balanceOf(owner.address);
        await saleErc20.connect(owner).withdrawFunds(owner.address);
        const after = await payment.balanceOf(owner.address);
        expect(after - before).to.equal(cost);
        expect(await saleErc20.withdrawableRaisedWei()).to.equal(0n);
      });
    });
  });
});
