const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WhiteLab accounting invariants", function () {
  let token, sale, staking, owner, alice, bob, treasury;

  beforeEach(async function () {
    [owner, alice, bob, treasury] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(owner.address, treasury.address);

    const Sale = await ethers.getContractFactory("WLABTokenSale");
    sale = await Sale.deploy(await token.getAddress(), ethers.ZeroAddress, owner.address);

    const Staking = await ethers.getContractFactory("WLABStaking");
    staking = await Staking.deploy(await token.getAddress(), await token.getAddress(), owner.address);

    await token.connect(owner).mint(owner.address, ethers.parseEther("1000000"));
    await token.connect(owner).transfer(await sale.getAddress(), ethers.parseEther("100000"));
    await token.connect(owner).transfer(await staking.getAddress(), ethers.parseEther("100000"));
    await token.connect(owner).transfer(alice.address, ethers.parseEther("10000"));
    await token.connect(owner).transfer(bob.address, ethers.parseEther("10000"));
  });

  it("sale obligations equal the sum of outstanding buyer entitlements", async function () {
    const price = ethers.parseEther("0.00004");
    const aliceBuy = ethers.parseEther("1000");
    const bobBuy = ethers.parseEther("2500");
    const cost = (amount) => (amount * price) / ethers.parseEther("1");

    await sale.configurePhase(3, price, ethers.parseEther("100000"), ethers.parseEther("100"), ethers.parseEther("0.01"), ethers.ZeroHash, 0);
    await sale.startPhase(3);
    await sale.connect(alice).buy(aliceBuy, [], { value: cost(aliceBuy) });
    await sale.connect(bob).buy(bobBuy, [], { value: cost(bobBuy) });

    expect(await sale.totalUnclaimedTokens()).to.equal(
      (await sale.purchasedTokens(3, alice.address)) + (await sale.purchasedTokens(3, bob.address))
    );

    await sale.connect(owner).finalizeSale();
    await sale.connect(alice).claim(3);

    expect(await sale.totalUnclaimedTokens()).to.equal(await sale.purchasedTokens(3, bob.address));
  });

  it("staking totalWeightedStake matches the active position weights after varied actions", async function () {
    await token.connect(alice).approve(await staking.getAddress(), ethers.parseEther("10000"));
    await token.connect(bob).approve(await staking.getAddress(), ethers.parseEther("10000"));

    await staking.connect(alice).stake(ethers.parseEther("1000"), 0, false);
    await staking.connect(alice).stake(ethers.parseEther("500"), 0, false);
    await staking.connect(bob).stake(ethers.parseEther("1000"), 2, false);

    let aliceInfo = await staking.stakes(alice.address);
    let bobInfo = await staking.stakes(bob.address);
    expect(await staking.totalWeightedStake()).to.equal(aliceInfo.weight + bobInfo.weight);

    await time.increase(365 * 24 * 60 * 60);
    await staking.connect(bob).unstake(ethers.parseEther("250"));

    aliceInfo = await staking.stakes(alice.address);
    bobInfo = await staking.stakes(bob.address);
    expect(await staking.totalWeightedStake()).to.equal(aliceInfo.weight + bobInfo.weight);
  });
});
