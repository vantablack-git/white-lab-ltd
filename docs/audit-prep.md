# White Lab External Audit Prep Package

Status: **prep package ready, audit freeze not cut**.

This package is the handoff index for an external smart contract audit. It is intentionally written for auditors: scope, exclusions, current verification evidence, known limitations, deployment assumptions, and contract-specific questions are collected in one place.

## 1. Freeze Status

| Field | Value |
| --- | --- |
| Last committed HEAD at package creation | `b47898c` |
| Working tree status | Not frozen. Security-audit, adversarial-branch, and lifecycle tests have been added. |
| Audit freeze requirement | Cut a dedicated audit commit after this package is reviewed, then record the final full commit hash here. |
| Mainnet status | Blocked. No mainnet deployment is approved from this package alone. |

Before sending code to auditors:

1. Commit the current Phase 11-14 changes.
2. Run `npm run validate`.
3. Run `npm run coverage`.
4. Run `npm run gas`.
5. Run Slither or archive the latest CI Slither artifact.
6. Replace `b47898c` above with the final frozen commit hash.
7. Attach the exact `package-lock.json` from the frozen commit.

## 2. Audit Scope

### In Scope

| Area | Path | Notes |
| --- | --- | --- |
| Token | `contracts/WLABToken.sol` | ERC20, Permit, Votes, pause, roles, fee logic, blacklist/whitelist, capped minting |
| Token sale | `contracts/WLABTokenSale.sol` | Multi-phase ETH/ERC20 sale, Merkle whitelist, claim, refund, bounded withdrawals |
| Vesting | `contracts/WLABVesting.sol` | Cliff, linear vesting, revocation, emergency recovery bound by obligations |
| Staking | `contracts/WLABStaking.sol` | Single position per wallet, tiered locks, funded finite reward programs |
| Governance lock | `contracts/WLABLockVault.sol` | Fixed non-decaying weighted locks, gauge voting, lock compaction |
| Governor | `contracts/WLABGovernor.sol` | OpenZeppelin Governor plus TimelockController integration |
| Treasury | `contracts/upgrades/WLABTreasuryUUPS.sol` | UUPS treasury, role-gated withdraw and upgrade |
| Proxy wrapper | `contracts/proxy/WLABERC1967Proxy.sol` | Production-named ERC1967 proxy wrapper |
| Bridge stub | `contracts/WLABOFTAdapter.sol` | Disabled demo stub only, not production bridge infrastructure |
| Deployment policy | `scripts/deploy.js`, `scripts/lib/deployment-policy.js`, `scripts/lib/handover.js` | Production deploy gates and multisig handover |
| Verification scripts | `scripts/verify.js`, `scripts/e2e-local.js`, `scripts/validate-env.js` | Reproducibility and environment safety |
| Tests | `test/` | Regression, adversarial branch, lifecycle, invariant, and integration tests |

### Out of Scope

- Legal and regulatory analysis.
- Token listing, liquidity, and market-maker plans.
- Frontend visual polish except where UI could mislead transaction intent or contract addresses.
- A production bridge implementation. `WLABOFTAdapter` is a stub and should either remain disabled or be removed/replaced before mainnet.
- Mainnet deployment execution.

## 3. Primary Documentation

Auditors should read these files before deep review:

| Document | Purpose |
| --- | --- |
| `README.md` | Repository overview and mainnet blocker statement |
| `docs/13-threat-model.md` | Canonical threat model V2 |
| `docs/10-production-candidate-readiness.md` | Readiness status and launch blockers |
| `docs/11-operations-runbook.md` | Deployment, role handover, upgrade, emergency runbooks |
| `docs/gas-budget.md` | Gas measurement method and budgets |
| `docs/adr/0001-governance-lock-vault.md` | Lock vault naming and non-decaying power decision |
| `docs/adr/0002-production-admin-handover.md` | Production multisig handover invariant |
| `docs/adr/0003-funded-staking-rewards.md` | Funded finite reward program invariant |
| `docs/adr/0004-repository-root-discipline.md` | Canonical repo structure |
| `docs/internal/RC1-VALIDATION.md` | Historical RC-1 validation snapshot |
| `docs/internal/ROADMAP-30.md` | Current phase roadmap |

## 4. Verification Evidence

Latest local verification during Security Audit + adversarial branch coverage phase:

| Check | Result |
| --- | --- |
| Unit/integration suite | `192 passing` |
| Local E2E | `PASSED` |
| Gas reporter | `npm run gas`, `192 passing` |
| Coverage | Whole-repo branch coverage: `95.43%`; all core contracts >=93%; mocks excluded |
| Slither | CI configured to fail on high-severity findings and upload SARIF/JSON artifacts |
| Security audit tests | 17 adversarial tests covering reentrancy, fee-on-transfer, cross-function desync, initialization, and cross-phase isolation |

Required before frozen audit handoff:

- Attach fresh `npm run coverage` output from the frozen commit.
- Attach fresh `npm run gas` output from the frozen commit.
- Attach Slither SARIF/JSON artifact from CI or a local Slither run.
- Attach exact deployment manifest if audit includes deployed Base Sepolia contracts.

## 5. Security Decisions Already Made

| Decision | Rationale | Reference |
| --- | --- | --- |
| Lock vault is not a veCRV-style vote escrow | Voting power is fixed at lock time and does not decay | `docs/adr/0001-governance-lock-vault.md` |
| Production deploy must end with multisig control | Avoid hidden deployer admin paths | `docs/adr/0002-production-admin-handover.md` |
| Staking rewards must be finite and funded | Avoid promising unfunded emissions or spending principal | `docs/adr/0003-funded-staking-rewards.md` |
| OFT adapter is not production bridge infra | Current adapter is a guardrailed stub | `README.md`, `docs/13-threat-model.md` |
| Public copy must be calibrated | No fake decentralization, no audit claims, no mainnet-ready claims | `README.md`, `docs/13-threat-model.md` |

## 6. Known Limitations

These are known and should not be treated as surprise findings unless their severity is higher than understood:

1. The project is not externally audited yet.
2. Mainnet deployment is blocked.
3. Governance can be dominated by concentrated token supply until distribution and delegation mature.
4. Multisig/Safe remains the real control plane during early production readiness.
5. `WLABOFTAdapter` is a stub and must not be marketed as a live cross-chain bridge.
6. Sale fairness uses allowlists/caps/refunds, not commit-reveal.
7. Legal/compliance review for sale participation is not complete.
8. Address registry and signed manifest publication are planned but not complete.
9. Production Safe owner verification and Base Sepolia rehearsal remain pending.
10. Branch coverage is at 95.43%; the remaining uncovered branches are `nonReentrant` modifier else-paths or unreachable require edges that solidity-coverage counts but cannot practically be hit without breaking the contract's own invariants.
11. `WLABTreasuryUUPS.setFeeSwitch()` writes `feeSwitchEnabled` and `protocolFeeBps` to storage, but V1's `withdraw()` never reads them — the fee switch is a no-op until a V2 upgrade activates it. This is a code-quality gap, not a security vulnerability; any governance action depending on the fee switch before an upgrade would be ineffective.
12. `WLABTokenSale.startPhase()` deactivates the previous active phase but does not finalize it. An orphaned (deactivated, unfinalized) phase can still be resolved by calling `finalizePhase()` even after `finalizeSale()` has set `saleFinalized = true`, because `finalizePhase` does not gate on `saleFinalized`. Owner inaction is the only risk.

## 7. Deployment and Authority Model

Production-shaped deployments are expected to use:

- `MULTISIG_ADDRESS` set to a real Safe or equivalent multisig.
- `scripts/deploy.js` on `baseSepolia` or `base`.
- Automatic handover through `scripts/lib/handover.js`.
- Manifest entry proving `adminHandover.deployerRevoked == true`.
- Basescan verification after deployment.

Authority expectations:

| Component | Expected production authority |
| --- | --- |
| `WLABToken` roles | Multisig or Timelock, not deployer EOA |
| Sale owner | Multisig or Timelock |
| Vesting owner | Multisig or Timelock |
| Staking owner | Multisig or Timelock |
| Lock vault owner | Multisig or Timelock |
| Treasury roles | Multisig or Timelock |
| Timelock proposer/canceller | Governor |
| Timelock executor | Open executor acceptable only for queued payloads |
| OFT adapter | Disabled or excluded from mainnet deployment |

## 8. Contract-Specific Audit Questions

### `WLABToken`

- Can fee-bearing transfers desynchronize ERC20Votes checkpoints from balances in any fee, burn-share, max-wallet, pause, blacklist, whitelist, or fee-exempt combination?
- Are role boundaries strict enough for mint, burn, pause, snapshot, compliance, and fee configuration?
- Can max wallet enforcement be bypassed through fee paths, burn paths, or exempt recipients?

### `WLABTokenSale`

- Are sale obligations fully protected across every `buy`, `finalizePhase`, `finalizeSale`, `claim`, `refund`, `withdrawFunds`, and `recoverUnsoldTokens` interleaving?
- Does the ERC20 payment-token path preserve accounting under non-standard ERC20 behavior?
- Are phase transitions safe when one phase succeeds and another phase fails?
- Is the Merkle whitelist use sufficient for intended sale policy, or should the launch require stronger anti-Sybil controls?

### `WLABVesting`

- Can any `revoke`, `release`, or `emergencyWithdraw` sequence strand vested tokens or drain outstanding obligations?
- Is one schedule per beneficiary acceptable for launch, or does it create operational/accounting risk?
- Are revocable schedules clearly represented enough for beneficiaries?

### `WLABStaking`

- Can reward accounting under compound, claim, unstake, emergency unstake, and program rollover ever consume principal?
- Is `reservedRewards` sufficient to prevent overcommitment across accrual edge cases?
- Does the single-position model create any unexpected lock or top-up behavior?

### `WLABLockVault`

- Can multi-lock users over-allocate gauge weight through vote replacement and withdrawal ordering?
- Does swap-and-pop compaction preserve user expectations and prevent stale lock-index assumptions?
- Are fixed, non-decaying voting weights correctly disclosed and reflected in all vote math?

### `WLABGovernor` and `TimelockController`

- Are proposal state transitions safe for pending, active, defeated, canceled, succeeded, queued, executed, expired, and mismatched payload paths?
- Is the quorum fraction appropriate for expected early circulating supply and delegation concentration?
- Can Timelock roles be misconfigured by deployment or handover scripts?

### `WLABTreasuryUUPS`

- Does UUPS upgrade authorization block every unauthorized upgrade path?
- Is storage layout robust for future upgrades?
- Should upgrades be Timelock-only, Safe-only, or Safe plus Timelock for the first production release?

### `WLABOFTAdapter`

- Is the stub sufficiently isolated from production deployments?
- Should the stub be removed from mainnet release artifacts entirely until a real audited bridge is ready?
- If retained for demos, are replay protection and enable/disable semantics sufficient?

### Scripts and Operations

- Can `scripts/deploy.js` ever exit successfully while deployer retains critical authority?
- Is `scripts/lib/handover.js` idempotent and safe under partial execution or failed transactions?
- Are environment checks strict enough to prevent dummy private key or malformed multisig use?
- Are generated manifests complete enough for public verification?

## 9. Suggested Auditor Deliverables

Requested deliverables:

1. Severity-ranked findings with reproducible proof-of-concept tests where possible.
2. Explicit review of all in-scope invariants from `docs/13-threat-model.md`.
3. Deployment and handover script review, not just Solidity review.
4. UUPS storage and authorization review.
5. Governance concentration and timelock-role configuration commentary.
6. Recommendation on whether to remove `WLABOFTAdapter` from mainnet release scope.
7. Final remediation review after fixes.

## 10. Handoff Checklist

- [ ] Freeze audit commit and update this file with the full commit hash.
- [ ] Ensure working tree is clean.
- [ ] Run `npm ci`.
- [ ] Run `npm run compile`.
- [ ] Run `npm test`.
- [ ] Run `npm run e2e:local`.
- [ ] Run `npm run coverage`.
- [ ] Run `npm run gas`.
- [ ] Attach Slither SARIF/JSON artifact.
- [ ] Attach deployment manifest if deployed contracts are in scope.
- [ ] Confirm no `.env`, private keys, API keys, or unpublished multisig owner details are included.
