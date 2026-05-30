# WhiteLab — Launch Completion Research (2026-05-30)

Status: **testnet presentation-ready** · mainnet blocked on operator + audit gates

This document consolidates project research for handoff. Notion MCP was unavailable (auth required); this file is the canonical in-repo equivalent.

---

## 1. What is complete (code + surfaces)

| Area | Evidence | Verification |
| --- | --- | --- |
| Smart contracts (8) | `contracts/*.sol` | `npm test` → 192 passing |
| Branch coverage | Production contracts ≥93% each | `npm run coverage` → 95.45% |
| Deploy policy | Multisig required on Base networks | `test/DeploymentPolicy.test.js` |
| Admin handover | Residual authority stripped | `scripts/handover-multisig.js` + tests |
| Static site | Marketing, TR, whitepaper, legal | `npm run build:site` → `dist/` |
| Protocol console | `/app` wallet + IDO + staking + gov | `npm run e2e:local` |
| CI | Test + coverage + Slither gate | `.github/workflows/ci.yml` |
| Mobile/tablet UX | Responsive breakpoints + mobile nav | 900px / 680px media queries |
| SEO / OG | Meta tags + `public/og-card.svg` | All public HTML pages |
| Documentation | 30-phase roadmap addressed | `docs/internal/ROADMAP-30.md` |

---

## 2. What remains operator-blocked

These cannot be closed from code alone:

| Gate | Owner | Action |
| --- | --- | --- |
| Base Sepolia live deploy | Operator | Fill `.env`, create Safe, run `npm run deploy:sepolia` |
| Basescan verify | Operator | `npm run verify` after deploy |
| External audit | Security vendor | Engage Tier-1 firm using `docs/audit-prep.md` |
| Bug bounty | Ops | Immunefi post-audit |
| Legal opinion | Counsel | Jurisdiction-specific review |
| Gnosis Safe signers | Team | 3-of-5 verified out-of-band |
| Custom domain | Ops | Cloudflare DNS → Pages project |

---

## 3. Deployment architecture

```
Developer / Cursor Agent
        │
        ▼
   GitHub (white-lab-ltd)
        │
        ├──► Cloudflare Pages (auto on main merge)
        │         build: npm run build:site
        │         output: dist/
        │
        └──► GitHub Actions CI
                  test + coverage + Slither

Operator (separate path)
        │
        ▼
   Hardhat deploy → Base Sepolia
        │
        ▼
   deployments/base-sepolia.json → public/deployments.json → site registry
```

**Note:** Monk.io / MonDeployer are **not** part of this stack. WhiteLab uses Hardhat + Cloudflare Pages.

---

## 4. Cloudflare Pages setup (production surface)

| Setting | Value |
| --- | --- |
| Repository | `vantablack-git/white-lab-ltd` |
| Production branch | `main` |
| Build command | `npm run build:site` |
| Build output | `dist` |
| Node version | `20` |

After merge to `main`, Pages rebuilds automatically. No Monk or third-party deployer required.

---

## 5. Cursor Cloud Agent ↔ GitHub

Already connected in this environment. Workflow:

1. User assigns task in Cursor Cloud Agent
2. Agent creates branch `cursor/<name>-835b`, commits, pushes, opens PR
3. User merges PR → `main` → Cloudflare deploy

Required user setup (one-time):

- Cursor Settings → Integrations → GitHub → grant read/write on `white-lab-ltd`
- Cloudflare Pages → Connect GitHub → same repo

---

## 6. Presentation checklist (mobile / web / tablet)

| Device | Marketing `/` | Console `/app` |
| --- | --- | --- |
| Desktop | Full grid + hero visual | Sidebar + workspace |
| Tablet (≤900px) | Single column, hamburger nav | Sidebar stacks, 2-col metrics |
| Phone (≤620px) | Hero visual hidden, stacked stats | Collapsible nav, 44px touch targets |

Test after deploy:

- iPhone Safari: `/`, `/tr/`, `/app`, `/whitepaper/`
- Android Chrome: wallet connect on `/app`
- iPad: tokenomics donut + allocation chart

---

## 7. Recommended post-merge operator sequence

```bash
# 1. Merge PR to main → wait for Cloudflare deploy

# 2. Base Sepolia (when ready)
cp .env.example .env
npm run env:check
npm run deploy:sepolia
npm run verify
npm run build:site
git add deployments/ public/deployments.json
git commit -m "ops: publish Base Sepolia manifest"
git push

# 3. Audit engagement
# Send docs/audit-prep.md + frozen commit hash to auditor
```

---

## 8. Strategic notes

- **Economics:** 3M WLAB/month staking emission vs 88.5M TGE float = high early pressure; buyback + locks must absorb supply.
- **Governance:** 4% quorum on full supply = concentration risk early; multisig-first is correct.
- **Bridge:** OFT stub must stay disabled until LayerZero v2 audit.
- **Public language:** Always "testnet candidate, audit pending" — never "mainnet-ready".

---

## 9. Related documents

- Operator steps (TR): `docs/tr/SENIN-ADIMLAR.md`
- Agent handoff: `docs/internal/cursor-handoff/00-STATUS-SNAPSHOT.md`
- Pre-mainnet gates: `docs/pre-mainnet-checklist.md`
- Phase 15 rehearsal: `docs/internal/BASE-SEPOLIA-REHEARSAL.md`
