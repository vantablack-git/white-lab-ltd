const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WLABStaking", function () {
  let token, staking, owner, user, treasury;

  beforeEach(async function () {
    [owner, user, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);
    const Staking = await ethers.getContractFactory("WLABStaking");
    staking = await Staking.deploy(await token.getAddress(), await token.getAddress(), owner.address);

    await token.connect(owner).mint(owner.address, ethers.parseEther("1000000"));
    await token.connect(owner).mint(user.address, ethers.parseEther("10000"));
    await token.connect(owner).transfer(await staking.getAddress(), ethers.parseEther("500000"));
    await staking.connect(owner).setRewardRate(ethers.parseEther("1") / 86400n);

    await token.connect(user).approve(await staking.getAddress(), ethers.parseEther("10000"));
  });

  it("stakes and claims rewards after time", async function () {
    await staking.connect(user).stake(ethers.parseEther("100"), 0, false);
    await time.increase(7 * 24 * 60 * 60);
    const pending = await staking.pendingReward(user.address);
    expect(pending).to.be.gt(0);
    await staking.connect(user).claimReward();
  });

  it("preserves totalWeightedStake when adding to an existing position", async function () {
    await staking.connect(user).stake(ethers.parseEther("100"), 0, false);
    await staking.connect(user).stake(ethers.parseEther("50"), 0, false);

    const info = await staking.stakes(user.address);
    expect(info.amount).to.equal(ethers.parseEther("150"));
    expect(info.weight).to.equal(ethers.parseEther("150"));
    expect(await staking.totalWeightedStake()).to.equal(ethers.parseEther("150"));
  });

  it("rejects adding to an existing position with a different tier", async function () {
    await staking.connect(user).stake(ethers.parseEther("100"), 0, false);

    await expect(
      staking.connect(user).stake(ethers.parseEther("50"), 1, false)
    ).to.be.revertedWith("Staking: tier mismatch");
  });

  it("rejects compound mode when reward token differs from staking token", async function () {
    const RewardToken = await ethers.getContractFactory("WLABToken");
    const rewardToken = await RewardToken.deploy(owner.address, treasury.address);
    const Staking = await ethers.getContractFactory("WLABStaking");
    const splitStaking = await Staking.deploy(
      await token.getAddress(),
      await rewardToken.getAddress(),
      owner.address
    );

    await token.connect(user).approve(await splitStaking.getAddress(), ethers.parseEther("100"));

    await expect(
      splitStaking.connect(user).stake(ethers.parseEther("100"), 0, true)
    ).to.be.revertedWith("Staking: compound token mismatch");
  });

  it("emergency unstake applies penalty", async function () {
    await staking.connect(user).stake(ethers.parseEther("100"), 0, false);
    const before = await token.balanceOf(user.address);
    await staking.connect(user).emergencyUnstake();
    const after = await token.balanceOf(user.address);
    expect(after - before).to.be.lt(ethers.parseEther("100"));
  });
});
