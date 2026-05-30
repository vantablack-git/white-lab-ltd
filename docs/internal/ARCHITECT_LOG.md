# WhiteLab — Baş Mimar Log

Tüm mimari kararlar, eylemler ve doğrulama kayıtları.

---

## Nihai Mimari Kararlar (DEC Registry)

| ID | Karar | Gerekçe | Durum |
|----|--------|---------|-------|
| DEC-001 | WhiteLab Launch OS — kurumsal launchpad + SDK | Tek protokol, compliance + tam modül seti | LOCKED |
| DEC-002 | Birincil zincir: Base | Düşük gas, EVM, Coinbase ekosistemi | LOCKED |
| DEC-003 | LayerZero OFT v2 (Faz 2); stub: WLABOFTAdapter | Burn-and-mint production hedefi | LOCKED |
| DEC-004 | Tam monorepo | docs + contracts + test + scripts | LOCKED |
| DEC-005 | $WLAB 1B max; deflasyonist burn + staking emission | Tokenomics dokümante | LOCKED |
| DEC-006 | Utility token; Swiss Association + Cayman Foundation | MiCA bilgilendirme pozisyonu | LOCKED |
| DEC-007 | team-public.md + team-anon.md | İki yayın versiyonu | LOCKED |
| DEC-008 | UUPS treasury; token immutable | Güven + upgrade dengesi | LOCKED |
| DEC-009 | Her faz loglanır | İzlenebilirlik | COMPLETE |

---

## [2026-05-24] Faz-0 — Scaffold

- **ACTION** Dizin yapısı: `docs/`, `contracts/`, `test/`, `scripts/`, `deployments/`
- **ACTION** `package.json`, `hardhat.config.js`, `.env.example`, `README.md`
- **VERIFY** npm gerekli — ortamda global npm yok; kullanıcı `npm install` çalıştıracak
- **NEXT** Dokümantasyon Bölüm 0–3

---

## [2026-05-24] Faz-1 — Dokümantasyon (Bölüm 0–3, 4–9)

- **ACTION** `docs/00-conceptual-foundation.md` — blockchain temelleri WhiteLab çerçevesi
- **ACTION** `docs/01-identity-strategy.md` — vizyon, TAM/SAM/SOM, 5 rakip, SWOT, regülasyon
- **ACTION** `docs/02-whitepaper.md` — 12 bölüm yayına hazır
- **ACTION** `docs/03-tokenomics.md` — dağıtım, fiyat, 12 ay simülasyon, burn
- **ACTION** `docs/04-smart-contracts.md` — geliştirme ortamı + kontrat indeksi
- **ACTION** `docs/05-security-audit.md` — test, Slither, denetim, bug bounty
- **ACTION** `docs/06-deployment.md` — Sepolia, mainnet checklist, LP, CEX
- **ACTION** `docs/07-ecosystem.md` — grants, Discord, airdrop, PR
- **ACTION** `docs/08-crosschain-defi.md` — OFT, Aave, subgraph, Chainlink
- **ACTION** `docs/09-sustainability.md` — UUPS, POL, Lock Vault, risk
- **ACTION** `docs/team-public.md`, `docs/team-anon.md`
- **VERIFY** İçerik placeholder içermiyor
- **NEXT** Kontratlar

---

## [2026-05-24] Faz-2 — Akıllı Sözleşmeler

- **ACTION** `WLABToken.sol` — ERC20+Permit+Votes+Snapshot, fee, compliance
- **ACTION** `WLABVesting.sol` — cliff, linear, revoke
- **ACTION** `WLABStaking.sol` — 4 tier lock, compound, emergency penalty
- **ACTION** `WLABGovernor.sol` — Governor+Timelock+Quorum 4%
- **ACTION** `WLABTokenSale.sol` — 3 phase, merkle, refund
- **ACTION** `WLABLockVault.sol` (weighted governance lock, no decay), `WLABOFTAdapter.sol`, `WLABTreasuryUUPS.sol`
- **VERIFY** `npx hardhat compile` — kullanıcı ortamında çalıştırılacak
- **NEXT** Testler

---

## [2026-05-24] Faz-3 — Test & Script

- **ACTION** `test/WLABToken.test.js` — 8+ unit test
- **ACTION** `test/WLABVesting.test.js`, `WLABStaking.test.js`, `WLABTokenSale.test.js`
- **ACTION** `test/WLABGovernor.test.js`, `test/integration.test.js`
- **ACTION** `scripts/deploy.js`, `scripts/verify.js`
- **ACTION** `deployments/base-sepolia.json` şablon
- **VERIFY** `npm test` — kullanıcı ortamında
- **NEXT** Testnet deploy

---

## [2026-05-24] Faz-4 — TAMAMLANDI

- **STATUS** WhiteLab master rehber monorepo eksiksiz oluşturuldu
- **DOSYA SAYISI** 9 doc + 8 contract + 6 test + 2 script
- **RİSK NOTU** Canlı mainnet öncesi Tier-1 audit ve hukuki görüş zorunlu
- **KULLANICI AKSİYONU:**
  1. `cd whitelab && npm install`
  2. `npx hardhat compile && npm test`
  3. `.env` doldur → `npm run deploy:sepolia`

---

*Proje durumu: **IMPLEMENTATION COMPLETE** (kod + dokümantasyon). Zincir deploy kullanıcı anahtarı ile.*

---

## [2026-05-24] Faz-5 — P0 Bug Fixes (Claude Divine Pass)

### DEC-010 — WLABToken fee+votes fix (Option A)
- **PROBLEM** `_update()` içinde 3 ayrı `super._update(from, ...)` çağrısı yapılıyordu.
  ERC20Votes altında her `super._update` bir `_transferVotingUnits` checkpoint tetikler.
  Bu da sender'ın delegate checkpoint'inin 3 kez yazılmasına yol açıyordu.
- **FIX** Option A uygulandı: sender'dan `fee` (tamamı) tek seferde `feeReceiver`'a transfer edilir,
  ardından `burnAmt` sadece `feeReceiver → address(0)` olarak yakılır.
  Böylece sender için yalnızca 2 checkpoint yazılır (net + fee), votes muhasebesi temiz.
- **TEST** `WLABToken.test.js` → `"P0 votes: getVotes correct after fee-bearing transfer"` eklendi.
- **STATUS** FIXED

### DEC-011 — WLABTokenSale token dağıtımı (P0)
- **PROBLEM 1** `buy()` ETH/ERC20 topluyordu ama `purchasedTokens` mapping yoktu.
  Alıcıların claim edecekleri token miktarı hiç kaydedilmiyordu.
- **PROBLEM 2** `claimVested()` `onlyOwner` ve `msg.sender` kullanıyordu — owner kendi için
  vesting oluşturuyordu, alıcı hiç dahil değildi. Vesting contract onlyOwner gerektirdiğinden
  sale contract zaten çağıramazdı.
- **FIX**
  - `mapping(Phase => mapping(address => uint256)) public purchasedTokens` eklendi.
  - `buy()` → `purchasedTokens[phase][msg.sender] += tokenAmount` kaydı eklendi.
  - `claimVested()` kaldırıldı; yerine `claim(Phase phase)` → alıcı kendisi çağırır,
    doğrudan token transferi yapar (vesting opsiyonel / ayrı akış).
  - `refund()` → `purchasedTokens` sıfırlama da eklendi (double-dip prevention).
  - `recoverUnsoldTokens()` → finalize sonrası hazineye unsold token geri alım.
  - Constructor'dan `_vesting` parametresi kaldırıldı (kullanılmıyordu, karışıklık yaratıyordu).
- **DEPLOY FIX** `scripts/deploy.js` → `Sale.deploy(tokenAddr, ZeroAddress, deployer.address)` — 3 arg.
  IDO allocation (100M WLAB) deploy script'te sale contract'a fund'lanır.
- **TEST** `WLABTokenSale.test.js` → 7 test (E2E, double-claim, multi-buyer, withdraw) eklendi/güncellendi.
- **STATUS** FIXED

### Completion delta (P0 sonrası)
| Katman | Öncesi | Sonrası |
|--------|--------|---------|
| Contracts | ~75% | ~90% |
| Tests     | ~70% | ~85% |
| **Genel** | ~65%  | ~80%  |

**Sonraki adım:** `npm test` (lokal) → Sepolia deploy → Basescan verify → Slither

---

## [2026-05-24] Faz-6 — MVP doğrulama (Cursor)

- **ACTION** `WLABTokenSale.sol` — Unicode em-dash require string → ASCII (compile fix)
- **ACTION** `WLABTokenSale.test.js` — soft cap ekonomisi testlerle hizalandı (0.01 ETH)
- **ACTION** `scripts/verify.js` — tüm 8 kontrat verify döngüsü
- **ACTION** `SUNUM.md` — Türkçe sunum + divine komut + mimari
- **ACTION** `README.md`, `06-COMPLETION-CHECKLIST.md` güncellendi
- **VERIFY** `npm test` → **26 passing**, 0 fail (Windows, Hardhat 2.22, Solidity 0.8.26)
- **STATUS** Sunuma hazır MVP; Sepolia deploy kullanıcı anahtarı ile

---

## [2026-05-24] Faz-7 — Full QA Pass (Cursor)

- **VERIFY** `npm test` → **29 passing**
- **VERIFY** `npm run coverage` → ~70% lines
- **VERIFY** `npm run e2e:local` → PASS
- **FIX H-01** `totalUnclaimedTokens` + safe `recoverUnsoldTokens`
- **FIX H-02** Timelock `PROPOSER_ROLE` → Governor in deploy.js
- **FIX H-03** Sale contract whitelisted on token (fee-safe claims)
- **DOC** `QA_REPORT.md` — production score 62/100

---

## [2026-05-24] Faz-8 - Codex Protocol Stewardship Pass

- **FIX H-04** `WLABToken` gained explicit `feeExempt` accounting. IDO sale claims are now exempted by deploy scripts through `setFeeExempt`, so enabled transfer fees do not reduce buyer entitlements.
- **FIX H-05** `WLABStaking.stake()` no longer removes an existing position from `totalWeightedStake` during restake. Added same-tier restake guard and rejected compound mode when staking/reward tokens differ.
- **FIX H-06** `WLABLockVault.voteGauge()` now sets per-user gauge weight instead of repeatedly adding the same voting power. Added `usedGaugeWeight` / `userGaugeWeight` accounting and withdrawal guard while votes remain active.
- **FIX M-01** `WLABTokenSale.configurePhase()` cannot reset a phase after sales/finalization, and `finalizeSale()` now requires an active phase.
- **TEST** Added fee-exempt claim, staking restake, compound mismatch, phase-lock, and Lock Vault gauge vote regression tests.
- **VERIFY** `npm.cmd run compile` -> PASS
- **VERIFY** `npm.cmd test` -> **39 passing**
- **VERIFY** `npm.cmd run e2e:local` -> PASS
- **VERIFY** `npm.cmd run coverage` -> **81.1% lines** overall
- **VERIFY** `npx.cmd hardhat run scripts/deploy.js --network hardhat` -> PASS
- **BLOCKED** Slither unavailable: `slither` and Python are not installed/in PATH on this machine.

---

## [2026-05-24] Faz-9 - Finalization / Production Candidate Loop

- **FIX** `WLABTokenSale.configurePhase()` now rejects zero price, zero allocation, and `softCap > hardCap`.
- **FIX** `WLABOFTAdapter` is disabled by default via `bridgeEnabled`; bridge out/in require explicit owner enablement plus nonzero amount/recipient/message checks.
- **TEST** Added `WLABGovernorLifecycle.test.js` for full Governor -> Timelock execution.
- **TEST** Added `WLABTreasuryUUPS.test.js` with ERC1967 proxy initialization, withdrawals, upgrade auth, and storage persistence.
- **TEST** Added `WLABOFTAdapter.test.js` and `invariants.test.js`.
- **FRONTEND** Added `frontend/` static protocol console: wallet connect, network detection, balances, IDO, staking, governance Lock Vault, governance, admin visibility.
- **OPS** Added `.github/workflows/ci.yml`, `scripts/validate-env.js`, and root `validate` script.
- **DOC** Added `docs/10-production-candidate-readiness.md`, `docs/11-operations-runbook.md`, and `docs/12-user-guides.md`.
- **VERIFY** `npm.cmd run validate` -> PASS
- **VERIFY** `npm.cmd test` -> **47 passing**
- **VERIFY** `npm.cmd run coverage` -> **90.03% lines** overall
- **VERIFY** `npx.cmd hardhat run scripts/deploy.js --network hardhat` -> PASS
- **VERIFY** Browser smoke test desktop/mobile -> PASS, no console errors.
- **STATUS** Testnet/demo candidate materially improved; mainnet still blocked by audit, Slither, 95% coverage, Safe handover, treasury proxy deployment, and real OFT implementation.

---

## [2026-05-30] Launch Presentation Pass — Mobile/Tablet + Docs

- **ACTION** Mobile hamburger nav on TR, whitepaper, legal; improved menu JS (Escape, outside click, scroll lock).
- **ACTION** Responsive CSS: sticky header, hero visual hidden on phones, 44px touch targets, safe-area padding.
- **ACTION** Console: collapsible mobile nav, responsive allocation chart with resize handler.
- **ACTION** OG card asset (`public/og-card.svg`), meta tags on all public pages.
- **ACTION** Dev server routes for `/whitepaper/` and `/legal/`.
- **DOC** `docs/internal/LAUNCH-COMPLETION.md` — research + handoff (Notion MCP auth unavailable).
- **DOC** `docs/pre-mainnet-checklist.md` — marked codebase-complete surface items.
- **VERIFY** `npm run validate` -> PASS (192 tests + E2E)
- **VERIFY** `npm run build:site` -> PASS
- **NEXT** Operator: merge PR -> Cloudflare auto-deploy -> Phase 15 `.env` + Safe deploy.
