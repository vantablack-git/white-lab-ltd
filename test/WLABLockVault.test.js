const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WLABLockVault", function () {
  let token, lockVault, owner, user, treasury, gaugeToken;

  beforeEach(async function () {
    [owner, user, treasury, gaugeToken] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);

    const LockVault = await ethers.getContractFactory("WLABLockVault");
    lockVault = await LockVault.deploy(await token.getAddress(), owner.address);

    await token.connect(owner).mint(user.address, ethers.parseEther("1000"));
    await token.connect(user).approve(await lockVault.getAddress(), ethers.parseEther("1000"));
  });

  async function createFullPowerLock() {
    await lockVault
      .connect(user)
      .createLock(ethers.parseEther("100"), await lockVault.MAX_LOCK());
    return lockVault.totalVotingPower(user.address);
  }

  it("fixes voting power at lock time and does not decay", async function () {
    const power = await createFullPowerLock();
    expect(power).to.equal(ethers.parseEther("100"));

    await time.increase(60 * 24 * 60 * 60);

    expect(await lockVault.totalVotingPower(user.address)).to.equal(power);
  });

  it("updates gauge votes instead of accumulating duplicate power", async function () {
    const power = await createFullPowerLock();
    await lockVault.connect(owner).createGauge(gaugeToken.address);

    await lockVault.connect(user).voteGauge(0, power);
    await lockVault.connect(user).voteGauge(0, power);

    expect(await lockVault.gaugeWeight(0)).to.equal(power);
    expect(await lockVault.usedGaugeWeight(user.address)).to.equal(power);

    const halfPower = power / 2n;
    await lockVault.connect(user).voteGauge(0, halfPower);

    expect(await lockVault.gaugeWeight(0)).to.equal(halfPower);
    expect(await lockVault.usedGaugeWeight(user.address)).to.equal(halfPower);
  });

  it("prevents reusing the same voting power across gauges", async function () {
    const power = await createFullPowerLock();
    await lockVault.connect(owner).createGauge(gaugeToken.address);
    await lockVault.connect(owner).createGauge(treasury.address);

    await lockVault.connect(user).voteGauge(0, power);
    await expect(lockVault.connect(user).voteGauge(1, 1n)).to.be.revertedWith(
      "LockVault: insufficient power"
    );

    const halfPower = power / 2n;
    await lockVault.connect(user).voteGauge(0, halfPower);
    await lockVault.connect(user).voteGauge(1, halfPower);

    expect(await lockVault.gaugeWeight(0)).to.equal(halfPower);
    expect(await lockVault.gaugeWeight(1)).to.equal(halfPower);
  });

  it("blocks withdrawal until active gauge votes are released", async function () {
    const lockDuration = 7n * 24n * 60n * 60n;
    await lockVault.connect(user).createLock(ethers.parseEther("100"), lockDuration);
    await lockVault.connect(owner).createGauge(gaugeToken.address);

    const power = await lockVault.totalVotingPower(user.address);
    await lockVault.connect(user).voteGauge(0, power);
    await time.increase(lockDuration + 1n);

    await expect(lockVault.connect(user).withdraw(0)).to.be.revertedWith("LockVault: active votes");

    await lockVault.connect(user).voteGauge(0, 0);
    await lockVault.connect(user).withdraw(0);

    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("1000"));
  });
});
