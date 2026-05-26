const { expect } = require("chai");
const { ethers, network } = require("hardhat");
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

  it("rejects reward programs that are not backed by available reward balance", async function () {
    const Staking = await ethers.getContractFactory("WLABStaking");
    const unfundedStaking = await Staking.deploy(
      await token.getAddress(),
      await token.getAddress(),
      owner.address
    );

    await token.connect(user).approve(await unfundedStaking.getAddress(), ethers.parseEther("100"));
    await unfundedStaking.connect(user).stake(ethers.parseEther("100"), 0, false);

    // The contract holds 100 WLAB, but all of it is user principal. It cannot
    // be counted as reward backing.
    await expect(
      unfundedStaking.connect(owner).setRewardProgram(ethers.parseEther("1") / 86400n, 7 * 24 * 60 * 60)
    ).to.be.revertedWith("Staking: insufficient rewards");
  });

  it("stops reward accrual at the funded program end", async function () {
    const rate = ethers.parseEther("1") / 86400n; // 1 WLAB/day

    await staking.connect(owner).setRewardRate(0);
    await staking.connect(user).stake(ethers.parseEther("100"), 0, false);
    await staking.connect(owner).setRewardProgram(rate, 24 * 60 * 60);

    const stakeInfo = await staking.stakes(user.address);
    const rewardEnd = await staking.rewardEndTime();
    const fundedSeconds = rewardEnd - stakeInfo.lockEnd + (await staking.lockDurations(0));

    await time.increase(2 * 24 * 60 * 60);

    const pending = await staking.pendingReward(user.address);
    expect(pending).to.be.gt(0);
    expect(pending).to.be.lte(rate * fundedSeconds);

    await staking.connect(user).claimReward();
    const afterClaim = await staking.pendingReward(user.address);
    expect(afterClaim).to.equal(0);
  });

  it("tracks totalStaked and consumes reserved rewards when compounding", async function () {
    const rate = ethers.parseEther("1") / 86400n; // 1 WLAB/day

    await staking.connect(owner).setRewardRate(0);
    await staking.connect(user).stake(ethers.parseEther("100"), 0, true);
    await staking.connect(owner).setRewardProgram(rate, 24 * 60 * 60);
    await time.increase(24 * 60 * 60);

    await staking.connect(user).claimReward();

    const info = await staking.stakes(user.address);
    expect(info.amount).to.be.gt(ethers.parseEther("100"));
    expect(await staking.totalStaked()).to.equal(info.amount);
    expect(await staking.reservedRewards()).to.equal(0);
  });

  it("emergency unstake applies penalty", async function () {
    await staking.connect(user).stake(ethers.parseEther("100"), 0, false);
    const before = await token.balanceOf(user.address);
    await staking.connect(user).emergencyUnstake();
    const after = await token.balanceOf(user.address);
    expect(after - before).to.be.lt(ethers.parseEther("100"));
  });

  // ── Branch coverage: require else-paths and edge-case branches ─────────────
  describe("branch coverage", function () {
    it("constructor rejects zero staking token", async function () {
      const Staking = await ethers.getContractFactory("WLABStaking");
      await expect(
        Staking.deploy(ethers.ZeroAddress, await token.getAddress(), owner.address)
      ).to.be.revertedWith("Staking: zero token");
    });

    it("stake rejects zero amount", async function () {
      await expect(
        staking.connect(user).stake(0, 0, false)
      ).to.be.revertedWith("Staking: zero amount");
    });

    it("stake rejects invalid tier index", async function () {
      await expect(
        staking.connect(user).stake(ethers.parseEther("100"), 4, false)
      ).to.be.revertedWith("Staking: invalid tier");
    });

    it("unstake rejects zero amount", async function () {
      await expect(
        staking.connect(user).unstake(0)
      ).to.be.revertedWith("Staking: zero amount");
    });

    it("unstake rejects amount exceeding balance", async function () {
      await staking.connect(user).stake(ethers.parseEther("100"), 0, false);
      await expect(
        staking.connect(user).unstake(ethers.parseEther("101"))
      ).to.be.revertedWith("Staking: insufficient");
    });

    it("unstake rejects before lock end", async function () {
      await staking.connect(user).stake(ethers.parseEther("100"), 0, false);
      await expect(
        staking.connect(user).unstake(ethers.parseEther("1"))
      ).to.be.revertedWith("Staking: locked");
    });

    it("emergencyUnstake rejects with no stake", async function () {
      await expect(
        staking.connect(user).emergencyUnstake()
      ).to.be.revertedWith("Staking: no stake");
    });

    it("setRewardRate may only be called by the owner", async function () {
      await expect(
        staking.connect(user).setRewardRate(1)
      ).to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });

    it("setRewardProgram may only be called by the owner", async function () {
      await expect(
        staking.connect(user).setRewardProgram(1, 7 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });

    it("pendingReward returns zero for a user with no stake (zero weight)", async function () {
      expect(await staking.pendingReward(user.address)).to.equal(0);
    });

    it("setRewardProgram rejects zero duration", async function () {
      await staking.connect(owner).setRewardRate(0);
      await expect(
        staking.connect(owner).setRewardProgram(1, 0)
      ).to.be.revertedWith("Staking: zero duration");
    });

    it("handles split reward token in _rewardBackingBalance by returning raw balance", async function () {
      const RewardToken = await ethers.getContractFactory("WLABToken");
      const rewardToken = await RewardToken.deploy(owner.address, treasury.address);
      const Staking = await ethers.getContractFactory("WLABStaking");
      const splitStaking = await Staking.deploy(
        await token.getAddress(),
        await rewardToken.getAddress(),
        owner.address
      );

      await token.connect(owner).mint(await splitStaking.getAddress(), ethers.parseEther("1000"));
      await rewardToken.connect(owner).mint(await splitStaking.getAddress(), ethers.parseEther("500"));

      await splitStaking.connect(owner).setRewardProgram(
        ethers.parseEther("1") / 86400n,
        7 * 24 * 60 * 60
      );

      expect(await splitStaking.rewardRatePerSecond()).to.equal(ethers.parseEther("1") / 86400n);
    });
  });

  // ── Phase 1D regression: top-ups never silently shorten or mis-handle the lock ─
  it("same-tier top-up never shortens the lock and matches max(existing, new)", async function () {
    const tier = 3; // 365 days
    const tierDurationSec = await staking.lockDurations(tier);

    await staking.connect(user).stake(ethers.parseEther("100"), tier, false);
    const first = await staking.stakes(user.address);
    const initialLockEnd = first.lockEnd;

    // Advance the clock so the freshly-computed candidate would be later
    // than the existing lockEnd. Top up should extend, not shrink.
    await time.increase(60 * 24 * 60 * 60);
    await staking.connect(user).stake(ethers.parseEther("50"), tier, false);

    const second = await staking.stakes(user.address);
    const now = BigInt(await time.latest());
    const newCandidate = now + tierDurationSec;
    const expected = newCandidate > initialLockEnd ? newCandidate : initialLockEnd;

    // Hard invariant: lockEnd is monotonically non-decreasing across top-ups.
    expect(second.lockEnd).to.be.gte(initialLockEnd);
    // Behavioral invariant: lockEnd is exactly the spec'd max.
    expect(second.lockEnd).to.equal(expected);
  });

  it("same-block top-up leaves lockEnd unchanged", async function () {
    const tier = 2; // 180 days

    // Disable automine so both stake txs land in the same block; otherwise
    // Hardhat mines one block per tx and block.timestamp advances by 1.
    await network.provider.send("evm_setAutomine", [false]);
    try {
      const tx1 = await staking.connect(user).stake(ethers.parseEther("100"), tier, false);
      const tx2 = await staking.connect(user).stake(ethers.parseEther("25"), tier, false);
      await network.provider.send("evm_mine", []);
      await tx1.wait();
      await tx2.wait();
    } finally {
      await network.provider.send("evm_setAutomine", [true]);
    }

    const stakeInfo = await staking.stakes(user.address);
    const expected = BigInt(await time.latest()) + (await staking.lockDurations(tier));
    expect(stakeInfo.lockEnd).to.equal(expected);
    expect(stakeInfo.amount).to.equal(ethers.parseEther("125"));
  });
});
