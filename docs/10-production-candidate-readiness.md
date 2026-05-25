# WhiteLab Production Candidate Readiness

Date: 2026-05-24

This document is intentionally conservative. WhiteLab is a stronger production candidate after the finalization pass, but it is not mainnet-ready until the remaining launch gates are closed.

## Architecture Summary

| Layer | Contract | Current status |
|-------|----------|----------------|
| Token | `WLABToken` | ERC20, Permit, Votes, fee controls, pause, blacklist, whitelist, fee exemptions |
| IDO | `WLABTokenSale` | Multi-phase ETH/ERC20 sale, Merkle gating, claim, refund, safe unsold recovery |
| Vesting | `WLABVesting` | Single schedule per beneficiary, cliff, linear release, revocation |
| Staking | `WLABStaking` | Single active position per wallet, weighted tiers, funded finite reward programs |
| Governance | `WLABGovernor` + `TimelockController` | OZ Governor lifecycle validated in tests |
| Governance lock vault | `WLABLockVault` | Weighted governance lock with fixed (non-decaying) voting power, gauge weights, and compacted lock storage |
| Bridge | `WLABOFTAdapter` | Stub only, disabled by default, not production bridge infrastructure |
| Treasury | `WLABTreasuryUUPS` | UUPS proxy deployed by `scripts/deploy.js`; production deploy enforces multisig role handover |

## State Invariants

| Invariant | Validation |
|-----------|------------|
| `WLABToken.totalSupply() <= 1B WLAB` | Unit tests and capped mint logic |
| Fee-bearing transfers keep ERC20Votes aligned with balances | Regression test covers sender, receiver, treasury |
| Sale obligations are not recoverable by owner | `totalUnclaimedTokens` accounting and invariant test |
| Staking rewards cannot consume user principal | `totalStaked`, `reservedRewards`, finite program tests |
| Staking `totalWeightedStake` equals active position weights | Regression tests after stake/top-up/unstake/compound paths |
| Lock vault gauge weight cannot exceed user voting power | Unit tests for repeated and cross-gauge voting |
| Withdrawn lock records do not grow unbounded | Swap-and-pop compaction test |
| Timelock delay gates Governor execution | Full propose/vote/queue/execute test |
| UUPS upgrades require `UPGRADER_ROLE` and preserve storage | Proxy upgrade test with V2 implementation |
| OFT stub cannot be used accidentally | Bridge disabled by default; explicit enable required |

## Security Maturity

Current maturity: **testnet candidate, not audited**.

| Area | Score | Notes |
|------|-------|-------|
| Unit/integration coverage | 8/10 | Core flows and recent blocker regressions are covered; coverage target still below 95% |
| Governance lifecycle | 7/10 | Happy-path Timelock execution covered; cancellation/defeat paths need tests |
| Upgradeability | 7/10 | UUPS proxy test added; production-named proxy deployed by pipeline |
| Bridge safety | 3/10 | Stub disabled by default, but real LayerZero OFT is not implemented |
| Admin hardening | 7/10 | Production deploy now requires multisig and refuses residual deployer authority |
| Static analysis | 2/10 | Slither unavailable in local environment |
| Documentation | 8/10 | Trust assumptions and runbooks are now explicit |

## Governance Maturity

The Governor can propose, vote, queue, wait the Timelock, and execute privileged token operations in tests. Governance is still vulnerable to concentration until final supply distribution and delegation patterns are known.

Sensitivity model:

- Quorum is 4% of token supply at snapshot.
- With 1B max supply, full-supply quorum is 40M WLAB.
- If only 88.5M WLAB circulates at TGE, 40M votes would equal 45.2% of circulating supply.
- If quorum is based on checkpointed total supply rather than circulating float, early governance can be under-participated or dominated by large holders.

Recommendation: keep critical admin under Safe + Timelock first, then phase in DAO control after distribution and delegation metrics are observable.

## Upgradeability Assessment

`WLABTreasuryUUPS` uses OZ UUPS and role-gated `_authorizeUpgrade`. The proxy test proves implementation initializers are disabled, proxy initialization grants roles, unauthorized upgrades revert, and storage persists across upgrade.

Open gap: treasury upgrade ceremonies still need release-time review, storage layout notes, and multisig/timelock transaction records.

## Economic Sustainability

Supply cap: 1,000,000,000 WLAB.

Documented TGE float: 88.5M WLAB, or 8.85% of supply.

Staking emissions: 180M WLAB over 60 months = 3M WLAB/month. Relative to TGE float:

```text
3M / 88.5M = 3.39% of initial circulating supply per month
36M / 88.5M = 40.68% of initial circulating supply per year
```

This is high unless staking locks absorb a large portion of float and protocol demand grows quickly. The model assumes rising protocol revenue and buybacks; those are not guaranteed. If monthly buyback burns are below emissions plus unlocks, net sell pressure remains positive.

Concentration risk:

- Team + advisors: 17%.
- Treasury + ecosystem + staking rewards: 50%.
- Launch allocations and liquidity: 29%.
- Community airdrop: 4%.

The protocol needs transparent vesting, Safe custody, and public allocation dashboards before investor or exchange review.

## Frontend/Demo Readiness

Marketing site at `/` (landing page, tokenomics, live address registry) and protocol console at `/app` (wallet, IDO, staking, governance lock, governance, chain guard, Merkle proof input).

Host via `npm run start` (port 4173) or static export to Cloudflare Pages / GitHub Pages at $0.

## Deployment Reproducibility

| Check | Status |
|-------|--------|
| Hardhat compile | Passing |
| Tests | Passing (`79 passing` as of Phase 5) |
| Local E2E script | Passing |
| Hardhat deploy dry run | Passing |
| Env validation script | Added |
| GitHub Actions CI | Added |
| Base Sepolia deploy | Not executed |
| Mainnet deploy | Not approved |

## Mainnet Readiness Estimate

Current estimate: **80 / 100** for testnet/demo readiness, **62 / 100** for mainnet readiness.

Blocking risks:

- No external audit.
- Slither/static analysis not run in this environment.
- Coverage below 95%.
- OFT bridge is a disabled stub.
- Production Safe/timelock ownership must be verified on the actual deployed manifest.
- Legal/compliance review not complete.
- Liquidity and market-maker assumptions are not validated.

## Roadmap After Testnet Launch

1. Deploy to Base Sepolia with Safe/multisig address configured.
2. Run Slither and fix Critical/High/Medium findings.
3. Add defeat/cancel/late-quorum governance tests.
4. Add release coverage/reporting for Treasury proxy manifest and upgrade ceremony.
5. Replace `WLABOFTAdapter` with real LayerZero OFT v2 implementation.
6. Add allocation dashboard backed by real vesting schedules.
7. Run external audit.
8. Run public bug bounty after audit remediation.
