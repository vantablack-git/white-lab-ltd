# Repository Structure Map

This document records the Phase 4 repository discipline migration. The goal is a root that exposes source-of-truth project surfaces only: contracts, tests, deploy scripts, frontend, website, shared assets, docs, deployments, and build config.

## Canonical Roots

| Path | Purpose |
| --- | --- |
| `contracts/` | Solidity contracts, including production proxy wrappers under `contracts/proxy/` and test-only upgrade fixtures under `contracts/test/`. |
| `test/` | Hardhat unit, integration, lifecycle, and invariant tests. |
| `scripts/` | Deployment, verification, local E2E, environment checks, and operator scripts. |
| `frontend/` | Protocol console source. |
| `website/` | Marketing/legal/whitepaper source. |
| `shared/` | Canonical shared data and browser utilities. |
| `docs/` | Project documentation. Turkish legacy/runbook material now lives under `docs/tr/`; internal handoff and audit notes live under `docs/internal/`. |
| `deployments/` | Deployment manifests. |
| `public/` | Static runtime data copied into the built site. |

## Phase 4 Moves

| Before | After | Reason |
| --- | --- | --- |
| `KURULUM-WIN11.md` | `docs/tr/KURULUM-WIN11.md` | Turkish Windows setup guide, not root source. |
| `SUNUM.md` | `docs/tr/SUNUM.md` | Turkish presentation material, not root source. |
| `SENIN-ADIMLAR.md` | `docs/tr/SENIN-ADIMLAR.md` | Turkish operator checklist. |
| `GO-LIVE.md` | `docs/tr/GO-LIVE.md` | Turkish launch checklist. |
| `LAUNCH.md` | `docs/tr/LAUNCH.md` | Turkish launch notes. |
| `ARCHITECT_LOG.md` | `docs/internal/ARCHITECT_LOG.md` | Internal engineering log, not public protocol entrypoint. |
| `QA_REPORT.md` | `docs/internal/QA_REPORT.md` | Internal QA snapshot. |
| `claude-handoff/*` | `docs/internal/claude-handoff/*` | Agent handoff scaffolding belongs with internal docs. |
| `setup-win11.ps1` | `scripts/setup/setup-win11.ps1` | Operator script belongs under `scripts/`. |
| `tokenomics.json` | removed from root | `shared/tokenomics.json` is canonical source. Build still emits `dist/tokenomics.json`; deploy still emits `public/tokenomics.json`. |

## Build And Runtime Notes

- Canonical tokenomics source: `shared/tokenomics.json`.
- Static site output still exposes `/tokenomics.json` from `dist/tokenomics.json`.
- Dev server still maps `/tokenomics.json` to `shared/tokenomics.json`.
- Public deployment artifacts remain in `public/` and `deployments/`.
