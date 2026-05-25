const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WLABVeToken", function () {
  let token, veToken, owner, user, treasury, gaugeToken;

  beforeEach(async function () {
    [owner, user, treasury, gaugeToken] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);

    const VeToken = await ethers.getContractFactory("WLABVeToken");
    veToken = await VeToken.deploy(await token.getAddress(), owner.address);

    await token.connect(owner).mint(user.address, ethers.parseEther("1000"));
    await token.connect(user).approve(await veToken.getAddress(), ethers.parseEther("1000"));
  });

  async function createFullPowerLock() {
    await veToken.connect(user).createLock(ethers.parseEther("100"), await veToken.MAX_LOCK());
    return veToken.totalVotingPower(user.address);
  }

  it("updates gauge votes instead of accumulating duplicate power", async function () {
    const power = await createFullPowerLock();
    await veToken.connect(owner).createGauge(gaugeToken.address);

    await veToken.connect(user).voteGauge(0, power);
    await veToken.connect(user).voteGauge(0, power);

    expect(await veToken.gaugeWeight(0)).to.equal(power);
    expect(await veToken.usedGaugeWeight(user.address)).to.equal(power);

    const halfPower = power / 2n;
    await veToken.connect(user).voteGauge(0, halfPower);

    expect(await veToken.gaugeWeight(0)).to.equal(halfPower);
    expect(await veToken.usedGaugeWeight(user.address)).to.equal(halfPower);
  });

  it("prevents reusing the same voting power across gauges", async function () {
    const power = await createFullPowerLock();
    await veToken.connect(owner).createGauge(gaugeToken.address);
    await veToken.connect(owner).createGauge(treasury.address);

    await veToken.connect(user).voteGauge(0, power);
    await expect(veToken.connect(user).voteGauge(1, 1n)).to.be.revertedWith("veWLAB: insufficient power");

    const halfPower = power / 2n;
    await veToken.connect(user).voteGauge(0, halfPower);
    await veToken.connect(user).voteGauge(1, halfPower);

    expect(await veToken.gaugeWeight(0)).to.equal(halfPower);
    expect(await veToken.gaugeWeight(1)).to.equal(halfPower);
  });

  it("blocks withdrawal until active gauge votes are released", async function () {
    const lockDuration = 7n * 24n * 60n * 60n;
    await veToken.connect(user).createLock(ethers.parseEther("100"), lockDuration);
    await veToken.connect(owner).createGauge(gaugeToken.address);

    const power = await veToken.totalVotingPower(user.address);
    await veToken.connect(user).voteGauge(0, power);
    await time.increase(lockDuration + 1n);

    await expect(veToken.connect(user).withdraw(0)).to.be.revertedWith("veWLAB: active votes");

    await veToken.connect(user).voteGauge(0, 0);
    await veToken.connect(user).withdraw(0);

    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("1000"));
  });
});
