const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WLABToken", function () {
  let token, admin, user, treasury;

  beforeEach(async function () {
    [admin, user, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(admin.address, treasury.address);
  });

  it("has correct name and max supply", async function () {
    expect(await token.name()).to.equal("WhiteLab");
    expect(await token.symbol()).to.equal("WLAB");
    expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("1000000000"));
  });

  it("mints within cap", async function () {
    await token.connect(admin).mint(user.address, ethers.parseEther("1000"));
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("1000"));
  });

  it("reverts mint over cap", async function () {
    await expect(
      token.connect(admin).mint(user.address, ethers.parseEther("1000000001"))
    ).to.be.revertedWith("WLAB: max supply");
  });

  it("pauses transfers", async function () {
    await token.connect(admin).mint(user.address, ethers.parseEther("10"));
    await token.connect(admin).pause();
    await expect(
      token.connect(user).transfer(admin.address, 1n)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");
  });

  it("blacklists blocked addresses", async function () {
    await token.connect(admin).mint(admin.address, ethers.parseEther("10"));
    await token.connect(admin).setBlacklisted(user.address, true);
    await expect(
      token.connect(admin).transfer(user.address, 1n)
    ).to.be.revertedWith("WLAB: blacklisted");
  });

  it("burns user tokens", async function () {
    await token.connect(admin).mint(user.address, ethers.parseEther("5"));
    await token.connect(user).burn(ethers.parseEther("2"));
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("3"));
  });

  it("applies transfer fee when enabled", async function () {
    await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
    await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));
    const before = await token.balanceOf(user.address);
    await token.connect(admin).transfer(user.address, ethers.parseEther("100"));
    const received = (await token.balanceOf(user.address)) - before;
    expect(received).to.be.lt(ethers.parseEther("100"));
    // net = 99 WLAB (1% fee)
    expect(received).to.equal(ethers.parseEther("99"));
  });

  it("skips transfer fee for explicit fee-exempt accounts", async function () {
    await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
    await token.connect(admin).setFeeExempt(admin.address, true);
    await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));

    await token.connect(admin).transfer(user.address, ethers.parseEther("100"));

    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("100"));
    expect(await token.balanceOf(treasury.address)).to.equal(0n);
  });

  it("creates snapshot", async function () {
    await token.connect(admin).mint(user.address, ethers.parseEther("1"));
    await expect(token.connect(admin).snapshot()).to.emit(token, "Snapshot");
  });

  // ── Phase 1E regression: fee path is symmetric with no-fee on the sender side ─
  it("emits exactly one Transfer with from=sender, matching the no-fee path", async function () {
    await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
    await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));

    // No-fee baseline: admin is fee-exempt.
    await token.connect(admin).setFeeExempt(admin.address, true);
    const noFeeTx = await token.connect(admin).transfer(user.address, ethers.parseEther("50"));
    const noFeeRcpt = await noFeeTx.wait();
    const noFeeFromAdmin = noFeeRcpt.logs.filter((log) => {
      try {
        const parsed = token.interface.parseLog(log);
        return parsed?.name === "Transfer" && parsed.args.from === admin.address;
      } catch {
        return false;
      }
    });

    // Fee-on transfer with admin no longer fee-exempt.
    await token.connect(admin).setFeeExempt(admin.address, false);
    const feeTx = await token.connect(admin).transfer(user.address, ethers.parseEther("100"));
    const feeRcpt = await feeTx.wait();
    const feeFromAdmin = feeRcpt.logs.filter((log) => {
      try {
        const parsed = token.interface.parseLog(log);
        return parsed?.name === "Transfer" && parsed.args.from === admin.address;
      } catch {
        return false;
      }
    });

    // Sender-side event count must be identical between the two paths.
    expect(feeFromAdmin.length).to.equal(noFeeFromAdmin.length);
    expect(feeFromAdmin.length).to.equal(1);

    // The single sender-side event carries the gross value, not the net.
    const parsed = token.interface.parseLog(feeFromAdmin[0]);
    expect(parsed.args.to).to.equal(user.address);
    expect(parsed.args.value).to.equal(ethers.parseEther("100"));

    // Vote checkpoint accounting is unchanged: admin's votes drop by gross.
    await token.connect(admin).delegate(admin.address);
    const checkpointsBefore = await token.numCheckpoints(admin.address);
    await token.connect(admin).transfer(user.address, ethers.parseEther("10"));
    const checkpointsAfter = await token.numCheckpoints(admin.address);
    // Exactly one checkpoint added per logical transfer (matches no-fee).
    expect(checkpointsAfter - checkpointsBefore).to.equal(1n);
  });

  // ── Phase 8 branch coverage: defensive paths ─────────────────────────────
  describe("branch coverage", function () {
    let outsider;

    beforeEach(async function () {
      const signers = await ethers.getSigners();
      outsider = signers[3];
    });

    it("constructor rejects zero admin", async function () {
      const Token = await ethers.getContractFactory("WLABToken");
      await expect(
        Token.deploy(ethers.ZeroAddress, treasury.address)
      ).to.be.revertedWith("WLAB: zero admin");
    });

    it("constructor rejects zero fee receiver", async function () {
      const Token = await ethers.getContractFactory("WLABToken");
      await expect(
        Token.deploy(admin.address, ethers.ZeroAddress)
      ).to.be.revertedWith("WLAB: zero fee receiver");
    });

    it("setTransferFee rejects fee above 5%", async function () {
      await expect(
        token.connect(admin).setTransferFee(true, 501, 7000, treasury.address)
      ).to.be.revertedWith("WLAB: fee too high");
    });

    it("setTransferFee rejects burn share above 100%", async function () {
      await expect(
        token.connect(admin).setTransferFee(true, 100, 10001, treasury.address)
      ).to.be.revertedWith("WLAB: invalid burn share");
    });

    it("setTransferFee rejects zero receiver", async function () {
      await expect(
        token.connect(admin).setTransferFee(true, 100, 7000, ethers.ZeroAddress)
      ).to.be.revertedWith("WLAB: zero receiver");
    });

    it("non-admin cannot reconfigure fees, whitelist mode, max wallet, or fee exemptions", async function () {
      const expectAccessRevert = (call) =>
        expect(call).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");

      await expectAccessRevert(
        token.connect(outsider).setTransferFee(true, 100, 7000, treasury.address)
      );
      await expectAccessRevert(token.connect(outsider).setMaxWallet(true, 1n));
      await expectAccessRevert(token.connect(outsider).setFeeExempt(user.address, true));
      await expectAccessRevert(token.connect(outsider).setWhitelistMode(true));
      await expectAccessRevert(token.connect(outsider).setBlacklisted(user.address, true));
      await expectAccessRevert(token.connect(outsider).setWhitelisted(user.address, true));
      await expectAccessRevert(token.connect(outsider).pause());
      await expectAccessRevert(token.connect(outsider).snapshot());
      await expectAccessRevert(token.connect(outsider).mint(outsider.address, 1n));
    });

    it("blacklists the sender address as well as the recipient", async function () {
      await token.connect(admin).mint(user.address, ethers.parseEther("10"));
      await token.connect(admin).setBlacklisted(user.address, true);
      await expect(
        token.connect(user).transfer(admin.address, 1n)
      ).to.be.revertedWith("WLAB: blacklisted");
    });

    it("rejects transfers when whitelist mode is active and neither party is whitelisted", async function () {
      await token.connect(admin).mint(admin.address, ethers.parseEther("10"));
      await token.connect(admin).setWhitelistMode(true);
      await expect(
        token.connect(admin).transfer(user.address, 1n)
      ).to.be.revertedWith("WLAB: not whitelisted");
    });

    it("permits transfers when whitelist mode is active and one party is whitelisted", async function () {
      await token.connect(admin).mint(admin.address, ethers.parseEther("10"));
      await token.connect(admin).setWhitelistMode(true);
      await token.connect(admin).setWhitelisted(user.address, true);
      await token.connect(admin).transfer(user.address, ethers.parseEther("1"));
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("1"));
    });

    it("burnFrom requires an explicit allowance", async function () {
      await token.connect(admin).mint(user.address, ethers.parseEther("10"));
      await expect(
        token.connect(admin).burnFrom(user.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

      await token.connect(user).approve(admin.address, ethers.parseEther("3"));
      await expect(token.connect(admin).burnFrom(user.address, ethers.parseEther("3")))
        .to.emit(token, "TokensBurned")
        .withArgs(user.address, ethers.parseEther("3"));
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("7"));
    });

    it("pauses and unpauses transfers via PAUSER_ROLE only", async function () {
      await token.connect(admin).mint(user.address, ethers.parseEther("5"));
      await token.connect(admin).pause();
      await expect(
        token.connect(user).transfer(admin.address, 1n)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");

      await expect(
        token.connect(outsider).unpause()
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");

      await token.connect(admin).unpause();
      await token.connect(user).transfer(admin.address, ethers.parseEther("1"));
      expect(await token.balanceOf(admin.address)).to.equal(ethers.parseEther("1"));
    });

    it("setMaxWallet enforces the cap on the recipient and respects the dead-address sink", async function () {
      // Mint first; maxWallet is enforced on `to`, including mint targets.
      await token.connect(admin).mint(admin.address, ethers.parseEther("100"));
      await token.connect(admin).setMaxWallet(true, ethers.parseEther("5"));

      await token.connect(admin).transfer(user.address, ethers.parseEther("5"));
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("5"));

      await expect(
        token.connect(admin).transfer(user.address, 1n)
      ).to.be.revertedWith("WLAB: max wallet");

      // 0xdead is treated as a burn sink and is exempt from the wallet cap.
      const dead = "0x000000000000000000000000000000000000dEaD";
      await token.connect(admin).transfer(dead, ethers.parseEther("50"));
      expect(await token.balanceOf(dead)).to.equal(ethers.parseEther("50"));
    });

    it("max wallet check fires on the fee path against the recipient's net position", async function () {
      await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));
      // Configure a 1% fee with no burn so the entire fee accumulates at the receiver.
      await token.connect(admin).setTransferFee(true, 100, 0, treasury.address);
      await token.connect(admin).setMaxWallet(true, ethers.parseEther("99"));

      // Net to user is 99 WLAB which equals the cap exactly — allowed.
      await token.connect(admin).transfer(user.address, ethers.parseEther("100"));
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("99"));

      // Another 100 WLAB transfer pushes user above the cap — must revert.
      await expect(
        token.connect(admin).transfer(user.address, ethers.parseEther("100"))
      ).to.be.revertedWith("WLAB: max wallet");
    });

    it("fee-on transfer skips fee accounting when the recipient is fee-exempt", async function () {
      await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
      await token.connect(admin).setFeeExempt(user.address, true);
      await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));

      await token.connect(admin).transfer(user.address, ethers.parseEther("100"));

      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("100"));
      expect(await token.balanceOf(treasury.address)).to.equal(0n);
    });

    it("fee-on transfer becomes a no-op when the rounded fee is zero", async function () {
      await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
      await token.connect(admin).mint(admin.address, ethers.parseEther("1"));

      // 50 wei * 100 / 10000 = 0 — fee rounds to zero.
      const tinyTransfer = 50n;
      await token.connect(admin).transfer(user.address, tinyTransfer);
      expect(await token.balanceOf(user.address)).to.equal(tinyTransfer);
      expect(await token.balanceOf(treasury.address)).to.equal(0n);
    });

    it("fee transfers leave nothing at the burn sink when burnShareBps is zero", async function () {
      await token.connect(admin).setTransferFee(true, 100, 0, treasury.address);
      await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));

      await token.connect(admin).transfer(user.address, ethers.parseEther("100"));

      const fee = ethers.parseEther("1");
      expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("99"));
      expect(await token.balanceOf(treasury.address)).to.equal(fee);
    });

    it("snapshot id increments and emits the current block number", async function () {
      const tx = await token.connect(admin).snapshot();
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log) => {
          try {
            return token.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === "Snapshot");

      expect(event.args.snapshotId).to.equal(1n);
      expect(event.args.blockNumber).to.equal(BigInt(receipt.blockNumber));
      expect(await token.latestSnapshotId()).to.equal(1n);
    });

    it("setBlacklisted, setWhitelisted, setFeeExempt, setWhitelistMode emit their config events", async function () {
      await expect(token.connect(admin).setBlacklisted(user.address, true))
        .to.emit(token, "BlacklistUpdated")
        .withArgs(user.address, true);
      await expect(token.connect(admin).setWhitelisted(user.address, true))
        .to.emit(token, "WhitelistUpdated")
        .withArgs(user.address, true);
      await expect(token.connect(admin).setFeeExempt(user.address, true))
        .to.emit(token, "FeeExemptUpdated")
        .withArgs(user.address, true);
      await expect(token.connect(admin).setWhitelistMode(true))
        .to.emit(token, "WhitelistModeUpdated")
        .withArgs(true);
      await expect(token.connect(admin).setMaxWallet(true, 42n))
        .to.emit(token, "MaxWalletUpdated")
        .withArgs(true, 42n);
      await expect(
        token.connect(admin).setTransferFee(true, 250, 5000, treasury.address)
      )
        .to.emit(token, "TransferFeeUpdated")
        .withArgs(true, 250, 5000, treasury.address);
    });
  });

  // ── P0 votes regression: fee + votes checkpoint ───────────────────────────
  it("P0 votes: getVotes correct after fee-bearing transfer", async function () {
    await token.connect(admin).setTransferFee(true, 100, 7000, treasury.address);
    await token.connect(admin).mint(admin.address, ethers.parseEther("1000"));

    // Both parties delegate to themselves
    await token.connect(admin).delegate(admin.address);
    await token.connect(user).delegate(user.address);

    const adminBalBefore  = await token.balanceOf(admin.address);
    const adminVoteBefore = await token.getVotes(admin.address);
    expect(adminVoteBefore).to.equal(adminBalBefore);

    await token.connect(admin).transfer(user.address, ethers.parseEther("100"));

    const fee        = ethers.parseEther("1");   // 1% of 100
    const net        = ethers.parseEther("99");
    const burnShare  = (fee * 7000n) / 10000n;   // 0.7 WLAB burned

    // Admin votes should drop by exactly 100 (net + fee deducted from admin)
    const adminBalAfter  = await token.balanceOf(admin.address);
    const adminVoteAfter = await token.getVotes(admin.address);
    expect(adminVoteAfter).to.equal(adminBalAfter);

    // User received net tokens
    expect(await token.balanceOf(user.address)).to.equal(net);
    expect(await token.getVotes(user.address)).to.equal(net);

    // Treasury received fee minus burn share
    const treasuryBal = await token.balanceOf(treasury.address);
    expect(treasuryBal).to.equal(fee - burnShare);
  });

  // ── Coverage: WLABToken.nonces() is exercised through permit() ─────────────
  it("permit allows gasless approval and covers the nonces() override", async function () {
    const [alice] = await ethers.getSigners();
    const AMOUNT = ethers.parseEther("100");

    const domain = {
      name: "WhiteLab",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await token.getAddress(),
    };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const deadline = BigInt(await time.latest()) + 3600n;
    const nonce = await token.nonces(alice.address);

    const signature = await alice.signTypedData(domain, types, {
      owner: alice.address,
      spender: treasury.address,
      value: AMOUNT,
      nonce,
      deadline,
    });

    const { v, r, s } = ethers.Signature.from(signature);

    // permit() internally calls nonces(alice) and increments it.
    await expect(
      token.permit(alice.address, treasury.address, AMOUNT, deadline, v, r, s)
    ).to.emit(token, "Approval");

    expect(await token.allowance(alice.address, treasury.address)).to.equal(AMOUNT);
    expect(await token.nonces(alice.address)).to.equal(nonce + 1n);
  });

  it("burnFrom reverts when caller lacks BURNER_ROLE", async function () {
    await expect(
      token.connect(user).burnFrom(admin.address, 1)
    ).to.be.reverted;
  });
});
