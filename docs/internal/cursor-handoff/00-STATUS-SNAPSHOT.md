# WhiteLab — Cursor Agent Handoff (2026-05-30)

**Repo:** `vantablack-git/white-lab-ltd`  
**Branch:** `main`  
**Status:** testnet candidate · audit pending · mainnet blocked

---

## Executive Summary

WhiteLab Launch OS is a Base-native monorepo: 8 Solidity contracts, 192 regression tests, 95.45% branch coverage, Slither CI gate, static marketing site + protocol console, deploy/handover scripts with multisig enforcement.

The 30-phase internal roadmap (Phases 0–30) is **addressed in code/docs**. The only operator-blocked item is **Phase 15 — live Base Sepolia deploy** (requires `.env` credentials).

---

## Verification Snapshot (2026-05-30)

| Check | Result |
| --- | --- |
| `npm test` | **192 passing** |
| `npm run coverage` | **95.45% branch**, 99.35% lines |
| `npm run e2e:local` | PASSED |
| `npm run build:site` | PASSED → `dist/` |
| Slither | CI high-severity gate (`.github/workflows/ci.yml`) |
| Base Sepolia deploy | **NOT executed** — template manifest only |

---

## Architecture (Locked — DEC-001..009)

```
┌─────────────────────────────────────────────────────────────┐
│                     WhiteLab Launch OS                       │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ WLABToken    │ WLABTokenSale│ WLABVesting  │ WLABStaking    │
│ ERC20+Votes  │ Multi-phase  │ Cliff+linear │ Tiered rewards │
│ Fee+compliance│ IDO+refund  │ Revoke       │ Funded programs│
├──────────────┴──────────────┴──────────────┴────────────────┤
│ WLABLockVault (fixed-weight gov lock) │ WLABGovernor+TL   │
├───────────────────────────────────────┴───────────────────┤
│ WLABTreasuryUUPS (proxy) │ WLABOFTAdapter (disabled stub)  │
└─────────────────────────────────────────────────────────────┘
         Base L2 (84532 Sepolia / 8453 Mainnet)
```

**Deploy policy:** Production networks require `MULTISIG_ADDRESS ≠ deployer`. Handover revokes all deployer authority. OFT stub gated off Base mainnet unless `DEPLOY_OFT=true`.

---

## Surfaces

| Path | Role |
| --- | --- |
| `/` | Marketing — hero, tokenomics, registry, SEO/OG |
| `/app` | Protocol console — wallet, IDO, staking, lock vault, governance |
| `/whitepaper` | Typeset whitepaper v1.0 |
| `/legal` | Risk disclaimers |
| `/tr/` | Turkish landing |

**Cloudflare Pages:** Build command `npm run build:site`, output `dist/`. Push to `main` triggers deploy when GitHub is connected.

---

## Mainnet Blockers (unchanged)

1. External smart contract audit + remediation
2. Phase 15 live Base Sepolia rehearsal with real Safe
3. Public bug bounty post-audit
4. Legal/compliance review
5. Liquidity + market-making plan
6. Real LayerZero OFT v2 (stub is demo-only)

---

## Operator Next Steps (Phase 15)

```bash
cp .env.example .env
# Fill: PRIVATE_KEY, BASE_SEPOLIA_RPC, ETHERSCAN_API_KEY,
#      TREASURY_ADDRESS, MULTISIG_ADDRESS (Gnosis Safe, ≠ deployer)

npm run env:check
npm run deploy:sepolia
npm run verify
npm run build:site   # refresh manifest on site → Cloudflare redeploy
```

See: `docs/internal/BASE-SEPOLIA-REHEARSAL.md`, `docs/tr/SENIN-ADIMLAR.md`

---

## Agent Rules

- Preserve DEC-001..009. Do not change governance/tokenomics fundamentals without explicit user approval.
- Every change: `npm run validate` (compile + test + e2e) before commit.
- Mainnet deploy only after audit closeout + Phase 15 rehearsal evidence.
- Public copy must stay calibrated: "testnet candidate, audit pending, mainnet blocked".

---

## Key Files

| File | Purpose |
| --- | --- |
| `docs/internal/ROADMAP-30.md` | 30-phase status table |
| `docs/13-threat-model.md` | Threat model V2 |
| `docs/pre-mainnet-checklist.md` | Launch gates |
| `docs/audit-prep.md` | Audit package |
| `scripts/deploy.js` | Canonical deploy + auto-handover |
| `scripts/handover-multisig.js` | Standalone handover ceremony |
| `shared/tokenomics.json` | Canonical tokenomics data |
