import { escapeHtml } from "/shared/dom-utils.js";

const EXPLORERS = {
  8453: "https://basescan.org/address/",
  84532: "https://sepolia.basescan.org/address/",
  31337: null,
};

const MANIFEST_PATHS = [
  "/public/deployments.json",
  "/deployments/baseSepolia.json",
  "/deployments/base-sepolia.json",
  "/deployments/hardhat.json",
];

export function shortAddress(address) {
  if (!address || address.length < 10) return address || "-";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function explorerUrl(chainId, address) {
  const base = EXPLORERS[Number(chainId)];
  if (!base || !address) return null;
  return `${base}${address}`;
}

export function pickManifest(data) {
  if (data?.contracts && Object.keys(data.contracts).length) return data;
  if (typeof data !== "object" || !data) return null;
  const preferred = ["baseSepolia", "hardhat", "base"];
  for (const key of preferred) {
    if (data[key]?.contracts && Object.keys(data[key].contracts).length) return data[key];
  }
  const entries = Object.values(data).filter((v) => v?.contracts && Object.keys(v.contracts).length);
  if (!entries.length) return null;
  return entries.sort((a, b) => Date.parse(b.deployedAt || 0) - Date.parse(a.deployedAt || 0))[0];
}

export async function loadManifest(paths = MANIFEST_PATHS) {
  for (const path of paths) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const data = await res.json();
      const picked = pickManifest(data);
      if (picked) return picked;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "absolute";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

export function renderAddressRegistry(container, manifest, { onCopy } = {}) {
  if (!container) return;

  if (!manifest?.contracts || !Object.keys(manifest.contracts).length) {
    container.innerHTML = `<p class="fine-print">No live deployment. Run <code>npm run deploy:local</code> or configure Base Sepolia env and run <code>npm run deploy:sepolia</code>.</p>`;
    return;
  }

  const chainId = Number(manifest.chainId || 0);
  container.innerHTML = Object.entries(manifest.contracts)
    .map(([name, address]) => {
      const href = explorerUrl(chainId, address);
      const explorer = href
        ? `<a class="registry-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Basescan</a>`
        : `<span class="registry-link muted">Local</span>`;
      return `
        <article class="registry-row" data-address="${escapeHtml(address)}">
          <div class="registry-meta">
            <strong>${escapeHtml(name)}</strong>
            <code title="${escapeHtml(address)}">${escapeHtml(shortAddress(address))}</code>
          </div>
          <div class="registry-actions">
            <button type="button" class="registry-copy" data-copy="${escapeHtml(address)}" data-contract="${escapeHtml(name)}">Copy</button>
            ${explorer}
          </div>
        </article>`;
    })
    .join("");

  container.querySelectorAll(".registry-copy").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.dataset.copy;
      if (!value) return;
      await copyText(value);
      button.textContent = "Copied";
      onCopy?.(value, button.dataset.contract);
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1400);
    });
  });
}
