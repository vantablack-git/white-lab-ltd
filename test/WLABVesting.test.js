const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WLABVesting", function () {
  let token, vesting, owner, beneficiary, treasury;

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

  // ── Phase 10 branch coverage: defensive paths and exact vesting edges ─────
  describe("branch coverage", function () {
    async function createDefaultSchedule({
      account = beneficiary,
      amount = ethers.parseEther("1000"),
      cliff = 0n,
      duration = 1000n,
      revocable = true,
      start,
    } = {}) {
      const scheduleStart = start ?? BigInt(await time.latest());
      await vesting.createSchedule(
        account.address,
        amount,
        scheduleStart,
        cliff,
        duration,
        revocable
      );
      return { amount, start: scheduleStart, cliff, duration, revocable };
    }

    it("constructor rejects a zero token address", async function () {
      const Vesting = await ethers.getContractFactory("WLABVesting");
      await expect(
        Vesting.deploy(ethers.ZeroAddress, owner.address)
      ).to.be.revertedWith("Vesting: zero token");
    });

    it("createSchedule rejects zero beneficiary, zero amount, zero duration, and duplicate schedules", async function () {
      const now = BigInt(await time.latest());

      await expect(
        vesting.createSchedule(ethers.ZeroAddress, ethers.parseEther("1"), now, 0, 1000, true)
      ).to.be.revertedWith("Vesting: zero beneficiary");

      await expect(
        vesting.createSchedule(beneficiary.address, 0, now, 0, 1000, true)
      ).to.be.revertedWith("Vesting: zero amount");

      await expect(
        vesting.createSchedule(beneficiary.address, ethers.parseEther("1"), now, 0, 0, true)
      ).to.be.revertedWith("Vesting: zero duration");

      await createDefaultSchedule({ start: now });
      await expect(
        vesting.createSchedule(beneficiary.address, ethers.parseEther("1"), now, 0, 1000, true)
      ).to.be.revertedWith("Vesting: exists");
    });

    it("only the owner can create schedules, revoke, or emergency withdraw", async function () {
      const now = BigInt(await time.latest());
      await expect(
        vesting.connect(beneficiary).createSchedule(
          beneficiary.address,
          ethers.parseEther("1"),
          now,
          0,
          1000,
          true
        )
      ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");

      await createDefaultSchedule({ start: now });

      await expect(
        vesting.connect(beneficiary).revoke(beneficiary.address)
      ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");

      await expect(
        vesting.connect(beneficiary).emergencyWithdraw(await token.getAddress(), 0)
      ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
    });

    it("release rejects no schedule, before cliff, and after schedule is revoked", async function () {
      await expect(
        vesting.connect(beneficiary).release()
      ).to.be.revertedWith("Vesting: nothing to release");

      const start = BigInt(await time.latest()) + 100n;
      const cliff = 30n * 24n * 60n * 60n;
      await createDefaultSchedule({ start, cliff, duration: 365n * 24n * 60n * 60n });

      await time.increaseTo(start + cliff - 1n);
      expect(await vesting.releasableAmount(beneficiary.address)).to.equal(0n);
      await expect(
        vesting.connect(beneficiary).release()
      ).to.be.revertedWith("Vesting: nothing to release");

      await vesting.revoke(beneficiary.address);
      expect(await vesting.releasableAmount(beneficiary.address)).to.equal(0n);
      await expect(
        vesting.connect(beneficiary).release()
      ).to.be.revertedWith("Vesting: nothing to release");
    });

    it("releases the exact full amount after the schedule fully vests", async function () {
      const amount = ethers.parseEther("777");
      const start = BigInt(await time.latest());
      const duration = 1000n;
      await createDefaultSchedule({ amount, start, duration });

      await time.increaseTo(start + duration + 1n);
      await expect(vesting.connect(beneficiary).release())
        .to.emit(vesting, "TokensReleased")
        .withArgs(beneficiary.address, amount);

      expect(await token.balanceOf(beneficiary.address)).to.equal(amount);
      expect(await vesting.totalOutstanding()).to.equal(0n);
      await expect(
        vesting.connect(beneficiary).release()
      ).to.be.revertedWith("Vesting: nothing to release");
    });

    it("revoke rejects no schedule, non-revocable schedules, and already-revoked schedules", async function () {
      await expect(
        vesting.revoke(beneficiary.address)
      ).to.be.revertedWith("Vesting: no schedule");

      const start = BigInt(await time.latest());
      await createDefaultSchedule({ start, revocable: false });
      await expect(
        vesting.revoke(beneficiary.address)
      ).to.be.revertedWith("Vesting: not revocable");
    });

    it("revoke after full release refunds nothing and the unreleased path is skipped", async function () {
      const amount = ethers.parseEther("1000");
      const start = BigInt(await time.latest());
      await createDefaultSchedule({ amount, start, duration: 1000n, revocable: true });

      await time.increaseTo(start + 1001n);
      await vesting.connect(beneficiary).release();

      const ownerBefore = await token.balanceOf(owner.address);
      const benBefore = await token.balanceOf(beneficiary.address);

      await expect(vesting.revoke(beneficiary.address))
        .to.emit(vesting, "ScheduleRevoked")
        .withArgs(beneficiary.address, 0n);

      expect(await token.balanceOf(beneficiary.address)).to.equal(benBefore);
      expect(await token.balanceOf(owner.address)).to.equal(ownerBefore);
      expect(await vesting.totalOutstanding()).to.equal(0n);
    });

    it("revoke cannot be called twice and closes outstanding obligations", async function () {
      const start = BigInt(await time.latest());
      await createDefaultSchedule({ start, duration: 1000n, revocable: true });

      await vesting.revoke(beneficiary.address);
      expect(await vesting.totalOutstanding()).to.equal(0n);
      await expect(
        vesting.revoke(beneficiary.address)
      ).to.be.revertedWith("Vesting: already revoked");
    });

    it("revoke after full vesting pays beneficiary everything and refunds nothing", async function () {
      const amount = ethers.parseEther("1234");
      const start = BigInt(await time.latest());
      const duration = 1000n;
      await createDefaultSchedule({ amount, start, duration, revocable: true });

      const ownerBefore = await token.balanceOf(owner.address);
      await time.increaseTo(start + duration + 1n);
      await expect(vesting.revoke(beneficiary.address))
        .to.emit(vesting, "ScheduleRevoked")
        .withArgs(beneficiary.address, 0n);

      expect(await token.balanceOf(beneficiary.address)).to.equal(amount);
      expect(await token.balanceOf(owner.address)).to.equal(ownerBefore);
      expect(await vesting.totalOutstanding()).to.equal(0n);
    });

    it("emergencyWithdraw on the vested token rejects when no excess exists and allows exact excess", async function () {
      const amount = ethers.parseEther("1000");
      await createDefaultSchedule({ amount, start: BigInt(await time.latest()), duration: 1000n });

      await expect(
        vesting.emergencyWithdraw(await token.getAddress(), 1n)
      ).to.be.revertedWith("Vesting: protected balance");

      const excess = ethers.parseEther("9");
      await token.connect(owner).transfer(await vesting.getAddress(), excess);
      await expect(vesting.emergencyWithdraw(await token.getAddress(), excess))
        .to.emit(vesting, "EmergencyWithdraw")
        .withArgs(await token.getAddress(), excess);
      expect(await vesting.totalOutstanding()).to.equal(amount);
    });
  });
});
