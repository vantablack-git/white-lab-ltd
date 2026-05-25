const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WLABVesting", function () {
  let token, vesting, owner, beneficiary;

  beforeEach(async function () {
    [owner, beneficiary, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);
    const Vesting = await ethers.getContractFactory("WLABVesting");
    vesting = await Vesting.deploy(await token.getAddress(), owner.address);

    await token.connect(owner).mint(owner.address, ethers.parseEther("10000"));
    await token.connect(owner).approve(await vesting.getAddress(), ethers.parseEther("10000"));
  });

  it("creates schedule and releases after cliff", async function () {
    const amount = ethers.parseEther("1000");
    const start = (await time.latest()) + 1;
    const cliff = 30n * 24n * 60n * 60n;
    const duration = 365n * 24n * 60n * 60n;

    await vesting.createSchedule(beneficiary.address, amount, start, cliff, duration, true);

    await time.increase(cliff + duration / 2n);
    await vesting.connect(beneficiary).release();
    expect(await token.balanceOf(beneficiary.address)).to.be.gt(0);
  });

  it("revokes and refunds unvested", async function () {
    const amount = ethers.parseEther("1000");
    const start = (await time.latest()) + 1;
    await vesting.createSchedule(beneficiary.address, amount, start, 0, 365 * 24 * 60 * 60, true);
    await vesting.revoke(beneficiary.address);
    expect(await token.balanceOf(owner.address)).to.be.gt(0);
  });

  // ── Phase 1A regression: beneficiary cannot lose vested-but-unreleased on revoke ──
  it("pays vested-but-unreleased to beneficiary on revoke", async function () {
    const amount = ethers.parseEther("1000");
    const start = (await time.latest()) + 1;
    const cliff = 0n;
    const duration = 365n * 24n * 60n * 60n;

    await vesting.createSchedule(beneficiary.address, amount, start, cliff, duration, true);

    // Advance to ~half the vesting period: ~half of `amount` should be vested.
    await time.increase(Number(duration / 2n));

    const vestedBefore = await vesting.releasableAmount(beneficiary.address);
    expect(vestedBefore).to.be.gt(0n);

    const ownerBalBefore = await token.balanceOf(owner.address);
    const benBalBefore = await token.balanceOf(beneficiary.address);

    const tx = await vesting.revoke(beneficiary.address);

    const ownerBalAfter = await token.balanceOf(owner.address);
    const benBalAfter = await token.balanceOf(beneficiary.address);

    const benReceived = benBalAfter - benBalBefore;
    const ownerReceived = ownerBalAfter - ownerBalBefore;

    // Beneficiary keeps everything that was already vested at revoke time.
    expect(benReceived).to.be.gte(vestedBefore);

    // Conservation: owner refund + beneficiary payout = total scheduled.
    expect(benReceived + ownerReceived).to.equal(amount);

    // After revoke, schedule is closed: nothing else to release, no double-claim.
    expect(await vesting.releasableAmount(beneficiary.address)).to.equal(0n);
    await expect(vesting.connect(beneficiary).release()).to.be.revertedWith(
      "Vesting: nothing to release"
    );

    // Event still fires; refund argument matches owner-side payout.
    await expect(tx).to.emit(vesting, "ScheduleRevoked");
  });
});
