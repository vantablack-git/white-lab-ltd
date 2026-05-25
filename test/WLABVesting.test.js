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
});
