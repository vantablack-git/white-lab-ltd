# WhiteLab MVP — Full QA / Security / Deploy Report

**Date:** 2026-05-24  
**Auditor role:** Senior Solidity auditor + QA + DevOps  
**Repository:** `whitelab` monorepo  

---

## Executive Summary

| Metric | Result |
|--------|--------|
| **Build** | PASS — Solidity 0.8.26, 82 files compiled under coverage, 0 errors |
| **Tests** | **47/47 PASS** |
| **E2E local** | PASS — `npm run e2e:local` |
| **Local deploy** | PASS — `scripts/deploy.js` on hardhat |
| **Coverage** | **90.03% lines** (target 95% NOT met) |
| **Slither** | NOT RUN — Python/Slither unavailable in CI environment |
| **Sepolia deploy** | NOT RUN — requires user `PRIVATE_KEY` + funded wallet |
| **Production candidate readiness** | **72/100** (testnet/demo candidate only) |

**Mainnet verdict:** **NOT SAFE** for mainnet without Tier-1 audit, multisig admin, legal review, and coverage uplift.

---

## Phase 1 — Repository Inspection

### Structure (verified)

| Path | Status |
|------|--------|
| `package.json` | Present |
| `hardhat.config.js` | Present |
| `contracts/` | 8 protocol contracts + 1 UUPS treasury |
| `test/` | 10 test files |
| `scripts/` | `deploy.js`, `verify.js`, `e2e-local.js` |
| `frontend/` | Static protocol console |
| `deployments/` | `base-sepolia.json` (template), `hardhat.json` (after local deploy) |
| `docs/` | 9 chapters + team docs |
| `.env.example` | Complete |

### Dependency map

```
WLABToken (root)
 ├── WLABVesting
 ├── WLABStaking (staking + reward token)
 ├── TimelockController
 │    └── WLABGovernor
 ├── WLABTokenSale
 ├── WLABLockVault
 └── WLABOFTAdapter

WLABTreasuryUUPS (standalone upgradeable — NOT in deploy script)
```

### Toolchain

| Item | Value |
|------|--------|
| Solidity | `0.8.26`, `viaIR: true`, optimizer 200 runs, `cancun` |
| OpenZeppelin | `^5.1.0` (+ upgradeable) |
| Hardhat | `^2.22.17` |
| Plugins | toolbox, gas-reporter, solidity-coverage |
| Networks | `hardhat`, `baseSepolia` (84532), `base` (8453) |

### Missing / gaps identified

- `WLABTreasuryUUPS` not deployed by `deploy.js` (no proxy factory)
- No `localhost` network entry (use `--network hardhat` or add `localhost:8545`)
- Slither not installed in environment
- No `.env` committed (correct); Sepolia deploy blocked without user keys
- No Foundry/fuzz suite
- Governor proposal lifecycle untested
- `WLABLockVault`, `WLABOFTAdapter`, `WLABTreasuryUUPS` — 0% coverage at the time of this snapshot

---

## Phase 2 — Build Validation

```
npm install     → OK
npx hardhat compile → OK (78 files, evm cancun)
```

**Warnings:** None from compiler. npm audit reports 43 dependency vulnerabilities (Hardhat ecosystem); not protocol-level.

---

## Phase 3 — Test Execution

```
npm test → 28 passing (~2s)
```

### Coverage by contract

| Contract | Stmt % | Notes |
|----------|--------|-------|
| WLABTokenSale | 85% | Core IDO paths covered |
| WLABStaking | 91% | Good |
| WLABVesting | 85% | Good |
| WLABToken | 76% | Fee, pause, blacklist; whitelist/maxWallet partial |
| WLABGovernor | 0% | Deploy-only smoke tests |
| WLABLockVault | 0% | Untested at snapshot time (now covered) |
| WLABOFTAdapter | 0% | Untested |
| WLABTreasuryUUPS | 0% | Untested |

**Overall:** 68.46% statements / 70.29% lines — **below 95% target**.

### Test gaps (not failing, but missing)

- ERC20 `permit()` flow
- `maxWallet` enforcement
- `whitelistMode` on token
- ERC20 payment path on TokenSale
- Multi-phase IDO (Seed → Private → Public sequential)
- Full governance: propose → vote → queue → execute
- `WLABLockVault` lock/vote
- OFT bridge out/in

---

## Phase 4 — Security Review (Mini Audit)

### HIGH — Patched in this QA pass

| ID | Finding | Fix |
|----|---------|-----|
| H-01 | `recoverUnsoldTokens()` could drain **unclaimed** buyer allocations | Added `totalUnclaimedTokens` accounting; recover only `balance - obligation` |
| H-02 | Timelock deployed with **empty proposers** → Governor cannot queue | `deploy.js` grants `PROPOSER_ROLE` + `CANCELLER_ROLE` to Governor, `EXECUTOR_ROLE` to `address(0)` |
| H-03 | Transfer fee on token could tax IDO **claim** transfers | `deploy.js` whitelists and fee-exempts `WLABTokenSale` on token |

### HIGH — Open (mainnet blockers)

| ID | Finding | Recommendation |
|----|---------|----------------|
| H-04 | `WLABOFTAdapter` is a non-production bridge stub | Stub is disabled by default; replace with LayerZero OFT v2 before production |
| H-05 | Centralized `onlyOwner` on Sale, Vesting, Staking | Gnosis Safe 4/7 + timelock handover before mainnet |
| H-06 | `DEFAULT_ADMIN` on token is single EOA at deploy | Transfer to timelock/multisig; renounce only after role migration |

### MEDIUM

| ID | Finding |
|----|---------|
| M-01 | `finalizeSale()` only finalizes **current** phase; multi-phase IDO needs explicit design |
| M-02 | `configurePhase` could overwrite phase config after sales | Fixed with phase lock guard |
| M-03 | Payment rounding: `(tokenAmount * price) / 1e18` favors protocol on dust |
| M-04 | No per-wallet buy cap in sale |
| M-05 | `withdrawFunds` sends **entire** ETH balance (includes accidental sends) |
| M-06 | Refund path does not reduce `tokensSold` / `totalRaisedWei` (accounting drift for analytics) |
| M-07 | `WLABStaking` — `stake()` adds to existing position but resets `lockEnd` (user griefing self) |
| M-08 | `WLABVesting` uses `transfer` not `SafeERC20` (non-standard tokens) |
| M-09 | `snapshot()` on token is event-only; not ERC20Votes snapshot — document clearly |

### LOW

| ID | Finding |
|----|---------|
| L-01 | Fee path still performs **2** sender debits (net + fee) — votes correct but gas-heavy |
| L-02 | `receive()` on sale accepts stray ETH |
| L-03 | No `Phase` enum validation on `claim(phase)` beyond finalized flag |
| L-04 | Emergency staking penalty fixed 10% — no governance control |

### Reentrancy

- Sale: `nonReentrant` on buy/claim/refund — OK  
- Staking/Vesting: `nonReentrant` on external flows — OK  
- ETH refunds use call — guarded by reentrancy + CEI pattern  

### Fixes applied (this session)

1. `WLABTokenSale.sol` — `totalUnclaimedTokens` + safe `recoverUnsoldTokens`
2. `scripts/deploy.js` — timelock roles + sale whitelist
3. `WLABOFTAdapter.sol` — `safeTransfer` on bridgeIn
4. `scripts/e2e-local.js` — full local simulation
5. `test/WLABTokenSale.test.js` — recover + Merkle tests

---

## Phase 5 — Local Deployment Simulation

```
npx hardhat run scripts/deploy.js --network hardhat  → PASS
npm run e2e:local                                    → PASS
```

Verified:

- Deploy ordering and constructor wiring  
- 1B mint + 100M to sale  
- IDO configure → buy → finalize → claim  
- Stake + delegate votes  
- Governor has Timelock `PROPOSER_ROLE`  

**Not simulated on persistent `hardhat node`:** equivalent coverage via in-process hardhat network.

---

## Phase 6 — Testnet Deploy Prep

### `.env.example` — complete

- `PRIVATE_KEY`, RPC URLs, `ETHERSCAN_API_KEY`, `TREASURY_ADDRESS`, `TIMELOCK_DELAY`

### `hardhat.config.js` — valid Base Sepolia + Basescan custom chains

### Verify script

- `scripts/verify.js` verifies all 8 deployed contracts from manifest  
- Requires populated `deployments/baseSepolia.json`  

### Sepolia deploy

**Not executed** — no funded `PRIVATE_KEY` in environment. User command:

```bash
cp .env.example .env
# fill keys
npm run deploy:sepolia
npm run verify
```

---

## Phase 7 — Code Quality Notes

- NatSpec: partial on core contracts; Governor/OFT thin  
- Events: adequate on Sale/Token  
- Immutables: used on Sale (`saleToken`, `paymentToken`)  
- Dead code: none critical  
- Treasury UUPS: never initialized in deploy pipeline  

---

## Phase 8 — Final Scores

### 1. Build status

**PASS**

### 2. Test status

**28/28 PASS**

### 3. Security findings summary

- **3 HIGH patched** (H-01–H-03)  
- **3 HIGH open** (H-04–H-06; H-04 mitigated by default-disabled stub, not production-ready)  
- **8 MEDIUM open + 1 fixed**  
- **4 LOW open**  

### 4. Deployment readiness

| Environment | Ready? |
|-------------|--------|
| Local / Hardhat | Yes |
| Base Sepolia | Yes (with user keys) |
| Base Mainnet | **No** |

### 5. Remaining risks

- Unaudited code  
- Admin key centralization  
- OFT stub unsafe  
- Low test coverage on governance/ve/OFT/treasury  
- No formal verification  

### 6. Recommended next actions

1. Sepolia deploy + Basescan verify with multisig treasury  
2. `npm run coverage` → add tests until ≥85% (stretch 95%)  
3. Install Slither: `pip install slither-analyzer && slither contracts/`  
4. Tier-1 external audit  
5. Replace OFT stub; deploy Treasury via UUPS proxy  
6. Governance E2E test (propose → execute)  
7. Legal opinion before public sale  

### 7. Coverage estimate

**~70% lines** (measured)

### 8. Production readiness score

## **62 / 100**

| Criterion | Score impact |
|-----------|----------------|
| Builds + core tests | +25 |
| P0 IDO + fee/votes fixed | +15 |
| Security patches (H-01–03) | +10 |
| Deploy scripts + E2E | +7 |
| Coverage 70% vs 95% target | -15 |
| No Slither / external audit | -10 |
| Centralized admin + OFT stub | -10 |
| No mainnet multisig/legal | -10 |

---

*Report generated after autonomous QA execution. See `ARCHITECT_LOG.md` for change log.*

---

## Codex Stewardship Update - 2026-05-24

### Additional fixes

- Added explicit `WLABToken.feeExempt` state and `setFeeExempt()` so fee-on-transfer behavior does not tax protocol entitlement transfers such as IDO claims.
- Updated deployment and local E2E scripts to mark `WLABTokenSale` as both whitelisted and fee-exempt.
- Fixed `WLABStaking` restake accounting: repeated same-tier deposits now preserve `totalWeightedStake`; mixed-tier top-ups revert until per-deposit staking is implemented.
- Prevented compound staking when reward and staking tokens differ, avoiding unbacked principal accounting.
- Fixed `WLABLockVault` gauge voting so users set absolute gauge weight instead of repeatedly adding the same voting power.
- Added sale phase guards against finalizing without an active phase and reconfiguring after purchases begin.

### Verification

| Command | Result |
|---------|--------|
| `npm.cmd run compile` | PASS |
| `npm.cmd test` | 39 passing |
| `npm.cmd run e2e:local` | PASS |
| `npm.cmd run coverage` | 81.1% lines |
| `npx.cmd hardhat run scripts/deploy.js --network hardhat` | PASS |

### Still blocked

- Slither was not run because `slither` and Python are not installed/in PATH.
- Mainnet readiness remains blocked by coverage below 95%, incomplete adverse-path governance coverage, multisig handover, real OFT replacement, and external audit.

---

## Finalization Update - 2026-05-24

### Additional hardening

- Added Governor happy-path lifecycle test: propose, vote, queue, timelock wait, execute.
- Added UUPS proxy tests for initializer protection, spender authorization, upgrade authorization, and storage persistence.
- Added OFT stub tests and disabled bridge operations by default.
- Added invariant-style tests for sale obligations and staking weighted accounting.
- Added sale configuration guards for zero price, zero allocation, invalid caps, and locked phases.
- Added static protocol frontend under `frontend/`.
- Added GitHub Actions CI and environment validation scripts.

### Final verification

| Command | Result |
|---------|--------|
| `npm.cmd run validate` | PASS |
| `npm.cmd test` | 47 passing |
| `npm.cmd run coverage` | 90.03% lines |
| `npx.cmd hardhat run scripts/deploy.js --network hardhat` | PASS |
| Browser smoke test | PASS, no console errors on desktop/mobile |

### Updated blockers

- Coverage is improved but still below the 95% mainnet criterion.
- Slither still unavailable locally.
- Treasury proxy is tested but not deployed by `deploy.js`.
- OFT remains a disabled stub, not a real bridge.
- Safe/timelock admin handover is documented but not executed.
