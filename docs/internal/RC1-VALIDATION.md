# RC-1 Validation Pass

This is the internal release-candidate audit log captured at the close of Phase 0–6. It is a snapshot, not a sign-off. Mainnet deployment remains blocked on external audit, public bug bounty, and operational rehearsal on Base Sepolia.

## Context

- Repo HEAD at validation: `a4a9e12 surface(site): switch wordmark to thin italic 'White Lab'`.
- Toolchain: Hardhat 2.22, Solidity 0.8.26, OpenZeppelin v5.
- Validation host: Windows 11, Node 22.

## Test surface

- Unit + integration tests: **79 passing**.
- Local end-to-end (`npm run e2e:local`): **PASSED** (deploy → IDO → claim → stake → governance delegation).
- Static site build (`npm run build:site`): **PASSED**.
- Solidity coverage (`npm run coverage`):
  - Statements: **92.97%**
  - Branches: **61.11%**
  - Functions: **89.47%**
  - Lines: **93.96%**

Branch coverage is the weakest dimension. Lowest contracts:

| Contract | Branches |
| --- | --- |
| `WLABToken.sol` | 43.33% |
| `WLABTokenSale.sol` | 61.11% |
| `WLABVesting.sol` | 60.87% |
| `WLABLockVault.sol` | 65.38% |
| `WLABStaking.sol` | 72.73% |

These are mostly defensive `require` branches and compliance toggles that need adversarial path tests before public audit, not before testnet rehearsal.

## Production deploy gate smoke test

`scripts/lib/deployment-policy.js` was exercised against six configurations. Result:

| Case | Outcome |
| --- | --- |
| `base`, no `MULTISIG_ADDRESS` | Rejected — multisig required on production. |
| `base`, multisig equal to deployer | Rejected — single-key deploy disallowed on production. |
| `base`, malformed multisig | Rejected — address validation. |
| `baseSepolia`, valid multisig | Accepted, handover required, OFT enabled. |
| `base`, valid multisig | Accepted, handover required, OFT disabled by default. |
| `hardhat`, no multisig | Accepted, handover not required, OFT enabled (dev). |

OFT adapter is gated off Base mainnet unless `DEPLOY_OFT=true` is set explicitly. Verified.

## Phase 1–3 contract blocker checklist

| Risk | Mitigation | Test |
| --- | --- | --- |
| Vesting revoke strands vested-but-unreleased tokens | Beneficiary paid before refund to owner. | `pays vested-but-unreleased to beneficiary on revoke` |
| Vesting `emergencyWithdraw` drains vested asset | Hard-bounded by `totalOutstanding`. | `blocks emergencyWithdraw of the vested token below the outstanding obligation` |
| Multi-phase sale refunds use a single global latch | Per-phase `phaseRefundsEnabled` and bounded `withdrawableRaisedWei`. | success+fail / success+success / fail+fail tests |
| Staking top-up shortens lock | `lockEnd = max(existing, new)` invariant. | `same-tier top-up never shortens the lock and matches max(existing, new)` |
| Token fee path emits two sender Transfer events | Single `super._update` from sender; recipient forwards fee. | `emits exactly one Transfer with from=sender, matching the no-fee path` |
| Staking promises rewards it does not hold | `totalStaked` and `reservedRewards` accounting; finite `rewardEndTime`; reward backing excludes principal. | `rejects reward programs that are not backed by available reward balance`, `stops reward accrual at the funded program end` |
| Lock vault accumulates zero-record withdrawn locks | Swap-and-pop on withdraw; `lockCount(user)` exposed. | `compacts withdrawn locks with swap-and-pop instead of leaving zeroed slots` |
| Sale `recoverUnsoldTokens` would touch obligated funds | `totalUnclaimedTokens` invariant maintained across phases. | `recoverUnsoldTokens preserves all unclaimed obligations across successful phases` |

## Trust model

- Production deploy script (`scripts/deploy.js`) refuses to leave the deployer EOA with privileged authority on `base` and `baseSepolia`.
- `scripts/lib/handover.js` performs token role grant-then-revoke ordering, transfers Ownable ownership, sets timelock admin to multisig, and audits residual deployer authority.
- Treasury proxy is initialized with the multisig as admin/upgrader/spender on production networks.
- Bridge stub is excluded from Base mainnet by default.

## Repository hygiene

- `.env` is not tracked. `.gitignore` covers `node_modules`, `cache`, `artifacts`, `coverage`, `coverage.json`, `dist`, `.env`, logs.
- Only fallback dummy private key in `hardhat.config.js`; `scripts/validate-env.js` rejects this fallback in `env:check`.
- Repo root contains only canonical project surfaces; Turkish guides live under `docs/tr/`, internal notes under `docs/internal/`, Windows setup script under `scripts/setup/`.
- Static site build now writes `?v=<sha1>` cache-bust query strings on `site.css`, `site.js`, `app.css`, `app.js` to prevent stale CDN/browser CSS after deploys.

## Documentation calibration

- Root `README.md` is English, canonical, and explicitly states the project is **testnet candidate, audit pending, mainnet blocked**.
- Turkish material under `docs/tr/` is marked as translation/legacy guidance.
- ADRs cover lock-vault naming, production handover, funded staking rewards, and repo-root discipline.

## Outstanding RC-1 gaps

These are not regressions — they are the agreed remaining gates before mainnet:

1. External audit and remediation.
2. Public bug bounty post-audit.
3. Slither / static analysis run in CI or release ceremony, with findings recorded.
4. Real LayerZero OFT v2 integration to replace the disabled stub.
5. Adversarial branch coverage uplift toward 80%+ on `WLABToken`, `WLABTokenSale`, `WLABVesting`.
6. Operational rehearsal on Base Sepolia with production-shaped `MULTISIG_ADDRESS`, manifest verification on Basescan, and post-deploy residual-authority audit.

## Verdict

The repository is **push-ready and Base Sepolia rehearsal-ready**. It is not mainnet-ready. The next concrete step is the Base Sepolia rehearsal under a real Safe/multisig.
