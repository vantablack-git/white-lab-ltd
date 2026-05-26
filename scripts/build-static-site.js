/**
 * Builds dist/ for Cloudflare Pages / GitHub Pages (no Node server required).
 * Run: npm run build:site
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function fileHash(filePath) {
  if (!fs.existsSync(filePath)) return Date.now().toString(36);
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 8);
}

const cacheBust = {
  siteCss: fileHash(path.join(root, "website", "css", "site.css")),
  siteJs: fileHash(path.join(root, "website", "js", "site.js")),
  appCss: fileHash(path.join(root, "frontend", "src", "styles.css")),
  appJs: fileHash(path.join(root, "frontend", "src", "app.js")),
};

const ARTIFACTS = [
  "WLABToken",
  "WLABTokenSale",
  "WLABStaking",
  "WLABLockVault",
  "WLABGovernor",
];

const SECURITY_HEADERS = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://sepolia.base.org https://mainnet.base.org https://*.base.org https://*.basescan.org; font-src 'self'; frame-ancestors 'none'; base-uri 'self'
`;

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  mkdir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  mkdir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

function writeAppIndex() {
  let html = fs.readFileSync(path.join(root, "frontend", "index.html"), "utf8");
  html = html
    .replace(/\/frontend\/src\/styles.css/g, `/app/styles.css?v=${cacheBust.appCss}`)
    .replace(/\/frontend\/src\/app.js/g, `/app/app.js?v=${cacheBust.appJs}`)
    .replace(/\/shared\/tokens.css/g, `/shared/tokens.css`);
  fs.writeFileSync(path.join(dist, "app", "index.html"), html);
}

function writeMarketingIndex() {
  let html = fs.readFileSync(path.join(root, "website", "index.html"), "utf8");
  html = html
    .replace(/\/website\/css\/site.css/g, `/css/site.css?v=${cacheBust.siteCss}`)
    .replace(/\/website\/js\/site.js/g, `/js/site.js?v=${cacheBust.siteJs}`)
    .replace(/\/shared\/tokens.css/g, `/shared/tokens.css`);
  fs.writeFileSync(path.join(dist, "index.html"), html);
}

function writeLegal() {
  let html = fs.readFileSync(path.join(root, "website", "legal.html"), "utf8");
  html = html.replace(/\/website\/css\/site.css/g, `/css/site.css?v=${cacheBust.siteCss}`);
  mkdir(path.join(dist, "legal"));
  fs.writeFileSync(path.join(dist, "legal.html"), html);
  fs.writeFileSync(path.join(dist, "legal", "index.html"), html);
}

function writeWhitepaper() {
  let html = fs.readFileSync(path.join(root, "website", "whitepaper.html"), "utf8");
  html = html
    .replace(/\/website\/css\/site.css/g, `/css/site.css?v=${cacheBust.siteCss}`)
    .replace(/\/shared\/tokens.css/g, `/shared/tokens.css`);
  mkdir(path.join(dist, "whitepaper"));
  fs.writeFileSync(path.join(dist, "whitepaper.html"), html);
  fs.writeFileSync(path.join(dist, "whitepaper", "index.html"), html);
}

function writeTurkishIndex() {
  mkdir(path.join(dist, "tr"));
  let html = fs.readFileSync(path.join(root, "website", "tr", "index.html"), "utf8");
  html = html
    .replace(/\/website\/css\/site.css/g, `/css/site.css?v=${cacheBust.siteCss}`)
    .replace(/\/website\/js\/site.js/g, `/js/site.js?v=${cacheBust.siteJs}`);
  fs.writeFileSync(path.join(dist, "tr", "index.html"), html);
}

function main() {
  console.log("Building static site → dist/");
  rm(dist);
  mkdir(dist);

  writeMarketingIndex();
  writeTurkishIndex();
  writeWhitepaper();
  writeLegal();
  mkdir(path.join(dist, "app"));
  writeAppIndex();

  copyDir(path.join(root, "website", "css"), path.join(dist, "css"));
  copyDir(path.join(root, "website", "js"), path.join(dist, "js"));
  copyDir(path.join(root, "shared"), path.join(dist, "shared"));
  copyFile(path.join(root, "frontend", "src", "app.js"), path.join(dist, "app", "app.js"));
  copyFile(path.join(root, "frontend", "src", "styles.css"), path.join(dist, "app", "styles.css"));

  copyFile(path.join(root, "shared", "tokenomics.json"), path.join(dist, "tokenomics.json"));
  copyDir(path.join(root, "public"), path.join(dist, "public"));
  copyDir(path.join(root, "deployments"), path.join(dist, "deployments"));

  mkdir(path.join(dist, "artifacts", "contracts"));
  for (const name of ARTIFACTS) {
    const file = path.join(root, "artifacts", "contracts", `${name}.sol`, `${name}.json`);
    if (fs.existsSync(file)) {
      copyFile(file, path.join(dist, "artifacts", "contracts", `${name}.sol`, `${name}.json`));
    }
  }

  const redirects = [
    "/app/*  /app/index.html  200",
    "/tr  /tr/index.html  200",
    "/tr/  /tr/index.html  200",
    "/whitepaper  /whitepaper/  301",
    "/whitepaper.html  /whitepaper/  301",
    "/legal  /legal/  301",
    "/legal.html  /legal/  301",
  ].join("\n");
  fs.writeFileSync(path.join(dist, "_redirects"), `${redirects}\n`);

  fs.writeFileSync(path.join(dist, "_headers"), SECURITY_HEADERS);

  console.log("Done. Deploy folder: dist/");
  console.log(
    `Cache-bust hashes — site.css=${cacheBust.siteCss} site.js=${cacheBust.siteJs} app.css=${cacheBust.appCss} app.js=${cacheBust.appJs}`
  );
  console.log("Cloudflare Pages → Build output directory: dist");
}

main();
