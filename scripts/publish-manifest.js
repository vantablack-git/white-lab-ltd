/**
 * Publishes deployment manifests to public/ for static site consumption.
 * Run after deploy: node scripts/publish-manifest.js [network]
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const network = process.argv[2] || "hardhat";
const source = path.join(root, "deployments", `${network}.json`);

if (!fs.existsSync(source)) {
  console.error(`Manifest not found: ${source}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(source, "utf8"));
const publicDir = path.join(root, "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

const publicManifestPath = path.join(publicDir, "deployments.json");
let merged = {};
if (fs.existsSync(publicManifestPath)) {
  try {
    merged = JSON.parse(fs.readFileSync(publicManifestPath, "utf8"));
  } catch {
    merged = {};
  }
}

merged[network] = manifest;
const payload = JSON.stringify(merged, null, 2);
fs.writeFileSync(publicManifestPath, payload);

const checksum = crypto.createHash("sha256").update(payload).digest("hex");
const meta = {
  updatedAt: new Date().toISOString(),
  network,
  checksum,
  source: `deployments/${network}.json`,
};
fs.writeFileSync(path.join(publicDir, "deployments.meta.json"), JSON.stringify(meta, null, 2));

console.log("Published manifest:", publicManifestPath);
console.log("Network key:", network);
console.log("SHA-256:", checksum);
