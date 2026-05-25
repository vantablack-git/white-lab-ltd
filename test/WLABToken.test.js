const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WLABToken", function () {
  let token, admin, user, treasury;

  beforeEach(async function () {
    [admin, user, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(admin.address, treasury.address);
  });

  it("has correct name and max supply", async function () {
    expect(await token.name()).to.equal("WhiteLab");
    expect(await token.symbol()).to.equal("WLAB");
    expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("1000000000"));
  });

  it("mints within cap", async function () {
    await token.connect(admin).mint(user.address, ethers.parseEther("1000"));
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("1000"));
  });

  it("reverts mint over cap", async function () {
    await expect(
      token.connect(admin).mint(user.address, ethers.parseEther("1000000001"))
    ).to.be.revertedWith("WLAB: max supply");
  });

  it("pauses transfers", async function () {
    await token.connect(admin).mint(user.address, ethers.parseEther("10"));
    await token.connect(admin).pause();
    await expect(
      token.connect(user).transfer(admin.address, 1n)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");
  });

  it("blacklists blocked addresses", async function () {
    await token.connect(admin).mint(admin.address, ethers.parseEther("10"));
    await token.connect(admin).setBlacklisted(user.address, true);
    await expect(
      token.connect(admin).transfer(user.address, 1n)
    ).to.be.revertedWith("WLAB: blacklisted");
  });

  it("burns user tokens", async function () {
    await token.connect(admin).mint(user.address, ethers.parseEther("5"));
    await token.connect(user).burn(ethers.parseEther("2"));
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("3"));
  });

  it("applies transfer fee when enabled", async function () {
    await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
    await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));
    const before = await token.balanceOf(user.address);
    await token.connect(admin).transfer(user.address, ethers.parseEther("100"));
    const received = (await token.balanceOf(user.address)) - before;
    expect(received).to.be.lt(ethers.parseEther("100"));
    // net = 99 WLAB (1% fee)
    expect(received).to.equal(ethers.parseEther("99"));
  });

  it("skips transfer fee for explicit fee-exempt accounts", async function () {
    await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
    await token.connect(admin).setFeeExempt(admin.address, true);
    await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));

    await token.connect(admin).transfer(user.address, ethers.parseEther("100"));

    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("100"));
    expect(await token.balanceOf(treasury.address)).to.equal(0n);
  });

  it("creates snapshot", async function () {
    await token.connect(admin).mint(user.address, ethers.parseEther("1"));
    await expect(token.connect(admin).snapshot()).to.emit(token, "Snapshot");
  });

  // ── Phase 1E regression: fee path is symmetric with no-fee on the sender side ─
  it("emits exactly one Transfer with from=sender, matching the no-fee path", async function () {
    await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
    await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));

    // No-fee baseline: admin is fee-exempt.
    await token.connect(admin).setFeeExempt(admin.address, true);
    const noFeeTx = await token.connect(admin).transfer(user.address, ethers.parseEther("50"));
    const noFeeRcpt = await noFeeTx.wait();
    const noFeeFromAdmin = noFeeRcpt.logs.filter((log) => {
      try {
        const parsed = token.interface.parseLog(log);
        return parsed?.name === "Transfer" && parsed.args.from === admin.address;
      } catch {
        return false;
      }
    });

    // Fee-on transfer with admin no longer fee-exempt.
    await token.connect(admin).setFeeExempt(admin.address, false);
    const feeTx = await token.connect(admin).transfer(user.address, ethers.parseEther("100"));
    const feeRcpt = await feeTx.wait();
    const feeFromAdmin = feeRcpt.logs.filter((log) => {
      try {
        const parsed = token.interface.parseLog(log);
        return parsed?.name === "Transfer" && parsed.args.from === admin.address;
      } catch {
        return false;
      }
    });

    // Sender-side event count must be identical between the two paths.
    expect(feeFromAdmin.length).to.equal(noFeeFromAdmin.length);
    expect(feeFromAdmin.length).to.equal(1);

    // The single sender-side event carries the gross value, not the net.
    const parsed = token.interface.parseLog(feeFromAdmin[0]);
    expect(parsed.args.to).to.equal(user.address);
    expect(parsed.args.value).to.equal(ethers.parseEther("100"));

    // Vote checkpoint accounting is unchanged: admin's votes drop by gross.
    await token.connect(admin).delegate(admin.address);
    const checkpointsBefore = await token.numCheckpoints(admin.address);
    await token.connect(admin).transfer(user.address, ethers.parseEther("10"));
    const checkpointsAfter = await token.numCheckpoints(admin.address);
    // Exactly one checkpoint added per logical transfer (matches no-fee).
    expect(checkpointsAfter - checkpointsBefore).to.equal(1n);
  });

  // ── P0 votes regression: fee + votes checkpoint ───────────────────────────
  it("P0 votes: getVotes correct after fee-bearing transfer", async function () {
    await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
    await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));

    // Both parties delegate to themselves
    await token.connect(admin).delegate(admin.address);
    await token.connect(user).delegate(user.address);

    const adminBalBefore  = await token.balanceOf(admin.address);
    const adminVoteBefore = await token.getVotes(admin.address);
    expect(adminVoteBefore).to.equal(adminBalBefore);

    await token.connect(admin).transfer(user.address, ethers.parseEther("100"));

    const fee        = ethers.parseEther("1");   // 1% of 100
    const net        = ethers.parseEther("99");
    const burnShare  = (fee * 7000n) / 10000n;   // 0.7 WLAB burned

    // Admin votes should drop by exactly 100 (net + fee deducted from admin)
    const adminBalAfter  = await token.balanceOf(admin.address);
    const adminVoteAfter = await token.getVotes(admin.address);
    expect(adminVoteAfter).to.equal(adminBalAfter);

    // User received net tokens
    expect(await token.balanceOf(user.address)).to.equal(net);
    expect(await token.getVotes(user.address)).to.equal(net);

    // Treasury received fee minus burn share
    const treasuryBal = await token.balanceOf(treasury.address);
    expect(treasuryBal).to.equal(fee - burnShare);
  });
});
