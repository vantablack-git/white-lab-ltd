# ADR 0001: Governance Lock Vault Naming

Status: Accepted

## Context

The original governance lock contract was presented with veToken-style language, but its voting power does not decay over time. A veCRV-style vote escrow requires continuous decay, epoch accounting, and different UX/analytics expectations.

## Decision

WhiteLab uses `WLABLockVault`: a weighted governance lock vault with fixed voting power at lock creation.

Voting power is:

```text
amount * lockDuration / MAX_LOCK
```

The value does not decay. It becomes unavailable only when the lock is withdrawn after unlock, and active gauge votes must be cleared before withdrawal.

## Consequences

- Public copy must not describe the system as vote escrow, veCRV, decaying voting power, or veToken economics.
- A future decaying vote escrow would be a separate engineered protocol, not a rename or retrofit.
- UI and docs should use "governance lock", "weighted lock", or `WLABLockVault`.
