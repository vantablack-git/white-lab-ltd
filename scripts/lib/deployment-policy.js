/**
 * Deployment policy — pure helpers that encode WhiteLab's "production
 * deploys must end with the multisig in charge" invariant.
 *
 * Kept dependency-free (no `hre`, no `ethers`) so tests can import and
 * exercise the policy directly without spinning up Hardhat.
 */

const PRODUCTION_NETWORKS = new Set(["base", "baseSepolia"]);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isProductionNetwork(networkName) {
  return PRODUCTION_NETWORKS.has(networkName);
}

/**
 * Normalize a string we expect to be a 0x-prefixed 20-byte address.
 * Returns null when the input is missing or malformed; never throws.
 */
function normalizeAddress(maybeAddress) {
  if (typeof maybeAddress !== "string") return null;
  const trimmed = maybeAddress.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * Hard preflight — runs BEFORE any contract is deployed.
 * Throws with a single, operator-readable error explaining the
 * blocking misconfiguration. Returns the resolved config object on
 * success.
 *
 * @param {object} cfg
 * @param {string} cfg.networkName        Hardhat network name (e.g. "base", "hardhat").
 * @param {string} cfg.deployerAddress    Address of the deploying EOA.
 * @param {string} [cfg.multisigAddress]  MULTISIG_ADDRESS env var value, if any.
 * @param {boolean} [cfg.deployOft]       DEPLOY_OFT env flag (truthy only).
 */
function validateProductionConfig(cfg) {
  const networkName = cfg.networkName;
  const isProd = isProductionNetwork(networkName);
  const deployer = normalizeAddress(cfg.deployerAddress);
  if (!deployer) {
    throw new Error("Deploy preflight: deployer address is missing or malformed.");
  }

  const multisig = normalizeAddress(cfg.multisigAddress);

  if (isProd) {
    if (!multisig) {
      throw new Error(
        `Deploy preflight: MULTISIG_ADDRESS must be set to a 20-byte address on production network "${networkName}". ` +
          "Production deploys are not allowed to leave the deployer EOA holding admin roles."
      );
    }
    if (multisig === deployer) {
      throw new Error(
        `Deploy preflight: MULTISIG_ADDRESS must differ from the deployer EOA on production network "${networkName}". ` +
          "If you intended a single-key deploy, use a non-production network."
      );
    }
    if (multisig === ZERO_ADDRESS) {
      throw new Error("Deploy preflight: MULTISIG_ADDRESS cannot be the zero address.");
    }
  }

  // OFT policy: never deployed on Base mainnet unless DEPLOY_OFT=true is set
  // explicitly. The bridge stub is a future-attack surface today, so we keep
  // it off the mainnet manifest until it is fully wired and reviewed.
  const deployOft =
    networkName === "base" ? Boolean(cfg.deployOft) : true;

  return {
    networkName,
    isProductionNetwork: isProd,
    deployerAddress: deployer,
    multisigAddress: multisig, // null on dev networks when not provided
    deployOft,
    requireHandover: isProd, // production networks must finish with the multisig in charge
  };
}

module.exports = {
  PRODUCTION_NETWORKS,
  ZERO_ADDRESS,
  isProductionNetwork,
  normalizeAddress,
  validateProductionConfig,
};
