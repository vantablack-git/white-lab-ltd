const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
  validateProductionConfig,
  isProductionNetwork,
  normalizeAddress,
  PRODUCTION_NETWORKS,
} = require("../scripts/lib/deployment-policy");
const { performHandover, auditDeployerResidual } = require("../scripts/lib/handover");

describe("Deployment policy", function () {
  const DEPLOYER = "0x1111111111111111111111111111111111111111";
  const SAFE = "0x2222222222222222222222222222222222222222";

  it("classifies production networks", function () {
    expect(isProductionNetwork("base")).to.equal(true);
    expect(isProductionNetwork("baseSepolia")).to.equal(true);
    expect(isProductionNetwork("hardhat")).to.equal(false);
    expect(isProductionNetwork("localhost")).to.equal(false);
    expect(PRODUCTION_NETWORKS.has("base")).to.equal(true);
  });

  it("normalizes valid addresses and rejects malformed ones", function () {
    expect(normalizeAddress("0xAbcdEF0123456789abcdef0123456789abcdef01")).to.equal(
      "0xabcdef0123456789abcdef0123456789abcdef01"
    );
    expect(normalizeAddress("0xabc")).to.equal(null);
    expect(normalizeAddress(null)).to.equal(null);
    expect(normalizeAddress(undefined)).to.equal(null);
    expect(normalizeAddress("not-an-address")).to.equal(null);
  });

  it("allows hardhat deploys without a multisig", function () {
    const cfg = validateProductionConfig({
      networkName: "hardhat",
      deployerAddress: DEPLOYER,
    });
    expect(cfg.isProductionNetwork).to.equal(false);
    expect(cfg.requireHandover).to.equal(false);
    expect(cfg.multisigAddress).to.equal(null);
    expect(cfg.deployOft).to.equal(true);
  });

  it("refuses production deploys without MULTISIG_ADDRESS", function () {
    expect(() =>
      validateProductionConfig({
        networkName: "base",
        deployerAddress: DEPLOYER,
      })
    ).to.throw(/MULTISIG_ADDRESS must be set/);

    expect(() =>
      validateProductionConfig({
        networkName: "baseSepolia",
        deployerAddress: DEPLOYER,
        multisigAddress: "",
      })
    ).to.throw(/MULTISIG_ADDRESS must be set/);
  });

  it("refuses production deploys when MULTISIG_ADDRESS equals the deployer", function () {
    expect(() =>
      validateProductionConfig({
        networkName: "base",
        deployerAddress: DEPLOYER,
        multisigAddress: DEPLOYER,
      })
    ).to.throw(/must differ from the deployer/);
  });

  it("refuses production deploys when MULTISIG_ADDRESS is the zero address", function () {
    expect(() =>
      validateProductionConfig({
        networkName: "base",
        deployerAddress: DEPLOYER,
        multisigAddress: "0x0000000000000000000000000000000000000000",
      })
    ).to.throw(/cannot be the zero address/);
  });

  it("refuses production deploys with a malformed multisig address", function () {
    expect(() =>
      validateProductionConfig({
        networkName: "base",
        deployerAddress: DEPLOYER,
        multisigAddress: "0xnotanaddress",
      })
    ).to.throw(/MULTISIG_ADDRESS must be set/);
  });

  it("gates OFT off Base mainnet by default", function () {
    const cfg = validateProductionConfig({
      networkName: "base",
      deployerAddress: DEPLOYER,
      multisigAddress: SAFE,
    });
    expect(cfg.deployOft).to.equal(false);

    const opted = validateProductionConfig({
      networkName: "base",
      deployerAddress: DEPLOYER,
      multisigAddress: SAFE,
      deployOft: true,
    });
    expect(opted.deployOft).to.equal(true);
  });

  it("keeps OFT on baseSepolia and dev networks for testing flows", function () {
    const sepolia = validateProductionConfig({
      networkName: "baseSepolia",
      deployerAddress: DEPLOYER,
      multisigAddress: SAFE,
    });
    expect(sepolia.deployOft).to.equal(true);

    const hh = validateProductionConfig({
      networkName: "hardhat",
      deployerAddress: DEPLOYER,
    });
    expect(hh.deployOft).to.equal(true);
  });
});

describe("Handover orchestration (end-to-end)", function () {
  let deployer, multisigSigner, fakeFeeReceiver;
  let token, vesting, staking, timelock, sale, lockVault, oft;
  let contracts;

  beforeEach(async function () {
    [deployer, multisigSigner, fakeFeeReceiver] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("WLABToken");
    token = await Token.deploy(deployer.address, fakeFeeReceiver.address);

    const Vesting = await ethers.getContractFactory("WLABVesting");
    vesting = await Vesting.deploy(await token.getAddress(), deployer.address);

    const Staking = await ethers.getContractFactory("WLABStaking");
    staking = await Staking.deploy(
      await token.getAddress(),
      await token.getAddress(),
      deployer.address
    );

    const Timelock = await ethers.getContractFactory("TimelockController");
    timelock = await Timelock.deploy(0, [], [deployer.address], deployer.address);

    const Sale = await ethers.getContractFactory("WLABTokenSale");
    sale = await Sale.deploy(
      await token.getAddress(),
      ethers.ZeroAddress,
      deployer.address
    );

    const LockVault = await ethers.getContractFactory("WLABLockVault");
    lockVault = await LockVault.deploy(await token.getAddress(), deployer.address);

    const OFT = await ethers.getContractFactory("WLABOFTAdapter");
    oft = await OFT.deploy(await token.getAddress(), deployer.address);

    contracts = {
      WLABToken: await token.getAddress(),
      WLABVesting: await vesting.getAddress(),
      WLABStaking: await staking.getAddress(),
      TimelockController: await timelock.getAddress(),
      WLABTokenSale: await sale.getAddress(),
      WLABLockVault: await lockVault.getAddress(),
      WLABOFTAdapter: await oft.getAddress(),
    };
  });

  it("rejects a self-handover (safe == deployer)", async function () {
    let err;
    try {
      await performHandover({
        hre: require("hardhat"),
        deployer,
        safe: deployer.address,
        contracts,
      });
    } catch (e) {
      err = e;
    }
    expect(err).to.exist;
    expect(err.message).to.match(/safe must differ from deployer/);
  });

  it("strips the deployer of every privileged role and ownership", async function () {
    const before = await auditDeployerResidual({
      hre: require("hardhat"),
      deployer,
      contracts,
    });
    expect(before.length).to.be.greaterThan(0);

    await performHandover({
      hre: require("hardhat"),
      deployer,
      safe: multisigSigner.address,
      contracts,
    });

    const after = await auditDeployerResidual({
      hre: require("hardhat"),
      deployer,
      contracts,
    });
    expect(after).to.deep.equal([]);
  });

  it("hands the multisig real authority — token roles and timelock admin", async function () {
    await performHandover({
      hre: require("hardhat"),
      deployer,
      safe: multisigSigner.address,
      contracts,
    });

    expect(
      await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), multisigSigner.address)
    ).to.equal(true);
    expect(
      await token.hasRole(await token.MINTER_ROLE(), multisigSigner.address)
    ).to.equal(true);
    expect(
      await timelock.hasRole(
        await timelock.DEFAULT_ADMIN_ROLE(),
        multisigSigner.address
      )
    ).to.equal(true);

    expect(await vesting.owner()).to.equal(multisigSigner.address);
    expect(await staking.owner()).to.equal(multisigSigner.address);
    expect(await sale.owner()).to.equal(multisigSigner.address);
    expect(await lockVault.owner()).to.equal(multisigSigner.address);
    expect(await oft.owner()).to.equal(multisigSigner.address);
  });

  it("is idempotent — second handover is a no-op", async function () {
    await performHandover({
      hre: require("hardhat"),
      deployer,
      safe: multisigSigner.address,
      contracts,
    });
    await performHandover({
      hre: require("hardhat"),
      deployer,
      safe: multisigSigner.address,
      contracts,
    });

    const residual = await auditDeployerResidual({
      hre: require("hardhat"),
      deployer,
      contracts,
    });
    expect(residual).to.deep.equal([]);
  });

  it("works without an OFT adapter when it is omitted from the manifest", async function () {
    const noOftContracts = { ...contracts };
    delete noOftContracts.WLABOFTAdapter;

    await performHandover({
      hre: require("hardhat"),
      deployer,
      safe: multisigSigner.address,
      contracts: noOftContracts,
    });

    const residual = await auditDeployerResidual({
      hre: require("hardhat"),
      deployer,
      contracts: noOftContracts,
    });
    expect(residual).to.deep.equal([]);
  });
});
