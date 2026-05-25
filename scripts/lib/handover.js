/**
 * Handover orchestration — moves token AccessControl roles, Ownable
 * ownerships, and the Timelock admin role from the deployer EOA to the
 * configured multisig.
 *
 * Used by:
 *   - scripts/deploy.js          (auto-handover on production networks)
 *   - scripts/handover-multisig.js (idempotent standalone re-run)
 *
 * The module is `hre`-aware (it needs a hardhat runtime to attach to
 * deployed contracts) but the inputs are explicit so callers control
 * which contracts are handed over.
 */

async function ensureGranted(target, role, safe) {
  if (!(await target.hasRole(role, safe))) {
    await (await target.grantRole(role, safe)).wait();
  }
}

async function ensureRevoked(target, role, deployer) {
  if (await target.hasRole(role, deployer.address)) {
    await (await target.revokeRole(role, deployer.address)).wait();
  }
}

/**
 * Run the full handover.
 *
 * @param {object} args
 * @param {object} args.hre        Hardhat runtime environment.
 * @param {object} args.deployer   Hardhat signer object (deployer EOA).
 * @param {string} args.safe       Multisig address.
 * @param {object} args.contracts  Map of contract names -> addresses
 *                                  ({ WLABToken, WLABVesting, WLABStaking,
 *                                    WLABTokenSale, WLABLockVault,
 *                                    WLABOFTAdapter?, TimelockController }).
 *                                  WLABOFTAdapter is optional.
 */
async function performHandover({ hre, deployer, safe, contracts }) {
  const c = contracts;
  if (!safe) throw new Error("Handover: safe address is required.");
  if (safe.toLowerCase() === deployer.address.toLowerCase()) {
    throw new Error("Handover: safe must differ from deployer EOA.");
  }

  // Always bind the contract instances to the deployer signer so the
  // handover transactions originate from the role/owner holder rather
  // than whatever happens to be the default Hardhat runner.
  const token = await hre.ethers.getContractAt("WLABToken", c.WLABToken, deployer);
  const vesting = await hre.ethers.getContractAt("WLABVesting", c.WLABVesting, deployer);
  const staking = await hre.ethers.getContractAt("WLABStaking", c.WLABStaking, deployer);
  const sale = await hre.ethers.getContractAt("WLABTokenSale", c.WLABTokenSale, deployer);
  const lockVault = await hre.ethers.getContractAt("WLABLockVault", c.WLABLockVault, deployer);
  const timelock = await hre.ethers.getContractAt(
    "TimelockController",
    c.TimelockController,
    deployer
  );
  const oft = c.WLABOFTAdapter
    ? await hre.ethers.getContractAt("WLABOFTAdapter", c.WLABOFTAdapter, deployer)
    : null;

  // ── Token roles ─────────────────────────────────────────────────────────
  // Order matters. Granting requires DEFAULT_ADMIN_ROLE on the caller, so we
  // grant ALL roles to the safe before revoking ANY role from the deployer.
  // If we revoked DEFAULT_ADMIN_ROLE from the deployer first, we would lose
  // the authority needed to grant the remaining roles to the safe and the
  // handover would brick midway through.
  const tokenAdminRole = await token.DEFAULT_ADMIN_ROLE();
  const tokenRoles = [
    tokenAdminRole,
    await token.MINTER_ROLE(),
    await token.BURNER_ROLE(),
    await token.PAUSER_ROLE(),
    await token.SNAPSHOT_ROLE(),
    await token.COMPLIANCE_ROLE(),
  ];
  for (const role of tokenRoles) {
    await ensureGranted(token, role, safe);
  }
  // Now revoke from the deployer. DEFAULT_ADMIN_ROLE is revoked LAST so the
  // deployer retains the authority required to revoke their own non-admin
  // roles in the same script.
  for (const role of tokenRoles) {
    if (role === tokenAdminRole) continue;
    await ensureRevoked(token, role, deployer);
  }
  await ensureRevoked(token, tokenAdminRole, deployer);

  // ── Ownable contracts ───────────────────────────────────────────────────
  const ownableContracts = [vesting, staking, sale, lockVault];
  if (oft) ownableContracts.push(oft);
  for (const contract of ownableContracts) {
    const current = await contract.owner();
    if (current.toLowerCase() !== safe.toLowerCase()) {
      await (await contract.transferOwnership(safe)).wait();
    }
  }

  // ── Timelock admin ──────────────────────────────────────────────────────
  // OZ v5 TimelockController exposes the role hash via DEFAULT_ADMIN_ROLE().
  // Same grant-then-revoke ordering applies.
  const timelockAdminRole = await timelock.DEFAULT_ADMIN_ROLE();
  await ensureGranted(timelock, timelockAdminRole, safe);
  await ensureRevoked(timelock, timelockAdminRole, deployer);
}

/**
 * Audit the post-handover state and return a list of any privileged
 * roles or ownerships that the deployer still holds. Empty list = clean.
 */
async function auditDeployerResidual({ hre, deployer, contracts }) {
  const residual = [];
  const c = contracts;

  const token = await hre.ethers.getContractAt("WLABToken", c.WLABToken);
  const tokenRoles = {
    DEFAULT_ADMIN_ROLE: await token.DEFAULT_ADMIN_ROLE(),
    MINTER_ROLE: await token.MINTER_ROLE(),
    BURNER_ROLE: await token.BURNER_ROLE(),
    PAUSER_ROLE: await token.PAUSER_ROLE(),
    SNAPSHOT_ROLE: await token.SNAPSHOT_ROLE(),
    COMPLIANCE_ROLE: await token.COMPLIANCE_ROLE(),
  };
  for (const [label, role] of Object.entries(tokenRoles)) {
    if (await token.hasRole(role, deployer.address)) {
      residual.push(`WLABToken.${label}`);
    }
  }

  const ownableTargets = [
    ["WLABVesting", c.WLABVesting],
    ["WLABStaking", c.WLABStaking],
    ["WLABTokenSale", c.WLABTokenSale],
    ["WLABLockVault", c.WLABLockVault],
  ];
  if (c.WLABOFTAdapter) ownableTargets.push(["WLABOFTAdapter", c.WLABOFTAdapter]);
  for (const [label, addr] of ownableTargets) {
    const inst = await hre.ethers.getContractAt(label, addr);
    const owner = await inst.owner();
    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
      residual.push(`${label}.owner`);
    }
  }

  const timelock = await hre.ethers.getContractAt("TimelockController", c.TimelockController);
  const timelockAdminRole = await timelock.DEFAULT_ADMIN_ROLE();
  if (await timelock.hasRole(timelockAdminRole, deployer.address)) {
    residual.push("TimelockController.DEFAULT_ADMIN_ROLE");
  }

  return residual;
}

module.exports = {
  performHandover,
  auditDeployerResidual,
};
