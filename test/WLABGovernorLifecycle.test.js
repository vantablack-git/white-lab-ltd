const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("WLABGovernor lifecycle", function () {
  let token, timelock, governor, owner, voter, treasury;
  const minDelay = 2 * 24 * 60 * 60;
  const votingDelayBlocks = 1;
  const votingPeriodBlocks = 8;

  beforeEach(async function () {
    [owner, voter, treasury] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);
    await token.connect(owner).mint(voter.address, ethers.parseEther("200000"));
    await token.connect(owner).mint(treasury.address, ethers.parseEther("800000"));
    await token.connect(voter).delegate(voter.address);
    await time.advanceBlock();

    const Timelock = await ethers.getContractFactory("TimelockController");
    timelock = await Timelock.deploy(minDelay, [], [], owner.address);

    const Governor = await ethers.getContractFactory("WLABGovernor");
    governor = await Governor.deploy(
      await token.getAddress(),
      await timelock.getAddress(),
      votingDelayBlocks,
      votingPeriodBlocks,
      ethers.parseEther("100000"),
      4
    );

    await timelock.connect(owner).grantRole(await timelock.PROPOSER_ROLE(), await governor.getAddress());
    await timelock.connect(owner).grantRole(await timelock.CANCELLER_ROLE(), await governor.getAddress());
    await timelock.connect(owner).grantRole(await timelock.EXECUTOR_ROLE(), ethers.ZeroAddress);
    await token.connect(owner).grantRole(await token.PAUSER_ROLE(), await timelock.getAddress());
  });

  it("proposes, votes, queues, waits timelock, and executes", async function () {
    const target = await token.getAddress();
    const calldata = token.interface.encodeFunctionData("pause");
    const description = "Pause WLAB through timelock";
    const descriptionHash = ethers.id(description);

    const tx = await governor.connect(voter).propose([target], [0], [calldata], description);
    const receipt = await tx.wait();
    const proposalId = receipt.logs
      .map((log) => {
        try {
          return governor.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event) => event && event.name === "ProposalCreated").args.proposalId;

    await mine(votingDelayBlocks + 1);
    await governor.connect(voter).castVote(proposalId, 1);
    await mine(votingPeriodBlocks + 1);

    await governor.queue([target], [0], [calldata], descriptionHash);
    await expect(governor.execute([target], [0], [calldata], descriptionHash)).to.be.reverted;

    await time.increase(minDelay + 1);
    await governor.execute([target], [0], [calldata], descriptionHash);

    expect(await token.paused()).to.equal(true);
  });
});
