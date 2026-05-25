const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const {
  validateProductionConfig,
  isProductionNetwork,
} = require("./lib/deployment-policy");
const { performHandover, auditDeployerResidual } = require("./lib/handover");

/**
 * WhiteLab full-stack deployment — Hardhat / Base Sepolia / Base mainnet.
 *
 * Production-network invariant (enforced, not advised):
 *   - MULTISIG_ADDRESS must be set and != deployer EOA.
 *   - The deployer is divested of all admin roles, ownerships, and timelock
 *     admin authority before this script exits successfully.
 *   - The OFT adapter is NOT deployed on Base mainnet unless DEPLOY_OFT=true
 *     is set explicitly.
 *
 * Non-production networks (hardhat, localhost) keep the legacy single-key
 * convenience deploy: the deployer keeps roles for E2E and demo flows.
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const minDelay = Number(process.env.TIMELOCK_DELAY || 172800);

  // ── Preflight ────────────────────────────────────────────────────────────
  const policy = validateProductionConfig({
    networkName: network,
    deployerAddress: deployer.address,
    multisigAddress: process.env.MULTISIG_ADDRESS,
    deployOft: process.env.DEPLOY_OFT === "true",
  });

  // On production networks the treasury proxy and contracts are initialized
  // straight onto the multisig — never onto the deployer. On dev networks the
  // legacy treasury argument continues to be used so the existing E2E and
  // demo flows keep working.
  const treasuryProxyAdmin = policy.isProductionNetwork
    ? policy.multisigAddress
    : treasury;

  console.log("=== WhiteLab Deploy ===");
  console.log("Deployer        :", deployer.address);
  console.log("Network         :", network);
  console.log("Treasury (fee)  :", treasury);
  console.log("Treasury admin  :", treasuryProxyAdmin);
  console.log("Multisig        :", policy.multisigAddress || "(none — dev network)");
  console.log("Timelock delay  :", minDelay, "s");
  console.log("Production      :", policy.isProductionNetwork);
  console.log("OFT enabled     :", policy.deployOft);
  console.log("");

  const Token = await hre.ethers.getContractFactory("WLABToken");
  const token = await Token.deploy(deployer.address, treasury);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("WLABToken       :", tokenAddr);

  const Vesting = await hre.ethers.getContractFactory("WLABVesting");
  const vesting = await Vesting.deploy(tokenAddr, deployer.address);
  await vesting.waitForDeployment();
  const vestingAddr = await vesting.getAddress();
  console.log("WLABVesting     :", vestingAddr);

  const Staking = await hre.ethers.getContractFactory("WLABStaking");
  const staking = await Staking.deploy(tokenAddr, tokenAddr, deployer.address);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("WLABStaking     :", stakingAddr);

  const Timelock = await hre.ethers.getContractFactory("TimelockController");
  const timelock = await Timelock.deploy(minDelay, [], [deployer.address], deployer.address);
  await timelock.waitForDeployment();
  const timelockAddr = await timelock.getAddress();
  console.log("Timelock        :", timelockAddr);

  const Governor = await hre.ethers.getContractFactory("WLABGovernor");
  const governor = await Governor.deploy(
    tokenAddr,
    timelockAddr,
    1,
    45818,
    hre.ethers.parseEther("100000"),
    4
  );
  await governor.waitForDeployment();
  const governorAddr = await governor.getAddress();
  console.log("WLABGovernor    :", governorAddr);

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const cancellerRole = await timelock.CANCELLER_ROLE();
  await (await timelock.grantRole(proposerRole, governorAddr)).wait();
  await (await timelock.grantRole(cancellerRole, governorAddr)).wait();
  await (await timelock.grantRole(executorRole, hre.ethers.ZeroAddress)).wait();
  console.log("Timelock roles  : Governor proposer/canceller, public executor");

  const Sale = await hre.ethers.getContractFactory("WLABTokenSale");
  const sale = await Sale.deploy(tokenAddr, hre.ethers.ZeroAddress, deployer.address);
  await sale.waitForDeployment();
  const saleAddr = await sale.getAddress();
  console.log("WLABTokenSale   :", saleAddr);

  const LockVault = await hre.ethers.getContractFactory("WLABLockVault");
  const lockVault = await LockVault.deploy(tokenAddr, deployer.address);
  await lockVault.waitForDeployment();
  const lockVaultAddr = await lockVault.getAddress();
  console.log("WLABLockVault   :", lockVaultAddr);

  let oftAddr = null;
  if (policy.deployOft) {
    const OFT = await hre.ethers.getContractFactory("WLABOFTAdapter");
    const oft = await OFT.deploy(tokenAddr, deployer.address);
    await oft.waitForDeployment();
    oftAddr = await oft.getAddress();
    console.log("WLABOFTAdapter  :", oftAddr);
    console.log("OFT status      : stub disabled by default");
  } else {
    console.log("WLABOFTAdapter  : skipped (DEPLOY_OFT not set on this network)");
  }

  const TreasuryImpl = await hre.ethers.getContractFactory("WLABTreasuryUUPS");
  const treasuryImpl = await TreasuryImpl.deploy();
  await treasuryImpl.waitForDeployment();
  const initData = TreasuryImpl.interface.encodeFunctionData("initialize", [treasuryProxyAdmin]);
  const Proxy = await hre.ethers.getContractFactory("WLABERC1967Proxy");
  const treasuryProxy = await Proxy.deploy(await treasuryImpl.getAddress(), initData);
  await treasuryProxy.waitForDeployment();
  const treasuryProxyAddr = await treasuryProxy.getAddress();
  console.log("WLABTreasury    :", treasuryProxyAddr, "(UUPS proxy → admin:", treasuryProxyAdmin + ")");

  const maxSupply = hre.ethers.parseEther("1000000000");
  const idoAllocation = hre.ethers.parseEther("100000000");
  await (await token.mint(deployer.address, maxSupply)).wait();
  console.log("Minted 1B WLAB to deployer");

  await (await token.transfer(saleAddr, idoAllocation)).wait();
  console.log("Funded sale contract with 100M WLAB");

  await (await token.setWhitelisted(saleAddr, true)).wait();
  await (await token.setFeeExempt(saleAddr, true)).wait();
  await (await token.setFeeExempt(stakingAddr, true)).wait();
  console.log("Sale + Staking fee-exempt on token");

  // ── Manifest assembly ────────────────────────────────────────────────────
  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  const manifestContracts = {
    WLABToken: tokenAddr,
    WLABVesting: vestingAddr,
    WLABStaking: stakingAddr,
    TimelockController: timelockAddr,
    WLABGovernor: governorAddr,
    WLABTokenSale: saleAddr,
    WLABLockVault: lockVaultAddr,
    WLABTreasuryUUPS: treasuryProxyAddr,
  };
  if (oftAddr) manifestContracts.WLABOFTAdapter = oftAddr;

  const manifest = {
    network,
    chainId,
    deployer: deployer.address,
    treasury,
    treasuryProxyAdmin,
    multisig: policy.multisigAddress,
    timelockDelay: minDelay,
    deployedAt: new Date().toISOString(),
    status: {
      mainnetReady: false,
      oftAdapter: policy.deployOft ? "deployed-disabled-stub" : "skipped",
      treasuryProxy: "deployed",
      audit: "required-before-mainnet",
    },
    tokenomics: {
      maxSupply: "1000000000",
      tgeCirculating: "88500000",
      tgeCirculatingPct: "8.85",
    },
    contracts: manifestContracts,
  };

  // ── Auto-handover on production networks ────────────────────────────────
  if (policy.requireHandover) {
    console.log("\n=== Production handover ===");
    console.log("Transferring all admin roles and ownerships to:", policy.multisigAddress);
    await performHandover({
      hre,
      deployer,
      safe: policy.multisigAddress,
      contracts: manifestContracts,
    });

    const residual = await auditDeployerResidual({
      hre,
      deployer,
      contracts: manifestContracts,
    });
    if (residual.length > 0) {
      throw new Error(
        "Production deploy halted: deployer still holds privileged authority after handover:\n  - " +
          residual.join("\n  - ")
      );
    }
    manifest.adminHandover = {
      safe: policy.multisigAddress,
      completedAt: new Date().toISOString(),
      deployerRevoked: true,
    };
    console.log("Production handover complete. Deployer holds no privileged authority.");
  } else {
    console.log("\nDev network — deployer keeps roles for E2E/demo flows.");
    console.log("To re-target this deploy at production, set MULTISIG_ADDRESS and use --network base[Sepolia].");
  }

  // ── Persist artifacts ───────────────────────────────────────────────────
  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network}.json`);
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));
  if (network === "baseSepolia") {
    fs.writeFileSync(path.join(outDir, "base-sepolia.json"), JSON.stringify(manifest, null, 2));
  }

  const publicDir = path.join(__dirname, "..", "public");
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(
    path.join(publicDir, "deployments.json"),
    JSON.stringify({ [network]: manifest }, null, 2)
  );
  const tokenomicsSrc = path.join(__dirname, "..", "shared", "tokenomics.json");
  if (fs.existsSync(tokenomicsSrc)) {
    fs.copyFileSync(tokenomicsSrc, path.join(publicDir, "tokenomics.json"));
  }

  console.log("\nSaved:", outFile);
  console.log("Public manifest: public/deployments.json");

  // Demo configuration is only useful on networks where the deployer still
  // controls the contracts. After a production handover the multisig owns
  // everything, so the deployer cannot configure phases anyway.
  const skipDemo =
    process.env.CONFIGURE_DEMO === "false" || policy.requireHandover;
  if (!skipDemo) {
    const { configureDemoSale } = require("./configure-demo-sale");
    await configureDemoSale(manifest);
  } else {
    console.log("\nSkipped demo setup");
    if (policy.requireHandover) {
      console.log("(production handover already revoked deployer authority)");
    } else {
      console.log("Run: npm run configure:demo -- --network", network);
    }
  }

  console.log("Next: npm run build:site");
  console.log("\n=== DEPLOY COMPLETE ===");
}

// Surface the production-network constant so the handover script and tests
// can reuse the same definition without duplicating it.
module.exports = { main, isProductionNetwork };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
