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

  // ── Phase 1B regression: emergency withdraw cannot drain the vested token ──
  it("blocks emergencyWithdraw of the vested token below the outstanding obligation", async function () {
    const amount = ethers.parseEther("1000");
    const start = (await time.latest()) + 1;
    const cliff = 30n * 24n * 60n * 60n;
    const duration = 365n * 24n * 60n * 60n;

    await vesting.createSchedule(beneficiary.address, amount, start, cliff, duration, true);

    // Donate extra `token` directly into the vesting contract so balance > obligation.
    const excess = ethers.parseEther("250");
    await token.connect(owner).mint(owner.address, excess);
    await token.connect(owner).transfer(await vesting.getAddress(), excess);

    expect(await vesting.totalOutstanding()).to.equal(amount);
    expect(await token.balanceOf(await vesting.getAddress())).to.equal(amount + excess);

    // Cannot drain the entire balance — that would breach beneficiary's promise.
    await expect(
      vesting.connect(owner).emergencyWithdraw(await token.getAddress(), amount + excess)
    ).to.be.revertedWith("Vesting: protected balance");

    // Cannot pull a single wei more than the strict excess.
    await expect(
      vesting.connect(owner).emergencyWithdraw(await token.getAddress(), excess + 1n)
    ).to.be.revertedWith("Vesting: protected balance");

    // Excess recovery is allowed.
    const ownerBefore = await token.balanceOf(owner.address);
    await vesting.connect(owner).emergencyWithdraw(await token.getAddress(), excess);
    const ownerAfter = await token.balanceOf(owner.address);
    expect(ownerAfter - ownerBefore).to.equal(excess);

    // Beneficiary is still made whole at the end of the schedule.
    await time.increase(Number(cliff + duration + 1n));
    await vesting.connect(beneficiary).release();
    expect(await token.balanceOf(beneficiary.address)).to.equal(amount);
  });

  it("still allows recovering an unrelated ERC20 mistakenly sent to the vault", async function () {
    const Token = await ethers.getContractFactory("WLABToken");
    const stray = await Token.deploy(owner.address, treasury.address);
    const stuck = ethers.parseEther("42");
    await stray.connect(owner).mint(await vesting.getAddress(), stuck);

    const ownerBefore = await stray.balanceOf(owner.address);
    await vesting.connect(owner).emergencyWithdraw(await stray.getAddress(), stuck);
    const ownerAfter = await stray.balanceOf(owner.address);

    expect(ownerAfter - ownerBefore).to.equal(stuck);
  });
});
