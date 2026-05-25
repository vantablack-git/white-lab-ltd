/**
 * Transfer Ownable contracts + token admin roles to Gnosis Safe.
 * Requires MULTISIG_ADDRESS in .env and deployer still holding admin.
 * Run: npx hardhat run scripts/handover-multisig.js --network <network>
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function grantAndRevoke(token, role, safe, deployer) {
  if (!(await token.hasRole(role, safe))) {
    await (await token.grantRole(role, safe)).wait();
  }
  if (await token.hasRole(role, deployer.address)) {
    await (await token.revokeRole(role, deployer.address)).wait();
  }
}

async function main() {
  const safe = process.env.MULTISIG_ADDRESS;
  if (!safe || safe === "0x0000000000000000000000000000000000000000") {
    throw new Error("Set MULTISIG_ADDRESS in .env to your Gnosis Safe.");
  }

  const network = hre.network.name;
  const manifestPath = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const c = manifest.contracts;
  const [deployer] = await hre.ethers.getSigners();

  if (deployer.address.toLowerCase() === safe.toLowerCase()) {
    throw new Error("MULTISIG_ADDRESS must differ from deployer EOA.");
  }

  console.log("=== Multisig handover ===");
  console.log("Network :", network);
  console.log("Deployer:", deployer.address);
  console.log("Safe    :", safe);

  const token = await hre.ethers.getContractAt("WLABToken", c.WLABToken);
  const vesting = await hre.ethers.getContractAt("WLABVesting", c.WLABVesting);
  const staking = await hre.ethers.getContractAt("WLABStaking", c.WLABStaking);
  const sale = await hre.ethers.getContractAt("WLABTokenSale", c.WLABTokenSale);
  const ve = await hre.ethers.getContractAt("WLABVeToken", c.WLABVeToken);
  const oft = await hre.ethers.getContractAt("WLABOFTAdapter", c.WLABOFTAdapter);
  const timelock = await hre.ethers.getContractAt("TimelockController", c.TimelockController);

  const roles = [
    await token.DEFAULT_ADMIN_ROLE(),
    await token.MINTER_ROLE(),
    await token.BURNER_ROLE(),
    await token.PAUSER_ROLE(),
    await token.SNAPSHOT_ROLE(),
    await token.COMPLIANCE_ROLE(),
  ];

  for (const role of roles) {
    await grantAndRevoke(token, role, safe, deployer);
  }
  console.log("Token roles → Safe");

  for (const contract of [vesting, staking, sale, ve, oft]) {
    const current = await contract.owner();
    if (current.toLowerCase() !== safe.toLowerCase()) {
      await (await contract.transferOwnership(safe)).wait();
      console.log("Ownership transferred:", await contract.getAddress());
    }
  }

  const adminRole = await timelock.TIMELOCK_ADMIN_ROLE();
  if (!(await timelock.hasRole(adminRole, safe))) {
    await (await timelock.grantRole(adminRole, safe)).wait();
  }
  if (await timelock.hasRole(adminRole, deployer.address)) {
    await (await timelock.revokeRole(adminRole, deployer.address)).wait();
  }
  console.log("Timelock admin → Safe");

  manifest.adminHandover = {
    safe,
    completedAt: new Date().toISOString(),
    deployerRevoked: true,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  if (network === "baseSepolia") {
    fs.writeFileSync(
      path.join(__dirname, "..", "deployments", "base-sepolia.json"),
      JSON.stringify(manifest, null, 2)
    );
  }

  console.log("=== Handover complete — verify Safe can pause/configure before revoking backup keys ===");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
