import { escapeHtml } from "../../shared/dom-utils.js";

const tierLabels = {
  free: "Free",
  "free-trial": "Free trial",
  paid: "Paid",
  enterprise: "Enterprise",
};

const efficiencyLabels = {
  "very-high": "Very high efficiency",
  high: "High efficiency",
  medium: "Medium efficiency",
};

async function loadDirectory() {
  const response = await fetch("/shared/api-directory.json");
  if (!response.ok) throw new Error("Could not load API directory");
  return response.json();
}

function renderApiCard(api) {
  const tier = tierLabels[api.tier] || api.tier;
  const efficiency = api.efficiency ? `<span class="api-efficiency">${escapeHtml(efficiencyLabels[api.efficiency] || api.efficiency)}</span>` : "";
  const allowance = api.freeAllowance ? `<p><strong>Free allowance:</strong> ${escapeHtml(api.freeAllowance)}</p>` : "";
  const entry = api.entryPrice ? `<p><strong>Entry:</strong> ${escapeHtml(api.entryPrice)}</p>` : "";

  return `
    <article class="api-card reveal">
      <header class="api-card-head">
        <h3>${escapeHtml(api.name)}</h3>
        <span class="proof-pill">${escapeHtml(tier)}</span>
      </header>
      ${efficiency}
      <p><strong>Best for:</strong> ${escapeHtml(api.bestFor)}</p>
      ${allowance}
      ${entry}
      <p class="fine-print">${escapeHtml(api.notes)}</p>
      <a class="btn ghost" href="${escapeHtml(api.pricingUrl)}" target="_blank" rel="noopener noreferrer">Pricing & docs ↗</a>
    </article>
  `;
}

function renderDirectory(data) {
  const root = document.getElementById("apiDirectory");
  if (!root) return;

  const sections = data.categories
    .map(
      (category) => `
      <section class="api-category">
        <h2>${escapeHtml(category.label)}</h2>
        <div class="api-grid">${category.apis.map(renderApiCard).join("")}</div>
      </section>
    `
    )
    .join("");

  root.innerHTML = sections;
  document.querySelectorAll(".api-category .reveal").forEach((el) => el.classList.add("visible"));
}

loadDirectory()
  .then(renderDirectory)
  .catch((error) => {
    const root = document.getElementById("apiDirectory");
    if (root) root.innerHTML = `<p class="fine-print">Failed to load directory: ${escapeHtml(error.message)}</p>`;
  });
