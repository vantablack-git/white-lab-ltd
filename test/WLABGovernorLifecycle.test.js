const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("WLABGovernor lifecycle", function () {
  let token, timelock, governor, owner, voter, treasury, outsider;
  const minDelay = 2 * 24 * 60 * 60;
  const votingDelayBlocks = 1;
  const votingPeriodBlocks = 8;
  const ProposalState = {
    Pending: 0n,
    Active: 1n,
    Canceled: 2n,
    Defeated: 3n,
    Succeeded: 4n,
    Queued: 5n,
    Expired: 6n,
    Executed: 7n,
  };

  beforeEach(async function () {
    [owner, voter, treasury, outsider] = await ethers.getSigners();

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

  async function proposePause(description = `Pause WLAB through timelock ${Date.now()}`) {
    const target = await token.getAddress();
    const value = 0;
    const calldata = token.interface.encodeFunctionData("pause");
    const descriptionHash = ethers.id(description);

    const tx = await governor.connect(voter).propose([target], [value], [calldata], description);
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

    return { proposalId, target, value, calldata, description, descriptionHash };
  }

  async function reachActive(proposalId) {
    await mine(votingDelayBlocks + 1);
    expect(await governor.state(proposalId)).to.equal(ProposalState.Active);
  }

  async function finishVotingPeriod() {
    await mine(votingPeriodBlocks + 1);
  }

  async function queueProposal(p) {
    await governor.queue([p.target], [p.value], [p.calldata], p.descriptionHash);
  }

  async function executeProposal(p) {
    await governor.execute([p.target], [p.value], [p.calldata], p.descriptionHash);
  }

  it("proposes, votes, queues, waits timelock, and executes", async function () {
    const p = await proposePause("Pause WLAB through timelock");

    await reachActive(p.proposalId);
    await governor.connect(voter).castVote(p.proposalId, 1);
    await finishVotingPeriod();

    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Succeeded);
    await queueProposal(p);
    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Queued);
    await expect(executeProposal(p)).to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");

    await time.increase(minDelay + 1);
    await executeProposal(p);

    expect(await token.paused()).to.equal(true);
    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Executed);
  });

  it("rejects proposals below the configured threshold", async function () {
    const target = await token.getAddress();
    const calldata = token.interface.encodeFunctionData("pause");

    await expect(
      governor.connect(outsider).propose([target], [0], [calldata], "outsider cannot propose")
    ).to.be.revertedWithCustomError(governor, "GovernorInsufficientProposerVotes");
  });

  it("keeps a proposal pending until votingDelay has elapsed", async function () {
    const p = await proposePause("pending boundary");

    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Pending);
    await expect(governor.connect(voter).castVote(p.proposalId, 1)).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");

    await mine(votingDelayBlocks);
    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Active);
    await governor.connect(voter).castVote(p.proposalId, 1);
  });

  it("marks a proposal defeated when quorum is not reached", async function () {
    const p = await proposePause("defeated due to no votes");

    await reachActive(p.proposalId);
    await finishVotingPeriod();

    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Defeated);
    await expect(queueProposal(p)).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");
  });

  it("marks a proposal defeated when against votes exceed for votes", async function () {
    const p = await proposePause("defeated due to against votes");

    await reachActive(p.proposalId);
    await governor.connect(voter).castVote(p.proposalId, 0); // Against
    await finishVotingPeriod();

    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Defeated);
    const votes = await governor.proposalVotes(p.proposalId);
    expect(votes.againstVotes).to.be.gt(votes.forVotes);
  });

  it("rejects queueing before a proposal has succeeded", async function () {
    const p = await proposePause("queue before success");

    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Pending);
    await expect(queueProposal(p)).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");

    await reachActive(p.proposalId);
    await expect(queueProposal(p)).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");
  });

  it("rejects execution before queueing and before the timelock delay expires", async function () {
    const p = await proposePause("execute state boundaries");

    await reachActive(p.proposalId);
    await governor.connect(voter).castVote(p.proposalId, 1);
    await finishVotingPeriod();
    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Succeeded);

    await expect(executeProposal(p)).to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");
    await queueProposal(p);
    await expect(executeProposal(p)).to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");

    const eta = await governor.proposalEta(p.proposalId);
    await time.setNextBlockTimestamp(eta - 1n);
    await expect(executeProposal(p)).to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");

    await time.setNextBlockTimestamp(eta + 1n);
    await executeProposal(p);
    expect(await token.paused()).to.equal(true);
  });

  it("allows the proposer to cancel while pending", async function () {
    const p = await proposePause("cancel pending proposal");
    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Pending);

    await expect(
      governor.connect(voter).cancel([p.target], [p.value], [p.calldata], p.descriptionHash)
    ).to.emit(governor, "ProposalCanceled");

    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Canceled);
    await expect(queueProposal(p)).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");
  });

  it("proposalNeedsQueuing returns true for a succeeded proposal", async function () {
    const p = await proposePause("proposalNeedsQueuing");
    await reachActive(p.proposalId);
    await governor.connect(voter).castVote(p.proposalId, 1);
    await finishVotingPeriod();
    expect(await governor.state(p.proposalId)).to.equal(ProposalState.Succeeded);
    expect(await governor.proposalNeedsQueuing(p.proposalId)).to.equal(true);
  });

  it("rejects duplicate voting from the same account", async function () {
    const p = await proposePause("duplicate vote rejected");

    await reachActive(p.proposalId);
    await governor.connect(voter).castVote(p.proposalId, 1);
    await expect(governor.connect(voter).castVote(p.proposalId, 1)).to.be.revertedWithCustomError(governor, "GovernorAlreadyCastVote");
  });
});
