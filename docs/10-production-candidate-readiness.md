# WhiteLab Production Candidate Readiness

Date: 2026-05-24

This document is intentionally conservative. WhiteLab is a stronger production candidate after the finalization pass, but it is not mainnet-ready until the remaining launch gates are closed.

## Architecture Summary

| Layer | Contract | Current status |
|-------|----------|----------------|
| Token | `WLABToken` | ERC20, Permit, Votes, fee controls, pause, blacklist, whitelist, fee exemptions |
| IDO | `WLABTokenSale` | Multi-phase ETH/ERC20 sale, Merkle gating, claim, refund, safe unsold recovery |
| Vesting | `WLABVesting` | Single schedule per beneficiary, cliff, linear release, revocation |
| Staking | `WLABStaking` | Single active position per wallet, weighted tiers, reward debt accounting |
| Governance | `WLABGovernor` + `TimelockController` | OZ Governor lifecycle validated in tests |
| Governance lock vault | `WLABLockVault` | Weighted governance lock with fixed (non-decaying) voting power and gauge weights, not yet integrated into Governor |
| Bridge | `WLABOFTAdapter` | Stub only, disabled by default, not production bridge infrastructure |
| Treasury | `WLABTreasuryUUPS` | UUPS proxy deployed by `scripts/deploy.js`; Safe role handover still required |

## State Invariants

| Invariant | Validation |
|-----------|------------|
| `WLABToken.totalSupply() <= 1B WLAB` | Unit tests and capped mint logic |
| Fee-bearing transfers keep ERC20Votes aligned with balances | Regression test covers sender, receiver, treasury |
| Sale obligations are not recoverable by owner | `totalUnclaimedTokens` accounting and invariant test |
| Staking `totalWeightedStake` equals active position weights | Invariant test after multiple stake/unstake transitions |
| ve gauge weight cannot exceed user voting power | Unit tests for repeated and cross-gauge voting |
| Timelock delay gates Governor execution | Full propose/vote/queue/execute test |
| UUPS upgrades require `UPGRADER_ROLE` and preserve storage | Proxy upgrade test with V2 implementation |
| OFT stub cannot be used accidentally | Bridge disabled by default; explicit enable required |

## Security Maturity

Current maturity: **testnet candidate, not audited**.

| Area | Score | Notes |
|------|-------|-------|
| Unit/integration coverage | 7/10 | Core flows are covered; coverage target still below 95% |
| Governance lifecycle | 7/10 | Happy-path Timelock execution covered; cancellation/defeat paths need tests |
| Upgradeability | 6/10 | UUPS proxy test added; deployment pipeline still omits treasury proxy |
| Bridge safety | 3/10 | Stub disabled by default, but real LayerZero OFT is not implemented |
| Admin hardening | 4/10 | Roles exist; Safe/timelock handover not executed |
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

Open gap: deploy script does not yet deploy an ERC1967 proxy for treasury. Treat treasury as a tested module, not deployed production infrastructure.

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

Marketing site at `/` (AI-styled landing, tokenomics, live address registry) and protocol console at `/app` (wallet, IDO, staking, veLock, governance, chain guard, Merkle proof input).

Host via `npm run start` (port 4173) or static export to Cloudflare Pages / GitHub Pages at $0.

## Deployment Reproducibility

| Check | Status |
|-------|--------|
| Hardhat compile | Passing |
| Tests | Passing |
| Local E2E script | Passing |
| Hardhat deploy dry run | Passing |
| Env validation script | Added |
| GitHub Actions CI | Added |
| Base Sepolia deploy | Not executed |
| Mainnet deploy | Not approved |

## Mainnet Readiness Estimate

Current estimate: **72 / 100** for testnet/demo readiness, **55 / 100** for mainnet readiness.

Blocking risks:

- No external audit.
- Slither/static analysis not run in this environment.
- Coverage below 95%.
- Treasury proxy not deployed by main deploy script.
- OFT bridge is a disabled stub.
- Admin handover to Safe/Timelock not executed.
- Legal/compliance review not complete.
- Liquidity and market-maker assumptions are not validated.

## Roadmap After Testnet Launch

1. Deploy to Base Sepolia with Safe treasury.
2. Run Slither and fix Critical/High/Medium findings.
3. Add defeat/cancel/late-quorum governance tests.
4. Add coverage for Treasury deploy script and proxy manifest.
5. Replace `WLABOFTAdapter` with real LayerZero OFT v2 implementation.
6. Add allocation dashboard backed by real vesting schedules.
7. Run external audit.
8. Run public bug bounty after audit remediation.
