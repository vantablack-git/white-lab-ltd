# Pre-Mainnet Checklist

Mainnet remains blocked until every item below is closed with evidence.

## Security

- [ ] External smart contract audit completed and remediated
- [ ] Public bug bounty live post-audit
- [ ] Latest Slither SARIF/JSON archived from CI (download from GitHub Actions artifacts)
- [x] Threat model V2 reviewed against final code (`docs/13-threat-model.md`)
- [x] Audit prep package frozen to a single commit hash (`docs/audit-prep.md` — update hash at release tag)

## Operations

- [ ] Base Sepolia rehearsal with real Safe/multisig completed (`docs/internal/BASE-SEPOLIA-REHEARSAL.md`)
- [ ] Residual deployer authority audit passed on-chain
- [ ] All contracts verified on Basescan
- [x] Signed or checksum-published manifest pipeline (`scripts/publish-manifest.js` + site registry)
- [x] Operations runbook V2 ceremony documented (`docs/11-operations-runbook.md`)

## Product / Surface

- [x] Address registry shows manifest with copy + explorer links (live addresses after Phase 15 deploy)
- [ ] Console chain guard tested on Base Sepolia (requires live deploy)
- [x] Tokenomics dashboard driven by `shared/tokenomics.json`
- [x] Turkish `/tr/` page reviewed for calibrated claims
- [x] SEO/OG metadata present on public pages (`public/og-card.svg`)

## Governance / Economics

- [ ] Safe signer set verified out-of-band
- [x] Token concentration and quorum sensitivity disclosed (`docs/10-production-candidate-readiness.md`)
- [x] Bridge decision finalized: OFT stub disabled on mainnet; real LayerZero v2 is Phase 2
- [ ] Liquidity and market-making plan approved outside codebase

## Legal / Comms

- [ ] Legal/compliance review for sale participation
- [ ] Public status channel and incident contacts defined
- [x] No "audit-ready" or "mainnet-ready" language in public copy (legal + site disclaimers)

## Presentation readiness (testnet demo)

- [x] Mobile hamburger navigation on all marketing pages
- [x] Tablet + phone responsive layouts (site + console)
- [x] Cloudflare Pages static build (`npm run build:site` → `dist/`)
- [x] Local dev routes for `/whitepaper/` and `/legal/`

See also: `docs/internal/LAUNCH-COMPLETION.md`
