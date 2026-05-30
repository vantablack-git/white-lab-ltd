/**
 * Clear local build/cache folders and optionally purge Cloudflare CDN.
 * Run: npm run cache:clear
 *
 * Cloudflare purge (optional): set in .env
 *   CLOUDFLARE_API_TOKEN  — API token with Cache Purge permission
 *   CLOUDFLARE_ZONE_ID    — Zone ID for whitelab.ltd
 *   CLOUDFLARE_PURGE_HOSTS — comma-separated hosts (default: whitelab.ltd,www.whitelab.ltd)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_DIRS = ["dist", "cache"];

function removeDir(name) {
  const target = path.join(root, name);
  if (!fs.existsSync(target)) {
    console.log(`Skip ${name}/ (not present)`);
    return;
  }
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${name}/`);
}

async function purgeCloudflareCdn() {
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID || process.env.CF_ZONE_ID;
  const hostsRaw = process.env.CLOUDFLARE_PURGE_HOSTS || "whitelab.ltd,www.whitelab.ltd";
  const hosts = hostsRaw
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  if (!token || !zoneId) {
    console.log("Cloudflare CDN purge skipped — set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID in .env");
    return false;
  }

  const body = { hosts };
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    const message = payload.errors?.[0]?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  console.log(`Cloudflare CDN purge OK — ${hosts.join(", ")}`);
  return true;
}

console.log("White Lab cache clear\n");

for (const dir of LOCAL_DIRS) {
  removeDir(dir);
}

try {
  await purgeCloudflareCdn();
} catch (error) {
  console.warn(`Cloudflare purge warning: ${error.message}`);
}

console.log("\nDone. Run npm run build:site (or build:site:clean) before deploy.");
