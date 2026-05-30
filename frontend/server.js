const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.FRONTEND_PORT || 4173);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const routes = {
  "/": "website/index.html",
  "/tr": "website/tr/index.html",
  "/tr/": "website/tr/index.html",
  "/app": "frontend/index.html",
  "/app/": "frontend/index.html",
  "/whitepaper": "website/whitepaper.html",
  "/whitepaper/": "website/whitepaper.html",
  "/legal": "website/legal.html",
  "/legal/": "website/legal.html",
  "/tokenomics.json": "shared/tokenomics.json",
};

function resolveRequest(url) {
  const cleanUrl = decodeURIComponent((url || "/").split("?")[0]);

  if (routes[cleanUrl]) {
    return path.resolve(root, routes[cleanUrl]);
  }

  const relative = cleanUrl.replace(/^\/+/, "");
  const target = path.resolve(root, relative);
  if (!target.startsWith(root)) return null;
  return target;
}

const server = http.createServer((req, res) => {
  const target = resolveRequest(req.url);
  if (!target) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
      "Cache-Control": path.extname(target) === ".html" ? "no-store" : "public, max-age=300",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`WhiteLab site:  http://127.0.0.1:${port}`);
  console.log(`Protocol app:   http://127.0.0.1:${port}/app`);
  console.log(`Whitepaper:     http://127.0.0.1:${port}/whitepaper`);
  console.log(`Legal:          http://127.0.0.1:${port}/legal`);
});
