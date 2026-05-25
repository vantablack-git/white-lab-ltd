import { escapeHtml } from "/shared/dom-utils.js";

let ALLOCATION = [
  ["Team", 15, 150, "0% TGE"],
  ["Seed", 6, 60, "10% TGE"],
  ["Private", 8, 80, "15% TGE"],
  ["Public IDO", 5, 50, "25% TGE"],
  ["Ecosystem", 20, 200, "5% TGE"],
  ["Liquidity", 10, 100, "40% TGE"],
  ["Staking", 18, 180, "Emission"],
  ["Treasury", 12, 120, "DAO gated"],
  ["Community", 4, 40, "20% TGE"],
  ["Advisors", 2, 20, "0% TGE"],
];

async function loadTokenomicsForSite() {
  try {
    const data = await fetch("/tokenomics.json").then((r) => r.json());
    ALLOCATION = data.allocations.map((a) => [
      a.label,
      a.percent,
      Number(a.tokens) / 1e6,
      a.tgeUnlock,
    ]);
    renderAllocationTable();
    renderDonut();
  } catch {
    /* fallback static */
  }
}

const COLORS = ["#6366f1", "#4c7f9f", "#5a4fcf", "#167c70", "#2f855a", "#b83245", "#3f8f7a", "#6f5cc2", "#d07a2d", "#7b6f63"];

async function loadDeployments() {
  const paths = ["/public/deployments.json", "/deployments/base-sepolia.json", "/deployments/hardhat.json"];
  for (const path of paths) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.contracts) return data;
      const first = Object.values(data)[0];
      if (first?.contracts) return first;
    } catch {
      /* try next */
    }
  }
  return null;
}

function renderAllocationTable() {
  const tbody = document.getElementById("allocationRows");
  if (!tbody) return;
  tbody.innerHTML = ALLOCATION.map(
    ([name, pct, amount, tge]) =>
      `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(pct)}%</td><td>${escapeHtml(amount)}M</td><td>${escapeHtml(tge)}</td></tr>`
  ).join("");
}

function renderDonut() {
  const host = document.getElementById("donutChart");
  if (!host) return;
  let offset = 0;
  const stops = ALLOCATION.map(([name, pct], i) => {
    const start = offset;
    offset += pct * 3.6;
    return `${COLORS[i]} ${start}deg ${offset}deg`;
  });
  host.style.background = `conic-gradient(${stops.join(", ")})`;
  host.style.boxShadow = "inset 0 0 0 48px var(--bg-elevated)";
}

function renderContracts(manifest) {
  const grid = document.getElementById("contractGrid");
  const badge = document.getElementById("networkBadge");
  if (!grid || !badge) return;

  if (!manifest?.contracts || !Object.keys(manifest.contracts).length) {
    badge.textContent = "No live deployment — run npm run deploy:local or deploy:sepolia";
    grid.innerHTML = `<p class="fine-print">Addresses appear here automatically after deployment manifest is written.</p>`;
    return;
  }

  badge.textContent = `${manifest.network} · chain ${manifest.chainId} · deployed ${new Date(manifest.deployedAt).toLocaleDateString()}`;
  grid.innerHTML = Object.entries(manifest.contracts)
    .map(
      ([name, address]) =>
        `<div class="address-row"><strong>${escapeHtml(name)}</strong><code>${escapeHtml(address)}</code></div>`
    )
    .join("");
}

function bindReveal() {
  const items = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
      });
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => observer.observe(el));
}

function bindMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

renderAllocationTable();
renderDonut();
bindReveal();
bindMenu();
loadTokenomicsForSite();
loadDeployments().then(renderContracts);
