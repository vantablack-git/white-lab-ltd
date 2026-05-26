# White Lab Gas Budget

This document records the current gas envelope for the protocol's critical user and operator paths. It is a regression budget, not a promise that every future interaction will match these exact numbers under different calldata, storage warmness, fork rules, or production deployment conditions.

## Measurement

- Command: `npm run gas`
- Underlying runner: `REPORT_GAS=true hardhat test`
- Compiler: Solidity `0.8.26`
- Optimizer: enabled, `200` runs
- IR pipeline: `viaIR: true`
- EVM: Cancun
- Measurement date: 2026-05-26
- Verification result: `192 passing`

Budgets are set above the observed max where the test suite exercises variable-cost branches. If a future change exceeds a budget, treat it as an intentional review point: either optimize the path or update this file with a short explanation.

## Critical Method Budgets

| Contract | Method | Observed max gas | Budget |
| --- | ---: | ---: | ---: |
| `WLABToken` | `transfer` | 226,393 | 250,000 |
| `WLABToken` | `mint` | 127,683 | 145,000 |
| `WLABToken` | `delegate` | 95,933 | 110,000 |
| `WLABToken` | `approve` | 46,115 | 55,000 |
| `WLABToken` | `pause` | 47,438 | 60,000 |
| `WLABTokenSale` | `buy` | 227,035 | 250,000 |
| `WLABTokenSale` | `configurePhase` | 147,970 | 170,000 |
| `WLABTokenSale` | `claim` | 87,565 | 100,000 |
| `WLABTokenSale` | `finalizeSale` | 89,643 | 105,000 |
| `WLABTokenSale` | `recoverUnsoldTokens` | 81,276 | 95,000 |
| `WLABTokenSale` | `refund` | 77,056 | 90,000 |
| `WLABTokenSale` | `withdrawFunds` | 75,601 | 90,000 |
| `WLABStaking` | `stake` | 203,301 | 230,000 |
| `WLABStaking` | `unstake` | 154,212 | 180,000 |
| `WLABStaking` | `emergencyUnstake` | 152,252 | 180,000 |
| `WLABStaking` | `claimReward` | 143,076 | 170,000 |
| `WLABStaking` | `setRewardRate` | 86,124 | 100,000 |
| `WLABLockVault` | `createLock` | 193,729 | 220,000 |
| `WLABLockVault` | `voteGauge` | 94,630 | 115,000 |
| `WLABLockVault` | `withdraw` | 89,416 | 105,000 |
| `WLABVesting` | `createSchedule` | 153,128 | 175,000 |
| `WLABVesting` | `revoke` | 125,682 | 150,000 |
| `WLABVesting` | `release` | 109,582 | 130,000 |
| `WLABVesting` | `emergencyWithdraw` | 72,370 | 90,000 |
| `WLABGovernor` | `queue` | 144,472 | 170,000 |
| `WLABGovernor` | `execute` | 110,014 | 135,000 |
| `WLABGovernor` | `castVote` | 83,777 | 100,000 |
| `WLABGovernor` | `propose` | 76,222 | 95,000 |
| `WLABGovernor` | `cancel` | 43,888 | 60,000 |
| `WLABTreasuryUUPSV2` | `withdraw` | 82,823 | 100,000 |
| `WLABTreasuryUUPSV2` | `setFeeSwitch` | 52,254 | 65,000 |
| `WLABTreasuryUUPSV2` | `upgradeToAndCall` | 37,237 | 55,000 |

## Deployment Budgets

| Contract | Observed max gas | Budget |
| --- | ---: | ---: |
| `WLABGovernor` | 3,468,655 | 3,800,000 |
| `WLABToken` | 3,310,738 | 3,650,000 |
| `WLABTokenSale` | 1,686,034 | 1,900,000 |
| `WLABStaking` | 1,425,979 | 1,650,000 |
| `TimelockController` | 1,331,609 | 1,550,000 |
| `WLABTreasuryUUPSV2` | 961,339 | 1,150,000 |
| `WLABTreasuryUUPS` | 942,740 | 1,150,000 |
| `WLABVesting` | 896,541 | 1,100,000 |
| `WLABLockVault` | 812,132 | 1,000,000 |
| `WLABOFTAdapter` | 505,416 | 700,000 |
| `WLABERC1967Proxy` | 215,474 | 300,000 |

## Review Rules

- User-facing hot paths (`transfer`, `buy`, `stake`, `createLock`, `claim`, `refund`) should not exceed budget without a clear product or security reason.
- Operator paths may spend more gas when doing so simplifies auditability or preserves stronger invariants.
- Governance execution gas depends on the target payload. The budget above only covers the current tested `pause()` payload.
- Storage growth-sensitive paths must remain bounded by design. `WLABLockVault.withdraw()` is expected to stay bounded because withdrawn locks are compacted with swap-and-pop.
