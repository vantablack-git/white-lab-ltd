/**
 * End-to-end local simulation: deploy → IDO → claim → stake
 * Run: npx hardhat run scripts/e2e-local.js --network hardhat
 */
const hre = require("hardhat");

async function main() {
  const [deployer, buyer, voter] = await hre.ethers.getSigners();
  console.log("=== WhiteLab E2E Local ===\n");

  // Deploy stack (inline, mirrors deploy.js)
  const Token = await hre.ethers.getContractFactory("WLABToken");
  const token = await Token.deploy(deployer.address, deployer.address);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();

  const Sale = await hre.ethers.getContractFactory("WLABTokenSale");
  const sale = await Sale.deploy(tokenAddr, hre.ethers.ZeroAddress, deployer.address);
  await sale.waitForDeployment();
  const saleAddr = await sale.getAddress();

  const Staking = await hre.ethers.getContractFactory("WLABStaking");
  const staking = await Staking.deploy(tokenAddr, tokenAddr, deployer.address);
  await staking.waitForDeployment();

  const Timelock = await hre.ethers.getContractFactory("TimelockController");
  const timelock = await Timelock.deploy(3600, [], [deployer.address], deployer.address);
  await timelock.waitForDeployment();

  const Governor = await hre.ethers.getContractFactory("WLABGovernor");
  const governor = await Governor.deploy(
    tokenAddr,
    await timelock.getAddress(),
    1,
    50,
    hre.ethers.parseEther("100000"),
    4
  );
  await governor.waitForDeployment();
  const governorAddr = await governor.getAddress();

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  await timelock.grantRole(proposerRole, governorAddr);
  await timelock.grantRole(executorRole, hre.ethers.ZeroAddress);

  await token.mint(deployer.address, hre.ethers.parseEther("10000000"));
  await token.transfer(saleAddr, hre.ethers.parseEther("5000000"));
  await token.setWhitelisted(saleAddr, true);
  await token.setFeeExempt(saleAddr, true);

  // IDO
  const price = hre.ethers.parseEther("0.00004");
  const buyAmt = hre.ethers.parseEther("1000");
  const cost = (buyAmt * price) / hre.ethers.parseEther("1");

  await sale.configurePhase(3, price, hre.ethers.parseEther("100000"), hre.ethers.parseEther("100"), hre.ethers.parseEther("0.01"), hre.ethers.ZeroHash, 0);
  await sale.startPhase(3);
  await sale.connect(buyer).buy(buyAmt, [], { value: cost });
  await sale.finalizeSale();

  const owed = await sale.totalUnclaimedTokens();
  console.log("Unclaimed obligation:", hre.ethers.formatEther(owed), "WLAB");

  await sale.connect(buyer).claim(3);
  const buyerBal = await token.balanceOf(buyer.address);
  console.log("Buyer balance after claim:", hre.ethers.formatEther(buyerBal));
  if (buyerBal !== buyAmt) throw new Error("Claim amount mismatch");

  // recoverUnsoldTokens must not touch unclaimed (already claimed)
  const beforeRecover = await token.balanceOf(saleAddr);
  await sale.recoverUnsoldTokens(deployer.address);
  const afterRecover = await token.balanceOf(saleAddr);
  console.log("Sale balance after recover:", hre.ethers.formatEther(afterRecover), "(was", hre.ethers.formatEther(beforeRecover), ")");

  // Stake
  await token.connect(buyer).approve(await staking.getAddress(), buyAmt);
  await staking.setRewardRate(hre.ethers.parseEther("1"));
  await staking.connect(buyer).stake(buyAmt / 10n, 0, false);
  console.log("Staked:", hre.ethers.formatEther(buyAmt / 10n), "WLAB");

  // Governance voting power
  await token.connect(buyer).delegate(voter.address);
  const votes = await token.getVotes(voter.address);
  console.log("Voter power:", hre.ethers.formatEther(votes));

  const propRole = await timelock.PROPOSER_ROLE();
  const govHasProposer = await timelock.hasRole(propRole, governorAddr);
  if (!govHasProposer) throw new Error("Governor missing PROPOSER_ROLE on timelock");

  console.log("\n=== E2E LOCAL PASSED ===");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
