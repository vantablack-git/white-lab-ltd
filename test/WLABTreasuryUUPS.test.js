const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WLABTreasuryUUPS", function () {
  let token, treasury, implementation, owner, spender, outsider, recipient;

  beforeEach(async function () {
    [owner, spender, outsider, recipient] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, recipient.address);

    const Treasury = await ethers.getContractFactory("WLABTreasuryUUPS");
    implementation = await Treasury.deploy();

    const initData = Treasury.interface.encodeFunctionData("initialize", [owner.address]);
    const Proxy = await ethers.getContractFactory("WLABERC1967Proxy");
    const proxy = await Proxy.deploy(await implementation.getAddress(), initData);
    treasury = Treasury.attach(await proxy.getAddress());

    await token.connect(owner).mint(await treasury.getAddress(), ethers.parseEther("1000"));
  });

  it("initializes through proxy and blocks implementation initialization", async function () {
    expect(await treasury.hasRole(await treasury.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
    await expect(implementation.initialize(owner.address)).to.be.reverted;
    await expect(treasury.connect(outsider).initialize(outsider.address)).to.be.reverted;
  });

  it("enforces spender role on withdrawals", async function () {
    await expect(
      treasury.connect(outsider).withdraw(await token.getAddress(), recipient.address, ethers.parseEther("1"))
    ).to.be.reverted;

    await treasury.connect(owner).grantRole(await treasury.SPENDER_ROLE(), spender.address);
    await treasury.connect(spender).withdraw(await token.getAddress(), recipient.address, ethers.parseEther("25"));

    expect(await token.balanceOf(recipient.address)).to.equal(ethers.parseEther("25"));
  });

  // ── Branch coverage: require else-paths and modifier else-paths ────────────
  describe("branch coverage", function () {
    it("setFeeSwitch reverts when fee exceeds 1000 bps", async function () {
      await expect(
        treasury.connect(owner).setFeeSwitch(true, 1001)
      ).to.be.revertedWith("Treasury: fee too high");
    });

    it("setFeeSwitch reverts when called by non-admin", async function () {
      await expect(
        treasury.connect(outsider).setFeeSwitch(true, 100)
      ).to.be.reverted;
    });

    it("withdraw reverts when recipient is zero address", async function () {
      await treasury.connect(owner).grantRole(await treasury.SPENDER_ROLE(), spender.address);
      await expect(
        treasury.connect(spender).withdraw(await token.getAddress(), ethers.ZeroAddress, 1)
      ).to.be.revertedWith("Treasury: zero to");
    });
  });

  it("preserves storage and requires upgrader role for UUPS upgrades", async function () {
    await treasury.connect(owner).setFeeSwitch(true, 250);

    const TreasuryV2 = await ethers.getContractFactory("WLABTreasuryUUPSV2");
    const v2 = await TreasuryV2.deploy();

    await expect(
      treasury.connect(outsider).upgradeToAndCall(await v2.getAddress(), "0x")
    ).to.be.reverted;

    await treasury.connect(owner).upgradeToAndCall(await v2.getAddress(), "0x");
    const upgraded = TreasuryV2.attach(await treasury.getAddress());

    expect(await upgraded.version()).to.equal("v2");
    expect(await upgraded.feeSwitchEnabled()).to.equal(true);
    expect(await upgraded.protocolFeeBps()).to.equal(250);
  });
});
