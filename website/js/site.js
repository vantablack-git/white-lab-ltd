import { escapeHtml } from "/shared/dom-utils.js";
import { loadManifest, renderAddressRegistry } from "/shared/manifest-utils.js";
import { trackEvent } from "/shared/analytics.js";

const GRAYS = ["#ffffff", "#e8e8e8", "#d0d0d0", "#b8b8b8", "#a2a2a2", "#8c8c8c", "#767676", "#606060", "#4a4a4a", "#343434"];

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

let activeSlice = -1;

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
    bindDonutKeyboard();
  } catch {
    /* fallback static */
  }
}

function renderAllocationTable() {
  const tbody = document.getElementById("allocationRows");
  if (!tbody) return;
  tbody.innerHTML = ALLOCATION.map(
    ([name, pct, amount, tge], index) =>
      `<tr class="alloc-row" data-index="${index}" tabindex="0" role="button" aria-label="${escapeHtml(name)} ${escapeHtml(pct)} percent">
        <td>${escapeHtml(name)}</td><td>${escapeHtml(pct)}%</td><td>${escapeHtml(amount)}M</td><td>${escapeHtml(tge)}</td>
      </tr>`
  ).join("");

  tbody.querySelectorAll(".alloc-row").forEach((row) => {
    row.addEventListener("mouseenter", () => highlightSlice(Number(row.dataset.index)));
    row.addEventListener("mouseleave", () => highlightSlice(-1));
    row.addEventListener("focus", () => highlightSlice(Number(row.dataset.index)));
    row.addEventListener("blur", () => highlightSlice(-1));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        highlightSlice(Number(row.dataset.index));
      }
    });
  });
}

function renderDonut() {
  const host = document.getElementById("donutChart");
  if (!host) return;
  let offset = 0;
  const stops = ALLOCATION.map(([, pct], i) => {
    const start = offset;
    offset += pct * 3.6;
    const color = activeSlice === -1 || activeSlice === i ? GRAYS[i] : "#2a2a2a";
    return `${color} ${start}deg ${offset}deg`;
  });
  host.style.background = `conic-gradient(${stops.join(", ")})`;
  host.style.boxShadow = "inset 0 0 0 48px var(--bg-elevated)";

  const caption = document.getElementById("donutCaption");
  if (caption) {
    if (activeSlice >= 0) {
      const [name, pct, amount, tge] = ALLOCATION[activeSlice];
      caption.textContent = `${name}: ${pct}% · ${amount}M WLAB · ${tge}`;
    } else {
      caption.textContent = "Hover or focus a row to inspect allocation.";
    }
  }
}

function highlightSlice(index) {
  activeSlice = index;
  renderDonut();
  document.querySelectorAll(".alloc-row").forEach((row, i) => {
    row.classList.toggle("active", i === index);
  });
  if (index >= 0) {
    const [bucket, percent] = ALLOCATION[index];
    trackEvent("tokenomics_interaction", { bucket, percent });
  }
}

function bindDonutKeyboard() {
  const host = document.getElementById("donutChart");
  if (!host) return;
  host.setAttribute("tabindex", "0");
  host.addEventListener("keydown", (event) => {
    if (!ALLOCATION.length) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      highlightSlice((activeSlice + 1 + ALLOCATION.length) % ALLOCATION.length);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      highlightSlice((activeSlice - 1 + ALLOCATION.length) % ALLOCATION.length);
    }
    if (event.key === "Escape") highlightSlice(-1);
  });
}

function renderContracts(manifest) {
  const grid = document.getElementById("contractGrid");
  const badge = document.getElementById("networkBadge");
  if (!grid || !badge) return;

  if (!manifest?.contracts || !Object.keys(manifest.contracts).length) {
    badge.textContent = "No live deployment";
    renderAddressRegistry(grid, null);
    return;
  }

  badge.textContent = `${manifest.network} · chain ${manifest.chainId} · deployed ${new Date(manifest.deployedAt).toLocaleDateString()}`;
  renderAddressRegistry(grid, manifest, {
    onCopy: (address, contract) =>
      trackEvent("copy_contract_address", {
        address,
        contract,
        chainId: manifest.chainId,
        network: manifest.network,
      }),
  });
}

function bindReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("visible"));
    return;
  }
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

function bindMarketingEvents() {
  document.querySelectorAll('a[href="/app"]').forEach((link) => {
    link.addEventListener("click", () =>
      trackEvent("open_console", { source: link.className || "link" })
    );
  });
  document.querySelectorAll('a[href="/whitepaper"]').forEach((link) => {
    link.addEventListener("click", () =>
      trackEvent("whitepaper_open", { source: link.className || "link" })
    );
  });
  if (window.location.pathname.startsWith("/tr")) {
    trackEvent("tr_page_open");
  }
}

renderAllocationTable();
renderDonut();
bindReveal();
bindMenu();
bindMarketingEvents();
loadTokenomicsForSite();
loadManifest().then(renderContracts);
