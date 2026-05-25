/**
 * Post-deploy: fund staking rewards, configure public IDO, optionally start sale.
 * Called from deploy.js in the same Hardhat process, or standalone on live networks.
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function configureDemoSale(manifest) {
  const c = manifest.contracts;
  const [owner] = await hre.ethers.getSigners();

  const token = await hre.ethers.getContractAt("WLABToken", c.WLABToken);
  const sale = await hre.ethers.getContractAt("WLABTokenSale", c.WLABTokenSale);
  const staking = await hre.ethers.getContractAt("WLABStaking", c.WLABStaking);

  const price = hre.ethers.parseEther(process.env.DEMO_SALE_PRICE || "0.00004");
  const allocation = hre.ethers.parseEther(process.env.DEMO_SALE_ALLOCATION || "1000000");
  const hardCap = hre.ethers.parseEther(process.env.DEMO_SALE_HARD_CAP || "100");
  const softCap = hre.ethers.parseEther(process.env.DEMO_SALE_SOFT_CAP || "0.01");
  const rewardFund = hre.ethers.parseEther(process.env.DEMO_STAKING_REWARDS || "1000000");
  const rewardRate = hre.ethers.parseEther(process.env.DEMO_STAKING_RATE || "0.001");

  console.log("\n=== Configure demo protocol ===");

  const stakingBal = await token.balanceOf(c.WLABStaking);
  if (stakingBal < rewardFund) {
    await (await token.transfer(c.WLABStaking, rewardFund)).wait();
    console.log("Funded staking with", hre.ethers.formatEther(rewardFund), "WLAB rewards");
  }

  await (await staking.setRewardRate(rewardRate)).wait();
  console.log("Staking reward rate:", hre.ethers.formatEther(rewardRate), "WLAB/s");

  const phase = 3;
  const current = await sale.currentPhase();
  if (Number(current) === 0) {
    await (
      await sale.configurePhase(phase, price, allocation, hardCap, softCap, hre.ethers.ZeroHash, 0)
    ).wait();
    console.log("Configured Public phase");
  }

  if (process.env.DEMO_START_SALE !== "false") {
    const phaseData = await sale.phases(phase);
    const active = phaseData.active ?? phaseData[7];
    if (!active) {
      await (await sale.startPhase(phase)).wait();
      console.log("Started Public phase — buyers can use /app IDO tab");
    }
  }

  console.log("=== Demo configuration complete ===\n");
}

async function main() {
  const network = hre.network.name;
  const manifestPath = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}. Run deploy first.`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  await configureDemoSale(manifest);
}

module.exports = { configureDemoSale };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
