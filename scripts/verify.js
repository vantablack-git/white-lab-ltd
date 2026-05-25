const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function verifyContract(address, constructorArguments, label) {
  try {
    await hre.run("verify:verify", { address, constructorArguments });
    console.log("Verified:", label, address);
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes("Already Verified") || msg.includes("already verified")) {
      console.log("Already verified:", label, address);
    } else {
      console.error("Failed:", label, address, "-", msg);
    }
  }
}

async function main() {
  const network = hre.network.name;
  const file = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment file not found: ${file}\nRun: npm run deploy:sepolia`);
  }

  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const c = d.contracts;
  if (!c.WLABToken) {
    throw new Error(`No contract addresses in ${file}. Deploy first.`);
  }

  const [deployer] = await hre.ethers.getSigners();
  const treasury = d.treasury || deployer.address;
  const minDelay = Number(process.env.TIMELOCK_DELAY || d.timelockDelay || 172800);

  console.log("=== WhiteLab Verify ===");
  console.log("Network :", network);
  console.log("Deployer:", deployer.address);
  console.log("");

  await verifyContract(c.WLABToken, [d.deployer || deployer.address, treasury], "WLABToken");
  await verifyContract(c.WLABVesting, [c.WLABToken, d.deployer || deployer.address], "WLABVesting");
  await verifyContract(
    c.WLABStaking,
    [c.WLABToken, c.WLABToken, d.deployer || deployer.address],
    "WLABStaking"
  );
  await verifyContract(
    c.TimelockController,
    [minDelay, [], [d.deployer || deployer.address], d.deployer || deployer.address],
    "TimelockController"
  );
  await verifyContract(
    c.WLABGovernor,
    [
      c.WLABToken,
      c.TimelockController,
      1,
      45818,
      hre.ethers.parseEther("100000"),
      4,
    ],
    "WLABGovernor"
  );
  await verifyContract(
    c.WLABTokenSale,
    [c.WLABToken, hre.ethers.ZeroAddress, d.deployer || deployer.address],
    "WLABTokenSale"
  );
  await verifyContract(
    c.WLABLockVault,
    [c.WLABToken, d.deployer || deployer.address],
    "WLABLockVault"
  );
  await verifyContract(
    c.WLABOFTAdapter,
    [c.WLABToken, d.deployer || deployer.address],
    "WLABOFTAdapter"
  );

  console.log("\n=== VERIFY COMPLETE ===");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
