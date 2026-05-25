const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WLABGovernor", function () {
  let token, timelock, governor, owner, voter, treasury;

  beforeEach(async function () {
    [owner, voter, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);
    await token.connect(owner).mint(voter.address, ethers.parseEther("200000"));

    const minDelay = 48 * 60 * 60;
    const Timelock = await ethers.getContractFactory("TimelockController");
    timelock = await Timelock.deploy(minDelay, [], [], owner.address);

    const Governor = await ethers.getContractFactory("WLABGovernor");
    governor = await Governor.deploy(
      await token.getAddress(),
      await timelock.getAddress(),
      1,
      100,
      ethers.parseEther("100000"),
      4
    );

    const delegateIface = token.interface.getFunction("delegate");
    await token.connect(voter).delegate(voter.address);
    await time.advanceBlock();
  });

  it("deploys with correct name", async function () {
    expect(await governor.name()).to.equal("WLABGovernor");
  });

  it("has quorum fraction configured", async function () {
    expect(await governor.quorumNumerator()).to.equal(4);
  });
});
