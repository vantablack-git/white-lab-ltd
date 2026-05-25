/**
 * Standalone handover — transfers all token AccessControl roles, Ownable
 * ownerships, and the Timelock admin role from the deployer EOA to the
 * configured multisig.
 *
 * On production deploys (`scripts/deploy.js` against `base` /
 * `baseSepolia`), this same logic is invoked automatically before the
 * deploy script exits successfully. This script exists for two cases:
 *
 *   1. Idempotent re-runs against a manifest that already underwent
 *      auto-handover (no-ops everywhere).
 *   2. Recovery on dev networks where the operator wants to simulate
 *      the production posture before pushing to mainnet.
 *
 * Run: npx hardhat run scripts/handover-multisig.js --network <network>
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const { performHandover, auditDeployerResidual } = require("./lib/handover");

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
  const [deployer] = await hre.ethers.getSigners();

  if (deployer.address.toLowerCase() === safe.toLowerCase()) {
    throw new Error("MULTISIG_ADDRESS must differ from deployer EOA.");
  }

  console.log("=== Multisig handover ===");
  console.log("Network :", network);
  console.log("Deployer:", deployer.address);
  console.log("Safe    :", safe);

  await performHandover({
    hre,
    deployer,
    safe,
    contracts: manifest.contracts,
  });

  const residual = await auditDeployerResidual({
    hre,
    deployer,
    contracts: manifest.contracts,
  });
  if (residual.length > 0) {
    throw new Error(
      "Handover halted: deployer still holds privileged authority:\n  - " +
        residual.join("\n  - ")
    );
  }

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

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { main };
