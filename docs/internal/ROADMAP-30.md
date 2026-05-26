# White Lab — 30-Phase Roadmap

Internal roadmap from RC-1 close to mainnet-grade release. Each phase is a single, atomic, reviewable change. No phase ships without verification artifacts. No phase widens scope into the next.

Numbering continues from the Phase 0–6 + RC-1 work already in `git log`.

## Track A — Contract & Security Maturity

**Phase 7 — Slither in CI**
Integrate Slither into GitHub Actions, persist the report, fail CI on Critical/High.

**Phase 8 — Branch coverage uplift: WLABToken**
Adversarial branch tests for fee, compliance, blacklist, max-wallet, snapshot. Target: 80%+ branches.

**Phase 9 — Branch coverage uplift: WLABTokenSale**
Tests for hard-cap edge, allocation overflow, ETH refund failure, Merkle proof negative paths.

**Phase 10 — Branch coverage uplift: WLABVesting**
Cliff edge timestamps, post-revoke release attempts, multi-token recovery edge cases.

**Phase 11 — Governor lifecycle adversarial tests**
Defeat, late-quorum, cancel, queue-after-snapshot, execution payload mismatch.

**Phase 12 — Gas report and budget**
hardhat-gas-reporter against happy paths; published gas budget per critical function in `docs/gas-budget.md`.

**Phase 13 — Formal threat model V2**
Per-actor abuse paths, per-contract invariants, mitigations linked to tests. Replaces the current minimal `13-threat-model.md`.

**Phase 14 — External audit prep package**
Frozen commit hash, scoped contract list, threat model, ADRs, deployment policy, known limitations, written by-name questions for auditors.

## Track B — Operational Rehearsal

**Phase 15 — Base Sepolia rehearsal deploy**
Real Safe address, real deployer EOA, full deploy + auto-handover, residual-authority audit.

**Phase 16 — Etherscan verification ceremony**
Verify all contracts on Basescan, including the production-named proxy. Document the ceremony.

**Phase 17 — Manifest publication pipeline**
`deployments/baseSepolia.json` cryptographically signed by the deployer, mirrored to `public/deployments.json`, surfaced on the live site’s registry.

**Phase 18 — Operations runbook V2**
Deployment, upgrade, emergency, fee-switch, pause, blacklist, incident timeline. Each step linked to a transaction template.

## Track C — Surface (premium black/white animated)

**Phase 19 — Design tokens & motion language**
Codified token system: spacing scale, type scale, easing curves, motion durations, reduced-motion behavior. Lives in `docs/adr/0005-design-system.md` + a CSS tokens file.

**Phase 20 — Marketing site refactor pass**
Section-by-section premium pass: hero, architecture, tokenomics, transparency, CTA. Each one cinematic but calm.

**Phase 21 — Console refactor pass**
Console aligned to the same design tokens; quieter, denser, audit-friendly.

**Phase 22 — Live address registry UI**
Manifest-driven contract list on the site with copy-to-clipboard, Basescan deep-links, network badge.

**Phase 23 — Tokenomics dashboard**
Interactive, accurate, monochrome chart with hover state and accessible keyboard nav. Driven by `shared/tokenomics.json`.

**Phase 24 — Motion polish + reduced motion**
Subtle scroll-driven reveals, no parallax overload, full `prefers-reduced-motion` parity.

## Track D — Brand, Trust, and Communication

**Phase 25 — Whitepaper V1.0 typeset**
Long-form whitepaper rebuilt as a static page with table of contents, footnotes, and stable anchors.

**Phase 26 — Voice & wordmark refinement (no logo)**
Refines the thin italic “White Lab” wordmark, defines voice rules (calibrated, not promotional), captures it in an ADR.

**Phase 27 — SEO, OG, structured metadata**
Per-page titles, descriptions, Open Graph cards (monochrome), JSON-LD for the Organization.

**Phase 28 — Localization V1**
Canonical English. Turkish under `/tr/` rebuilt as a real translation, not legacy guidance. Translation guidelines documented.

## Track E — Launch readiness

**Phase 29 — Pre-mainnet checklist hardening**
Audit closeout, bug bounty live, OFT decision (replace or remove), liquidity plan, legal sign-off, multisig signers verified, delegated voting tests on mainnet fork.

**Phase 30 — Mainnet release candidate**
RC-2 validation pass, frozen commit, Safe-orchestrated deploy plan, post-deploy verification matrix, public announcement plan, post-launch monitoring runbook.

## Operating Rules

- One phase per session. No skipping ahead.
- No phase ships without: code change + test/verification + commit + short summary.
- The user types `devam` or `continue`; the agent runs the next pending phase end-to-end.
- If a phase grows beyond a single coherent change, it is split, not crammed.
- Mainnet is touched in Phase 30 only. Anything before that is testnet or local.

## Status

| Phase | State |
| --- | --- |
| 0–6 + RC-1 | done |
| 7 | done — Slither in CI with high-severity gate, SARIF + JSON artifacts |
| 8 | done — WLABToken branches 43.33% → 96.67%, 18 new adversarial tests |
| 9 | done — WLABTokenSale branches 61.11% → 89.68% incl. ERC20 payment path |
| 10 | done — WLABVesting branches 60.87% → 93.48%, exact cliff/revoke/emergency edges |
| 11–30 | pending |
