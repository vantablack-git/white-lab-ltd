const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WLABOFTAdapter stub guardrails", function () {
  let token, adapter, owner, user, recipient, treasury;

  beforeEach(async function () {
    [owner, user, recipient, treasury] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);

    const Adapter = await ethers.getContractFactory("WLABOFTAdapter");
    adapter = await Adapter.deploy(await token.getAddress(), owner.address);

    await token.connect(owner).mint(user.address, ethers.parseEther("1000"));
    await token.connect(owner).mint(await adapter.getAddress(), ethers.parseEther("1000"));
    await token.connect(user).approve(await adapter.getAddress(), ethers.parseEther("1000"));
  });

  it("is disabled by default to prevent accidental production bridge use", async function () {
    await adapter.connect(owner).setRemoteAdapter(101, recipient.address);

    await expect(
      adapter.connect(user).bridgeOut(101, ethers.parseEther("10"), recipient.address)
    ).to.be.revertedWith("OFT: disabled stub");

    await expect(
      adapter.connect(owner).bridgeIn(101, recipient.address, ethers.parseEther("10"), ethers.id("msg-1"))
    ).to.be.revertedWith("OFT: disabled stub");
  });

  it("locks outbound tokens and prevents replayed inbound messages when explicitly enabled", async function () {
    await adapter.connect(owner).setBridgeEnabled(true);
    await adapter.connect(owner).setRemoteAdapter(101, recipient.address);

    await adapter.connect(user).bridgeOut(101, ethers.parseEther("10"), recipient.address);
    expect(await token.balanceOf(await adapter.getAddress())).to.equal(ethers.parseEther("1010"));

    const messageId = ethers.id("source-burn-1");
    await adapter.connect(owner).bridgeIn(101, recipient.address, ethers.parseEther("10"), messageId);
    await expect(
      adapter.connect(owner).bridgeIn(101, recipient.address, ethers.parseEther("10"), messageId)
    ).to.be.revertedWith("OFT: processed");

    expect(await token.balanceOf(recipient.address)).to.equal(ethers.parseEther("10"));
  });
});
