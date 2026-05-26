# WhiteLab Launch OS

WhiteLab is a Base-native launch and protocol stack for the WLAB ecosystem: ERC-20 token, multi-phase token sale, vesting, staking, governance locking, Governor/Timelock governance, upgradeable treasury, protocol console, marketing site, deployment scripts, and runbooks.

Current status: **testnet candidate, audit pending, mainnet blocked**. The contracts have a growing regression suite and local E2E coverage, but this repository should not be described as audited, production-ready, or mainnet-ready until the remaining launch gates in `docs/10-production-candidate-readiness.md` are closed.

## Quick Start

```bash
npm ci
npm run compile
npm test
npm run e2e:local
npm run build:site
```

Expected today: `79 passing` plus local E2E passing.

For a local deploy:

```bash
npm run deploy:local
npm run start
```

- Marketing site: `http://127.0.0.1:4173/`
- Protocol console: `http://127.0.0.1:4173/app`
- Static build output: `dist/`

Windows helper:

```powershell
.\scripts\setup\setup-win11.ps1 -Phase check
```

## Repository Layout

| Path | Purpose |
| --- | --- |
| `contracts/` | Solidity contracts. Production proxy wrapper lives under `contracts/proxy/`; test-only upgrade fixture lives under `contracts/test/`. |
| `test/` | Hardhat unit, integration, lifecycle, and invariant tests. |
| `scripts/` | Deploy, verify, local E2E, environment validation, setup, and handover scripts. |
| `frontend/` | Protocol console source. |
| `website/` | Marketing, legal, and whitepaper source. |
| `shared/` | Canonical shared data, including `shared/tokenomics.json`. |
| `docs/` | Canonical docs, ADRs, readiness notes, operations guide, Turkish translations, and internal notes. |
| `deployments/` | Deployment manifests. |
| `public/` | Static runtime data copied into the built site. |

See `docs/repo-structure-map.md` for the Phase 4 migration map.

## Contracts

| Contract | Role |
| --- | --- |
| `WLABToken` | ERC-20 with Permit, Votes, fee controls, pause, blacklist/whitelist controls, and capped minting. |
| `WLABTokenSale` | Multi-phase sale with whitelist support, per-phase refunds, claims, and bounded fund withdrawal. |
| `WLABVesting` | Cliff + linear vesting with protected outstanding obligations. |
| `WLABStaking` | Tiered staking with funded finite reward programs and principal-aware reward accounting. |
| `WLABLockVault` | Weighted governance lock vault with fixed, non-decaying voting power. This is not a veCRV-style vote escrow. |
| `WLABGovernor` | OpenZeppelin Governor integrated with TimelockController. |
| `WLABTreasuryUUPS` | UUPS treasury with role-gated withdrawals and upgrades. |
| `WLABOFTAdapter` | Disabled bridge stub for demos/tests only. Not production bridge infrastructure. |

## Deployment Policy

Production-network deploys (`base`, `baseSepolia`) must set `MULTISIG_ADDRESS`. `scripts/deploy.js` refuses production deploys that would leave the deployer EOA with critical authority, and it gates the OFT adapter off Base mainnet unless `DEPLOY_OFT=true` is explicitly set.

```bash
npm run env:check:base
npm run deploy:base
npm run verify:base
```

Base Sepolia:

```bash
npm run env:check
npm run deploy:sepolia
npm run verify
```

## Documentation

- Readiness: `docs/10-production-candidate-readiness.md`
- Operations: `docs/11-operations-runbook.md`
- Threat model: `docs/13-threat-model.md`
- ADRs: `docs/adr/`
- Turkish materials/translations: `docs/tr/`
- Internal handoff and historical notes: `docs/internal/`

## Static Analysis

Slither runs in CI on every push and pull request via `crytic/slither-action`. The pipeline:

- Uses the existing `slither.config.json` (filters `node_modules`, `contracts/test`, excludes informational/optimization detectors).
- Fails the build on **high-severity** findings.
- Persists the SARIF and JSON reports as artifacts under the `static-analysis` job for review.

To run Slither locally (Linux/macOS, Python 3.10+):

```bash
pip install slither-analyzer
npm run compile
slither . --config-file slither.config.json
```

## Mainnet Blockers

- External smart contract audit not complete.
- Public bug bounty not complete.
- Slither runs in CI; release ceremony must still archive the latest CI report and remediate before mainnet.
- Real bridge implementation is not present; current OFT adapter is a disabled stub.
- Legal/compliance review, liquidity plan, and public launch operations remain outside the codebase.

## License

MIT. Use at your own risk. This repository is a testnet candidate until the readiness gates above are closed.
