import { escapeHtml } from "/shared/dom-utils.js";

const PHASE = { Seed: 1, Private: 2, Public: 3 };
const SUPPLY = [
  ["Team", 15, "#b7791f"],
  ["Seed", 6, "#4c7f9f"],
  ["Private", 8, "#5a4fcf"],
  ["Public IDO", 5, "#167c70"],
  ["Ecosystem", 20, "#2f855a"],
  ["Liquidity", 10, "#b83245"],
  ["Staking", 18, "#3f8f7a"],
  ["Treasury", 12, "#6f5cc2"],
  ["Community", 4, "#d07a2d"],
  ["Advisors", 2, "#7b6f63"],
];

const RPC_BY_CHAIN = {
  8453: "https://mainnet.base.org",
  84532: "https://sepolia.base.org",
};

const state = {
  provider: null,
  readProvider: null,
  signer: null,
  account: null,
  chainId: null,
  manifest: null,
  tokenomics: null,
  abis: {},
  contracts: {},
  readContracts: {},
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function showAlert(message, type = "info") {
  const row = $("#alertRow");
  const item = document.createElement("div");
  item.className = `alert ${type}`;
  item.textContent = message;
  row.prepend(item);
  setTimeout(() => item.remove(), 9000);
}

function formatAddress(address) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatToken(value) {
  if (value === undefined || value === null) return "-";
  const formatted = ethers.formatEther(value);
  const [whole, decimals = ""] = formatted.split(".");
  return `${Number(whole).toLocaleString()}${decimals.slice(0, 4).replace(/0+$/, "") ? `.${decimals.slice(0, 4).replace(/0+$/, "")}` : ""}`;
}

function parseToken(value) {
  if (!value || Number(value) <= 0) throw new Error("Enter a positive amount.");
  return ethers.parseEther(value);
}

function currentNetworkName(chainId) {
  const id = Number(chainId || 0);
  if (id === 8453) return "Base";
  if (id === 84532) return "Base Sepolia";
  if (id === 31337) return "Hardhat";
  return `Unsupported chain ${id || "-"}`;
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function pickManifest(data) {
  if (data?.contracts && Object.keys(data.contracts).length) return data;
  if (typeof data !== "object" || !data) return null;
  const entries = Object.values(data).filter((v) => v?.contracts && Object.keys(v.contracts).length);
  if (!entries.length) return null;
  const preferred = ["baseSepolia", "hardhat", "base"];
  for (const key of preferred) {
    if (data[key]?.contracts) return data[key];
  }
  return entries.sort((a, b) => Date.parse(b.deployedAt || 0) - Date.parse(a.deployedAt || 0))[0];
}

async function loadManifest() {
  const paths = [
    "/public/deployments.json",
    "/deployments/baseSepolia.json",
    "/deployments/base-sepolia.json",
    "/deployments/hardhat.json",
  ];
  for (const path of paths) {
    try {
      const data = await loadJson(path);
      const picked = pickManifest(data);
      if (picked) {
        state.manifest = picked;
        break;
      }
    } catch {
      /* try next */
    }
  }
  renderAddresses();
  renderChainGuard();
  await setupReadOnlyContracts();
  await refreshReadOnlyMetrics();
}

async function loadTokenomics() {
  try {
    state.tokenomics = await loadJson("/tokenomics.json").catch(() => loadJson("/shared/tokenomics.json"));
    renderTokenomicsPanel();
    const tge = state.tokenomics?.tge;
    const max = state.tokenomics?.token?.maxSupply;
    if (tge && $("#tgeFloat")) {
      $("#tgeFloat").textContent = `${Number(tge.circulatingTokens).toLocaleString()} WLAB`;
      $("#maxSupplyLabel").textContent = `${Number(max).toLocaleString()} max · ${tge.circulatingPercent}% TGE`;
    }
  } catch {
    if ($("#tokenomicsPanel")) $("#tokenomicsPanel").textContent = "Could not load tokenomics.json";
  }
}

function renderTokenomicsPanel() {
  const panel = $("#tokenomicsPanel");
  if (!panel || !state.tokenomics) return;
  const rows = state.tokenomics.allocations
    .map(
      (a) =>
        `<tr><td>${escapeHtml(a.label)}</td><td>${escapeHtml(a.percent)}%</td><td>${Number(a.tokens).toLocaleString()}</td><td>${escapeHtml(a.tgeUnlock)}</td></tr>`
    )
    .join("");
  panel.innerHTML = `
    <p><strong>Max supply:</strong> ${Number(state.tokenomics.token.maxSupply).toLocaleString()} ${escapeHtml(state.tokenomics.token.symbol)}</p>
    <p><strong>TGE circulating:</strong> ${Number(state.tokenomics.tge.circulatingTokens).toLocaleString()} (${escapeHtml(state.tokenomics.tge.circulatingPercent)}%)</p>
    <p><strong>Staking emissions:</strong> ${Number(state.tokenomics.staking.emissionPoolTokens).toLocaleString()} over ${escapeHtml(state.tokenomics.staking.emissionMonths)} months</p>
    <table><thead><tr><th>Bucket</th><th>%</th><th>WLAB</th><th>TGE</th></tr></thead><tbody>${rows}</tbody></table>
  `;
}

async function setupReadOnlyContracts() {
  const contracts = state.manifest?.contracts;
  if (!contracts?.WLABToken) return;
  const chainId = Number(state.manifest.chainId || 31337);
  const rpc = RPC_BY_CHAIN[chainId];
  if (!rpc) return;
  state.readProvider = new ethers.JsonRpcProvider(rpc);
  state.readContracts.token = new ethers.Contract(contracts.WLABToken, state.abis.WLABToken, state.readProvider);
  if (contracts.WLABTokenSale) {
    state.readContracts.sale = new ethers.Contract(contracts.WLABTokenSale, state.abis.WLABTokenSale, state.readProvider);
  }
}

async function refreshReadOnlyMetrics() {
  const token = state.readContracts.token;
  const sale = state.readContracts.sale;
  if (!token) return;
  try {
    const [supply, obligations] = await Promise.all([
      token.totalSupply(),
      sale ? sale.totalUnclaimedTokens() : Promise.resolve(0n),
    ]);
    if (!state.account && $("#tokenBalance")) {
      $("#tokenBalance").textContent = `${formatToken(supply)} total minted`;
      $("#walletAddress").textContent = "Read-only (connect wallet to transact)";
    }
    if ($("#saleObligations") && obligations !== undefined) {
      $("#saleObligations").textContent = `${formatToken(obligations)} WLAB`;
    }
  } catch {
    /* RPC unavailable */
  }
}

function expectedChainId() {
  const fromManifest = state.manifest?.chainId;
  return fromManifest ? BigInt(fromManifest) : 31337n;
}

function renderChainGuard() {
  const guard = $("#chainGuard");
  if (!guard) return;
  const expected = expectedChainId();
  const connected = state.chainId;
  const mismatch = connected && connected !== expected;
  guard.hidden = !mismatch;
  guard.innerHTML = mismatch
    ? `<p>Switch wallet to <strong>${currentNetworkName(expected)}</strong> (chain ${expected}).</p><button type="button" class="primary-action" id="switchChainBtn">Switch Network</button>`
    : "";
  $("#switchChainBtn")?.addEventListener("click", switchToManifestChain);
}

async function switchToManifestChain() {
  if (!window.ethereum) return;
  const hex = `0x${expectedChainId().toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex }],
    });
  } catch (error) {
    if (error.code === 4902 && Number(expectedChainId()) === 84532) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hex,
          chainName: "Base Sepolia",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://sepolia.base.org"],
          blockExplorerUrls: ["https://sepolia.basescan.org"],
        }],
      });
    } else {
      showAlert(error.message || "Could not switch chain", "error");
    }
  }
}

function parseMerkleProof(raw) {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((p) => (p.startsWith("0x") ? p : `0x${p}`));
}

async function loadAbis() {
  const artifactPaths = {
    WLABToken: "/artifacts/contracts/WLABToken.sol/WLABToken.json",
    WLABTokenSale: "/artifacts/contracts/WLABTokenSale.sol/WLABTokenSale.json",
    WLABStaking: "/artifacts/contracts/WLABStaking.sol/WLABStaking.json",
    WLABLockVault: "/artifacts/contracts/WLABLockVault.sol/WLABLockVault.json",
    WLABGovernor: "/artifacts/contracts/WLABGovernor.sol/WLABGovernor.json",
  };

  await Promise.all(
    Object.entries(artifactPaths).map(async ([name, path]) => {
      const artifact = await loadJson(path);
      state.abis[name] = artifact.abi;
    })
  );
}

function renderAddresses() {
  const list = $("#addressList");
  const contracts = state.manifest?.contracts || {};
  const entries = Object.entries(contracts);
  list.innerHTML = entries.length
    ? entries
        .map(
          ([name, address]) =>
            `<div class="address-row"><strong>${escapeHtml(name)}</strong><code>${escapeHtml(address)}</code></div>`
        )
        .join("")
    : `<div class="alert">No deployed addresses found. Run npm run deploy:local:demo or deploy:sepolia.</div>`;
}

function connectContracts() {
  const contracts = state.manifest?.contracts || {};
  if (!state.signer || !contracts.WLABToken) return;
  state.contracts.token = new ethers.Contract(contracts.WLABToken, state.abis.WLABToken, state.signer);
  state.contracts.sale = new ethers.Contract(contracts.WLABTokenSale, state.abis.WLABTokenSale, state.signer);
  state.contracts.staking = new ethers.Contract(contracts.WLABStaking, state.abis.WLABStaking, state.signer);
  state.contracts.lockVault = new ethers.Contract(contracts.WLABLockVault, state.abis.WLABLockVault, state.signer);
  state.contracts.governor = new ethers.Contract(contracts.WLABGovernor, state.abis.WLABGovernor, state.signer);
}

async function connectWallet() {
  if (!window.ethereum) {
    showAlert("No injected wallet found. Install a wallet or use the static demo view.", "error");
    return;
  }

  state.provider = new ethers.BrowserProvider(window.ethereum);
  await state.provider.send("eth_requestAccounts", []);
  state.signer = await state.provider.getSigner();
  state.account = await state.signer.getAddress();
  const network = await state.provider.getNetwork();
  state.chainId = network.chainId;

  connectContracts();
  renderConnection();
  await refreshState();
}

function renderConnection() {
  const network = $("#networkStatus");
  if (!state.account) {
    network.innerHTML = `<span class="status-dot"></span><span>Wallet not connected</span>`;
    $("#walletAddress").textContent = "No wallet";
    return;
  }
  const expected = expectedChainId();
  const ok = state.chainId === expected;
  network.innerHTML = `<span class="status-dot ${ok ? "ok" : "danger"}"></span><span>${currentNetworkName(state.chainId)} - ${formatAddress(state.account)}</span>`;
  $("#walletAddress").textContent = state.account || "No wallet";
  renderChainGuard();
}

async function refreshState() {
  if (!state.contracts.token && !state.readContracts.token) {
    renderConnection();
    await refreshReadOnlyMetrics();
    return;
  }
  if (!state.account) {
    renderConnection();
    await refreshReadOnlyMetrics();
    return;
  }

  const { token, sale, staking, lockVault, governor } = state.contracts;
  const [balance, votes, obligations, stakeInfo, pending, lockPower, usedGauge, threshold, quorum, delay, period] = await Promise.all([
    token.balanceOf(state.account),
    token.getVotes(state.account),
    sale.totalUnclaimedTokens(),
    staking.stakes(state.account),
    staking.pendingReward(state.account),
    lockVault.totalVotingPower(state.account),
    lockVault.usedGaugeWeight(state.account),
    governor.proposalThreshold(),
    governor.quorumNumerator(),
    governor.votingDelay(),
    governor.votingPeriod(),
  ]);

  $("#tokenBalance").textContent = `${formatToken(balance)} WLAB`;
  $("#votePower").textContent = `${formatToken(votes)} WLAB`;
  $("#saleObligations").textContent = `${formatToken(obligations)} WLAB`;
  $("#stakeAmount").textContent = `${formatToken(stakeInfo.amount)} WLAB`;
  $("#stakeWeight").textContent = formatToken(stakeInfo.weight);
  $("#pendingReward").textContent = `${formatToken(pending)} WLAB`;
  $("#lockEnd").textContent = Number(stakeInfo.lockEnd) ? new Date(Number(stakeInfo.lockEnd) * 1000).toLocaleString() : "-";
  $("#lockPower").textContent = formatToken(lockPower);
  $("#usedGaugeWeight").textContent = formatToken(usedGauge);
  $("#proposalThreshold").textContent = `${formatToken(threshold)} WLAB`;
  $("#quorumNumerator").textContent = `${quorum}%`;
  $("#votingDelay").textContent = `${delay} blocks`;
  $("#votingPeriod").textContent = `${period} blocks`;
}

async function sendTx(label, action) {
  try {
    if (!state.signer) throw new Error("Connect wallet first.");
    showAlert(`${label}: waiting for wallet signature...`);
    const tx = await action();
    showAlert(`${label}: submitted ${tx.hash}`);
    await tx.wait();
    showAlert(`${label}: confirmed`, "success");
    await refreshState();
  } catch (error) {
    showAlert(`${label}: ${error.shortMessage || error.reason || error.message}`, "error");
  }
}

async function approveIfNeeded(spender, amount) {
  const allowance = await state.contracts.token.allowance(state.account, spender);
  if (allowance >= amount) return;
  const tx = await state.contracts.token.approve(spender, amount);
  await tx.wait();
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function bindForms() {
  $$(".tx-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = formData(form);
      const action = form.dataset.action;

      if (action === "buy") {
        await sendTx("Buy tokens", async () => {
          const phase = await state.contracts.sale.currentPhase();
          if (Number(phase) !== Number(data.phase)) showAlert("Selected phase differs from active sale phase.", "error");
          const cfg = await state.contracts.sale.phases(data.phase);
          const amount = parseToken(data.amount);
          const value = (amount * cfg.priceWeiPerToken) / ethers.parseEther("1");
          const proof = parseMerkleProof(data.merkleProof);
          return state.contracts.sale.buy(amount, proof, { value });
        });
      }

      if (action === "claim") {
        await sendTx("Claim tokens", () => state.contracts.sale.claim(data.phase));
      }

      if (action === "refund") {
        await sendTx("Request refund", () => state.contracts.sale.refund(data.phase));
      }

      if (action === "stake") {
        await sendTx("Stake WLAB", async () => {
          const amount = parseToken(data.amount);
          await approveIfNeeded(await state.contracts.staking.getAddress(), amount);
          return state.contracts.staking.stake(amount, data.tier, Boolean(data.compound));
        });
      }

      if (action === "unstake") {
        await sendTx("Unstake WLAB", () => state.contracts.staking.unstake(parseToken(data.amount)));
      }

      if (action === "createLock") {
        await sendTx("Create governance lock", async () => {
          const amount = parseToken(data.amount);
          await approveIfNeeded(await state.contracts.lockVault.getAddress(), amount);
          return state.contracts.lockVault.createLock(amount, data.duration);
        });
      }

      if (action === "voteGauge") {
        await sendTx("Set gauge weight", () =>
          state.contracts.lockVault.voteGauge(data.gaugeId, parseToken(data.weight))
        );
      }

      if (action === "configurePhase") {
        await sendTx("Configure sale phase", () =>
          state.contracts.sale.configurePhase(
            data.phase,
            ethers.parseEther(data.price),
            parseToken(data.allocation),
            ethers.parseEther(data.hardCap),
            ethers.parseEther(data.softCap),
            ethers.ZeroHash,
            data.maxPerWallet ? parseToken(data.maxPerWallet) : 0n
          )
        );
      }
    });
  });

  $$("[data-action-button]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.actionButton;
      if (action === "claimReward") await sendTx("Claim rewards", () => state.contracts.staking.claimReward());
      if (action === "emergencyUnstake") await sendTx("Emergency withdraw", () => state.contracts.staking.emergencyUnstake());
      if (action === "startPublicPhase") await sendTx("Start public phase", () => state.contracts.sale.startPhase(PHASE.Public));
      if (action === "finalizeSale") await sendTx("Finalize sale", () => state.contracts.sale.finalizeSale());
      if (action === "delegateSelf") await sendTx("Delegate votes", () => state.contracts.token.delegate(state.account));
      if (action === "withdrawFunds") await sendTx("Withdraw funds", () => state.contracts.sale.withdrawFunds(state.account));
      if (action === "recoverUnsold") await sendTx("Recover unsold tokens", () => state.contracts.sale.recoverUnsoldTokens(state.account));
    });
  });
}

function drawAllocationChart() {
  const canvas = $("#allocationCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "14px Inter, sans-serif";
  ctx.textBaseline = "middle";

  let x = 22;
  const maxHeight = 210;
  SUPPLY.forEach(([label, pct, color], index) => {
    const height = (pct / 24) * maxHeight;
    const y = 260 - height;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 38, height);
    ctx.fillStyle = "#1f2523";
    ctx.fillText(`${pct}%`, x, y - 14);
    ctx.save();
    ctx.translate(x + 8, 284);
    ctx.rotate(-Math.PI / 7);
    ctx.fillStyle = "#69736e";
    ctx.fillText(label, 0, 0);
    ctx.restore();
    x += 58;
  });

  $("#allocationLegend").innerHTML = SUPPLY.map(
    ([label, pct, color]) =>
      `<div class="legend-item"><span class="legend-swatch" style="background:${escapeHtml(color)}"></span><span>${escapeHtml(label)} - ${escapeHtml(pct)}%</span></div>`
  ).join("");
}

function bindNavigation() {
  $$(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".nav-button").forEach((item) => item.classList.remove("active"));
      $$(".view").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.view}`).classList.add("active");
    });
  });
}

async function init() {
  bindNavigation();
  bindForms();
  drawAllocationChart();
  $("#connectWallet").addEventListener("click", connectWallet);
  $("#refreshState")?.addEventListener("click", refreshState);
  const delegateBtn = $("#delegateSelfBtn") || $("#delegateSelf");
  delegateBtn?.addEventListener("click", () =>
    sendTx("Delegate to self", () => state.contracts.token.delegate(state.account))
  );
  await loadAbis();
  await loadTokenomics();
  await loadManifest();
  renderConnection();

  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", () => window.location.reload());
    window.ethereum.on?.("chainChanged", () => window.location.reload());
  } else {
    showAlert("Static demo loaded. Connect an injected wallet to execute protocol transactions.");
  }
}

init().catch((error) => showAlert(error.message, "error"));
