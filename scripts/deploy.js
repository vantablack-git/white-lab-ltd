const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

/**
 * WhiteLab full-stack deployment — Hardhat / Base Sepolia / Base mainnet
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = hre.network.name;
  const treasury   = process.env.TREASURY_ADDRESS || deployer.address;
  const minDelay   = Number(process.env.TIMELOCK_DELAY || 172800);

  console.log("=== WhiteLab Deploy ===");
  console.log("Deployer :", deployer.address);
  console.log("Network  :", network);
  console.log("Treasury :", treasury);
  console.log("Timelock :", minDelay, "s");
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

  const Timelock   = await hre.ethers.getContractFactory("TimelockController");
  const timelock   = await Timelock.deploy(minDelay, [], [deployer.address], deployer.address);
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

  const proposerRole  = await timelock.PROPOSER_ROLE();
  const executorRole  = await timelock.EXECUTOR_ROLE();
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

  const VeToken = await hre.ethers.getContractFactory("WLABVeToken");
  const veToken = await VeToken.deploy(tokenAddr, deployer.address);
  await veToken.waitForDeployment();
  const veTokenAddr = await veToken.getAddress();
  console.log("WLABVeToken     :", veTokenAddr);

  const OFT = await hre.ethers.getContractFactory("WLABOFTAdapter");
  const oft = await OFT.deploy(tokenAddr, deployer.address);
  await oft.waitForDeployment();
  const oftAddr = await oft.getAddress();
  console.log("WLABOFTAdapter  :", oftAddr);
  console.log("OFT status      : stub disabled by default");

  const TreasuryImpl = await hre.ethers.getContractFactory("WLABTreasuryUUPS");
  const treasuryImpl = await TreasuryImpl.deploy();
  await treasuryImpl.waitForDeployment();
  const initData = TreasuryImpl.interface.encodeFunctionData("initialize", [treasury]);
  const Proxy = await hre.ethers.getContractFactory("TestERC1967Proxy");
  const treasuryProxy = await Proxy.deploy(await treasuryImpl.getAddress(), initData);
  await treasuryProxy.waitForDeployment();
  const treasuryProxyAddr = await treasuryProxy.getAddress();
  console.log("WLABTreasury    :", treasuryProxyAddr, "(UUPS proxy)");

  const maxSupply     = hre.ethers.parseEther("1000000000");
  const idoAllocation = hre.ethers.parseEther("100000000");
  await (await token.mint(deployer.address, maxSupply)).wait();
  console.log("Minted 1B WLAB to deployer");

  await (await token.transfer(saleAddr, idoAllocation)).wait();
  console.log("Funded sale contract with 100M WLAB");

  await (await token.setWhitelisted(saleAddr, true)).wait();
  await (await token.setFeeExempt(saleAddr, true)).wait();
  await (await token.setFeeExempt(stakingAddr, true)).wait();
  console.log("Sale + Staking fee-exempt on token");

  // ─── POST-DEPLOY MULTISIG HANDOVER (MANUAL — before mainnet) ───────────────
  // 1. token.grantRole(DEFAULT_ADMIN_ROLE, gnosisSafe)
  // 2. token.grantRole(MINTER_ROLE, gnosisSafe)
  // 3. token.revokeRole(DEFAULT_ADMIN_ROLE, deployer)
  // 4. staking.transferOwnership(gnosisSafe)
  // 5. vesting.transferOwnership(gnosisSafe)
  // 6. sale.transferOwnership(gnosisSafe)
  // 7. timelock: grant TIMELOCK_ADMIN_ROLE to Safe, revoke deployer
  // ───────────────────────────────────────────────────────────────────────────

  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  const manifest = {
    network,
    chainId,
    deployer: deployer.address,
    treasury,
    timelockDelay: minDelay,
    deployedAt: new Date().toISOString(),
    status: {
      mainnetReady: false,
      oftAdapter: "disabled-stub",
      treasuryProxy: "deployed",
      audit: "required-before-mainnet",
    },
    tokenomics: {
      maxSupply: "1000000000",
      tgeCirculating: "88500000",
      tgeCirculatingPct: "8.85",
    },
    contracts: {
      WLABToken: tokenAddr,
      WLABVesting: vestingAddr,
      WLABStaking: stakingAddr,
      TimelockController: timelockAddr,
      WLABGovernor: governorAddr,
      WLABTokenSale: saleAddr,
      WLABVeToken: veTokenAddr,
      WLABOFTAdapter: oftAddr,
      WLABTreasuryUUPS: treasuryProxyAddr,
    },
  };

  const outDir  = path.join(__dirname, "..", "deployments");
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
    fs.copyFileSync(tokenomicsSrc, path.join(publicDir, "..", "tokenomics.json"));
    fs.copyFileSync(tokenomicsSrc, path.join(publicDir, "tokenomics.json"));
  }

  console.log("\nSaved:", outFile);
  console.log("Public manifest: public/deployments.json");

  if (process.env.CONFIGURE_DEMO !== "false") {
    const { configureDemoSale } = require("./configure-demo-sale");
    await configureDemoSale(manifest);
  } else {
    console.log("\nSkipped demo setup (CONFIGURE_DEMO=false)");
    console.log("Run: npm run configure:demo -- --network", network);
  }

  console.log("Next: npm run build:site");
  console.log("\n=== DEPLOY COMPLETE ===");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
