# White Lab Threat Model V2

Status: **testnet candidate, audit pending, mainnet blocked — 192 tests passing, 95.43% branch coverage**.

This document is the canonical threat model for the current repository state. It is intentionally conservative: it lists what the system protects, who can act on it, which assumptions are trusted today, which invariants are enforced by code and tests, and which risks remain unresolved before mainnet.

## 1. Scope

In scope:

- `WLABToken`
- `WLABTokenSale`
- `WLABVesting`
- `WLABStaking`
- `WLABLockVault`
- `WLABGovernor` + `TimelockController`
- `WLABTreasuryUUPS`
- `WLABOFTAdapter` as a disabled stub only
- Deploy, verify, handover, local E2E, gas, and static analysis scripts
- Marketing site and protocol console only where they affect user trust, address display, or transaction intent

Out of scope until later launch gates:

- Mainnet deployment execution.
- External audit sign-off.
- Legal/compliance review for sale participation.
- Liquidity, market making, exchange listing, and tax treatment.
- Real LayerZero OFT v2 bridge implementation. The current adapter is not production bridge infrastructure.

## 2. Protected Assets

| Asset | Why it matters | Primary controls |
| --- | --- | --- |
| WLAB supply cap | Prevents inflation beyond the stated 1B max supply | `MAX_SUPPLY`, `MINTER_ROLE`, multisig handover tests |
| Buyer sale entitlements | Buyers must be able to claim purchased tokens or refund failed phases | `purchasedTokens`, `contributions`, `totalUnclaimedTokens`, per-phase refund flags |
| Vesting obligations | Beneficiaries must not lose vested or outstanding allocations to owner recovery | `totalOutstanding`, revoke payout ordering, emergency withdraw bound |
| Staked principal | Reward logic must not consume user principal | `totalStaked`, `reservedRewards`, reward backing checks |
| Lock vault voting power | Governance lock accounting must not overcount, decay falsely, or grow unbounded | fixed lock-time power, absolute gauge weights, swap-and-pop withdrawal |
| Treasury funds | Withdrawals and upgrades must require explicit authority | `SPENDER_ROLE`, `UPGRADER_ROLE`, UUPS tests |
| Governance execution | Privileged changes must pass proposal, vote, queue, timelock, and execute states | Governor lifecycle tests, Timelock roles |
| Deployment authority | Deployer must not retain unilateral production control | `validateProductionConfig`, `performHandover`, residual-authority audit |
| Public user trust | UI must not imply fake decentralization, audited status, or production bridge readiness | calibrated README/site language, address manifest roadmap |

## 3. Actors and Trust

| Actor | Intended power | Main abuse path | Current mitigation |
| --- | --- | --- | --- |
| Deployer EOA | Bootstrap contracts and roles before handover | Retains mint, pause, ownership, upgrade, or withdraw authority | Production deploys require `MULTISIG_ADDRESS`; handover grants first, revokes after, and audits residual power |
| Multisig / Safe | Holds production admin authority before mature DAO control | Collusive or compromised signer set | Explicit trust model, ceremony checklist, future Safe owner verification |
| Governor voters | Propose and vote on timelocked actions | Concentrated supply captures governance | ERC20Votes checkpointing, voting delay, timelock delay; residual concentration remains |
| Timelock executor | Executes queued payloads after delay | Executes malicious but valid queued payload | Delay creates review window; payload review remains operational |
| Sale buyers | Buy, claim, refund according to phase state | Sybil cap bypass, front-running, invalid claim/refund attempts | Merkle whitelist option, per-wallet caps, soft/hard caps, exact entitlement accounting |
| Vesting owner | Creates and revokes revocable schedules | Drains outstanding obligations or revokes after vesting unfairly | `totalOutstanding`, beneficiary payout on revoke, revocation tests |
| Stakers | Stake, claim, unstake, emergency unstake | Reward drain or accounting manipulation | funded reward programs, `rewardDebt`, finite reward end, principal-aware accounting |
| Lock vault users | Lock and allocate gauge votes | Over-allocate gauges or withdraw below active votes | aggregate vote cap, withdrawal checks, fixed non-decaying power disclosure |
| Bridge operator | Demo-only bridge toggles | Enables stub as if production bridge | Base mainnet gated off by default; adapter is documented as stub |
| Frontend operator | Publishes site and console | Displays stale/wrong addresses or overstates readiness | cache busting, calibrated docs, manifest publication planned |
| External attacker | No trusted authority | Reentrancy, state timing, malformed calldata, griefing, MEV | `ReentrancyGuard`, `SafeERC20`, access control, adversarial tests |

## 4. Trust Boundaries

| Boundary | Risk | Required discipline |
| --- | --- | --- |
| EOA to multisig handover | A deploy that "works" but leaves hidden EOA control | Treat deploy as failed unless manifest shows successful residual-authority audit |
| Multisig to Timelock/Governor | Governance theater while multisig has direct powers | Publicly state the actual admin model; only claim DAO control after roles prove it |
| Frontend to contracts | UI can mislead users about addresses, phases, or paused state | Derive production addresses from signed manifests, not hardcoded trust |
| Sale contract to payment token | ERC20 transfer quirks or fee-on-transfer behavior can skew accounting | Use `SafeERC20`; supported payment-token behavior must be rehearsed before launch |
| Staking contract to reward balance | Contract balance mixes principal and rewards | Reward backing excludes `totalStaked`; rewards are reserved and finite |
| Governance proposal to execution payload | A benign proposal title can hide a dangerous calldata payload | Publish decoded calldata before execution; delay must be used for review |
| Repository to deployment | Code review can miss environment-specific behavior | `env:check`, deterministic deploy scripts, manifest validation, Basescan verification |

## 5. Contract Invariants

| Contract | Invariant | Enforced by | Tests / validation |
| --- | --- | --- | --- |
| `WLABToken` | `totalSupply() <= MAX_SUPPLY` | capped mint logic | `WLABToken.test.js` constructor/mint paths |
| `WLABToken` | Fee-bearing transfers preserve ERC20Votes checkpoint consistency | single sender-side `_update` on fee path | `emits exactly one Transfer with from=sender, matching the no-fee path` |
| `WLABToken` | Compliance, pause, fee, burn, mint, and snapshot controls are role-gated | AccessControl roles | Phase 8 adversarial branch tests |
| `WLABTokenSale` | Owner cannot recover or withdraw assets owed to buyers | `totalUnclaimedTokens`, `withdrawableRaisedWei` | sale invariant tests and Phase 9 branch tests |
| `WLABTokenSale` | Refund eligibility is isolated per sale phase | `phaseRefundsEnabled[phase]` | success+fail, success+success, fail+fail tests |
| `WLABTokenSale` | ETH and ERC20 payment paths have separate accounting semantics | payment-token branch checks | ERC20 payment token path tests |
| `WLABVesting` | Emergency withdraw cannot drain outstanding vested-token obligations | `totalOutstanding` bound | Phase 1B and Phase 10 tests |
| `WLABVesting` | Revocation pays vested-but-unreleased tokens before owner refund | revoke payout ordering | Phase 1A and Phase 10 revoke tests |
| `WLABStaking` | Reward programs cannot promise unfunded rewards | `_rewardBackingBalance`, `reservedRewards`, finite end | Phase 3 staking reward tests |
| `WLABStaking` | Top-ups cannot shorten an existing lock | `max(existing, newLockEnd)` | Phase 1D top-up tests |
| `WLABLockVault` | Aggregate gauge votes cannot exceed active lock voting power | absolute gauge weight accounting | lock vault vote tests |
| `WLABLockVault` | Withdrawn lock storage does not grow unbounded | swap-and-pop compaction | `compacts withdrawn locks...` test |
| `WLABGovernor` | Proposal execution requires successful vote, queue, timelock delay, and matching payload | OZ Governor + Timelock | Phase 11 lifecycle tests |
| `WLABTreasuryUUPS` | Withdraw and upgrade authorities are role-gated and storage-preserving | UUPS role checks | `WLABTreasuryUUPS.test.js` |
| `WLABOFTAdapter` | Bridge cannot operate accidentally while disabled | `bridgeEnabled` guard | `WLABOFTAdapter.test.js` |

## 6. Threats, Mitigations, and Residual Risk

### T1 — Hidden or residual admin control

Threat: deployer EOA keeps minting, pausing, ownership, treasury, or timelock authority after a production deploy.

Mitigations:

- `scripts/lib/deployment-policy.js` rejects production deploys without a valid multisig and rejects multisig equal to deployer.
- `scripts/lib/handover.js` grants roles to multisig before revoking deployer roles.
- `auditDeployerResidual` must pass before production deployment is considered valid.
- `DeploymentPolicy.test.js` covers deployment-policy and handover behavior.

Residual risk: real Safe owner set and actual post-deploy on-chain roles still need Base Sepolia rehearsal and manifest verification.

### T2 — Governance capture or governance theater

Threat: a whale or concentrated treasury allocation passes proposals, or the project claims decentralization while multisig remains the real control plane.

Mitigations:

- ERC20Votes snapshots prevent same-block vote inflation from simple balance movement.
- Voting delay and Timelock delay create a review window.
- Phase 11 tests cover threshold rejection, pending state, defeated proposals, cancellation, invalid queue/execute states, delay boundary, and duplicate votes.
- Public docs describe the current admin model as Safe/multisig first, not fully decentralized.

Residual risk: token concentration and quorum calibration remain economic/governance risks until real distribution and delegation data exists.

### T3 — Sale entitlement loss

Threat: buyers pay but cannot claim, failed phases do not refund correctly, or owner withdraws/recover funds that back buyer obligations.

Mitigations:

- `purchasedTokens`, `contributions`, `totalUnclaimedTokens`, and `withdrawableRaisedWei` separate obligations from owner-withdrawable balances.
- Refunds are per phase, not a single global latch.
- `SafeERC20` is used for token transfers.
- Phase 9 tests include hard-cap/allocation rejects, claim/refund rejects, successful ETH flows, and ERC20 payment-token flows.

Residual risk: launch-time Merkle lists, jurisdiction controls, and user eligibility remain operational/legal issues.

### T4 — Staking reward insolvency

Threat: staking advertises rewards that the contract cannot actually pay, or reward accounting spends user principal.

Mitigations:

- Reward backing excludes principal tracked by `totalStaked`.
- `reservedRewards` and `rewardEndTime` make programs finite and explicitly funded.
- Tests cover insufficient reward backing, accrual stopping at program end, compounding, unstake, and emergency unstake.

Residual risk: emission economics may still be unsustainable even when the contract is solvent. See `docs/10-production-candidate-readiness.md`.

### T5 — Vesting owner grief or obligation drain

Threat: owner revokes schedules in a way that strands vested funds, or emergency recovery drains tokens owed to beneficiaries.

Mitigations:

- Revocation transfers vested-but-unreleased tokens to the beneficiary first.
- `totalOutstanding` blocks emergency withdrawal below obligations.
- Phase 10 tests cover constructor, schedule validation, owner gates, cliff, release, revoke, full vesting, and protected-balance edges.

Residual risk: revocable schedules are still a governance/product trust decision. Beneficiaries must understand whether their schedule is revocable.

### T6 — Lock vault misrepresentation or unbounded growth

Threat: users believe the lock vault is veCRV-style decaying vote escrow, or withdrawn lock records grow without bound.

Mitigations:

- The contract and docs use `WLABLockVault`, not `veToken`.
- Voting power is fixed at lock time and explicitly non-decaying.
- Withdraw uses swap-and-pop compaction.
- Tests cover fixed voting power, gauge vote accounting, over-allocation prevention, and compaction.

Residual risk: public communication must keep avoiding "ve" or "vote escrow" claims that imply continuous decay.

### T7 — Treasury upgrade abuse

Threat: an authorized upgrader deploys malicious treasury implementation or breaks storage layout.

Mitigations:

- UUPS upgrade requires `UPGRADER_ROLE`.
- Proxy tests prove implementation initialization is blocked, unauthorized upgrades revert, and storage persists across V2 upgrade.
- Operations runbook requires storage layout notes and timelock queue/execute ceremony.

Residual risk: storage layout review and decoded upgrade calldata are still human process requirements.

### T8 — Bridge misuse

Threat: the disabled adapter is mistaken for production bridge infrastructure or enabled on a public deployment.

Mitigations:

- `WLABOFTAdapter` is documented as a stub.
- Production Base deploy gates OFT deployment unless `DEPLOY_OFT=true`.
- Bridge tests cover disabled-by-default guardrails and replay protection.

Residual risk: real cross-chain support remains blocked until audited LayerZero OFT v2 or a different audited bridge design replaces the stub.

### T9 — Frontend/address spoofing or stale public state

Threat: users interact with wrong addresses, stale deployment manifests, stale CSS/JS, or UI copy that overstates the project status.

Mitigations:

- Static build adds cache-busting hashes to CSS/JS assets.
- README and site language state "testnet candidate, audit pending, mainnet blocked."
- Address-registry and signed-manifest work is explicitly planned before launch.

Residual risk: until Phase 17/22, production address display is not yet manifest-driven end-to-end.

### T10 — MEV, front-running, and sale fairness

Threat: public sale buys are ordered by mempool dynamics, allowing faster buyers or bots to capture scarce allocation.

Mitigations:

- Per-wallet caps, Merkle allowlists, hard caps, and soft caps reduce damage.
- Refund flows handle failed phases.

Residual risk: there is no commit-reveal sale flow. If the launch requires stronger fairness guarantees, add a separate audited mechanism rather than stretching the current sale contract.

## 7. Emergency Actions

| Incident | First action | Authority | Follow-up |
| --- | --- | --- | --- |
| Token transfer or compliance incident | Pause token | `PAUSER_ROLE` | Publish incident note, diagnose, unpause only after fix |
| Sale accounting issue | Stop phase progression and withhold withdrawals | Sale owner / Safe | Snapshot contributions and prepare remediation proposal |
| Staking reward issue | Stop new reward program changes | Staking owner / Safe | Verify principal, reserved rewards, pending rewards |
| Malicious queued governance payload | Cancel queued operation | Governor/Timelock canceller | Publish decoded calldata and replacement proposal if needed |
| Treasury upgrade concern | Do not execute queued upgrade | Timelock review window | Independent storage layout review |
| Bridge concern | Keep `bridgeEnabled == false` | Adapter owner / Safe | Do not enable until audited replacement |
| Frontend/address issue | Pull or correct published manifest/site | Frontend operator | Announce affected window and verified contract addresses |

All emergency actions must be recorded with timestamp, role used, triggering transaction/report, funds at risk, remediation transaction, and postmortem. See `docs/11-operations-runbook.md`.

## 8. Mainnet Blockers

The following remain blockers even after this threat model:

1. External smart contract audit and remediation.
2. Public bug bounty after audit remediation.
3. Base Sepolia rehearsal with real Safe address and residual-authority manifest verification.
4. Basescan verification ceremony and signed deployment manifest.
5. Real bridge decision: remove the stub from launch scope or replace it with audited OFT v2.
6. Legal/compliance review for token sale and public communications.
7. Liquidity plan and token concentration disclosure.
8. Launch-time monitoring, incident contacts, and public status channel.

## 9. Auditor Questions

- Are sale obligations fully protected across every finalize/refund/claim/recover interleaving?
- Can any privileged role remain with the deployer after `scripts/deploy.js` succeeds on `base` or `baseSepolia`?
- Does the token fee path preserve ERC20Votes invariants under fee-exempt, burn-share, pause, max-wallet, blacklist, and whitelist combinations?
- Are staking reward reserves sufficient under compound, claim, unstake, emergency unstake, and reward-program rollover paths?
- Can lock-vault gauge accounting be overcommitted through multi-lock withdraw and vote replacement sequences?
- Are Governor and Timelock state transitions correctly enforced for canceled, defeated, queued, expired, mismatched payload, and early execution states?
- Does the UUPS treasury preserve storage and block unauthorized upgrades under realistic proxy deployment?
- Is the OFT adapter safely isolated from production, or should it be removed entirely until a real bridge implementation exists?
