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
});
