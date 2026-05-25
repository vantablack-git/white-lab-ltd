# ADR 0003: Funded Finite Staking Rewards

Status: Accepted

## Context

An unbounded `rewardRatePerSecond` can promise rewards the staking contract does not hold. When staking and reward token are the same asset, user principal must not be counted as reward inventory.

## Decision

`WLABStaking` uses finite reward programs:

- `setRewardRate(rate)` keeps the existing interface but maps to a default 365-day funded program.
- `setRewardProgram(rate, duration)` allows explicit finite programs.
- `totalStaked` tracks user principal.
- `reservedRewards` tracks accrued but unpaid rewards.
- Reward backing excludes `totalStaked` when `stakingToken == rewardToken`.
- Accrual stops at `rewardEndTime`.

## Consequences

- Operators must fund rewards before enabling emissions.
- Staking can no longer silently promise unfunded future rewards.
- The accounting is easier to audit because user principal and reward backing are separated.
