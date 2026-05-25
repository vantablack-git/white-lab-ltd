const { expect }     = require("chai");
const { ethers }     = require("hardhat");
const { time }       = require("@nomicfoundation/hardhat-network-helpers");

describe("WhiteLab Integration", function () {
  let token, vesting, staking, sale, owner, alice, bob, treasury;

  beforeEach(async function () {
    [owner, alice, bob, treasury] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);
    const tokenAddr = await token.getAddress();

    const Vesting = await ethers.getContractFactory("WLABVesting");
    vesting = await Vesting.deploy(tokenAddr, owner.address);

    const Staking = await ethers.getContractFactory("WLABStaking");
    staking = await Staking.deploy(tokenAddr, tokenAddr, owner.address);

    const Sale = await ethers.getContractFactory("WLABTokenSale");
    sale = await Sale.deploy(tokenAddr, ethers.ZeroAddress, owner.address);

    await token.mint(owner.address,           ethers.parseEther("900000000"));
    await token.mint(await staking.getAddress(), ethers.parseEther("50000000"));
    await token.mint(await sale.getAddress(),    ethers.parseEther("50000000"));
  });

  it("full IDO + claim flow", async function () {
    const price = ethers.parseEther("0.00004");
    await sale.configurePhase(3, price, ethers.parseEther("1000000"),
      ethers.parseEther("100"), ethers.parseEther("0.01"), ethers.ZeroHash, 0);
    await sale.startPhase(3);

    const buyAmt = ethers.parseEther("1000");
    const cost   = (buyAmt * BigInt(price)) / ethers.parseEther("1");
    await sale.connect(alice).buy(buyAmt, [], { value: cost });
    await sale.finalizeSale();
    await sale.connect(alice).claim(3);

    expect(await token.balanceOf(alice.address)).to.equal(buyAmt);
  });

  it("stake → wait → unstake + reward", async function () {
    const amount = ethers.parseEther("10000");
    await token.transfer(alice.address, amount);
    await token.connect(alice).approve(await staking.getAddress(), amount);
    await staking.setRewardRate(ethers.parseEther("1")); // 1 WLAB/s

    await staking.connect(alice).stake(amount, 0, false); // 30-day tier
    await time.increase(30 * 24 * 3600 + 1);
    const pending = await staking.pendingReward(alice.address);
    expect(pending).to.be.gt(0);
    await staking.connect(alice).unstake(amount);
    expect(await token.balanceOf(alice.address)).to.be.gte(amount);
  });

  it("vesting cliff + release", async function () {
    const amount = ethers.parseEther("100000");
    await token.approve(await vesting.getAddress(), amount);
    const cliff    = 30 * 24 * 3600;
    const duration = 365 * 24 * 3600;
    await vesting.createSchedule(alice.address, amount, BigInt(await time.latest()), cliff, duration, false);

    await time.increase(cliff + duration / 2);
    const before = await token.balanceOf(alice.address);
    await vesting.connect(alice).release();
    const after  = await token.balanceOf(alice.address);
    expect(after).to.be.gt(before);
  });
});
