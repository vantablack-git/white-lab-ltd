const requiredByNetwork = {
  baseSepolia: ["PRIVATE_KEY", "BASE_SEPOLIA_RPC", "ETHERSCAN_API_KEY", "TREASURY_ADDRESS"],
  base: ["PRIVATE_KEY", "BASE_MAINNET_RPC", "ETHERSCAN_API_KEY", "TREASURY_ADDRESS"],
};

const network = process.argv[2] || "baseSepolia";
const required = requiredByNetwork[network];

if (!required) {
  console.error(`Unknown network '${network}'. Expected one of: ${Object.keys(requiredByNetwork).join(", ")}`);
  process.exit(1);
}

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === "");

if (process.env.PRIVATE_KEY === "0x0000000000000000000000000000000000000000000000000000000000000001") {
  missing.push("PRIVATE_KEY must not be the Hardhat fallback key");
}

if (process.env.TREASURY_ADDRESS && !/^0x[a-fA-F0-9]{40}$/.test(process.env.TREASURY_ADDRESS)) {
  missing.push("TREASURY_ADDRESS must be a valid 20-byte address");
}

if (missing.length) {
  console.error("Environment validation failed:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Environment validation passed for ${network}.`);
