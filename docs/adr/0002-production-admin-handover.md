# ADR 0002: Production Deploys Must Enforce Multisig Handover

Status: Accepted

## Context

Manual post-deploy handover is easy to forget. If a production deploy exits successfully while the deployer EOA still holds token admin roles, Ownable ownerships, timelock admin, or upgrade authority, the protocol has a hidden single-key control path.

## Decision

`scripts/deploy.js` enforces the production end state on `base` and `baseSepolia`:

- `MULTISIG_ADDRESS` is mandatory.
- `MULTISIG_ADDRESS` must differ from the deployer EOA.
- The deployer is stripped of privileged token roles, Ownable ownerships, and timelock admin before the script exits successfully.
- The script audits residual deployer authority and fails if any remains.
- The OFT adapter is skipped on Base mainnet unless `DEPLOY_OFT=true` is explicit.

## Consequences

- Production deploys are stricter and less convenient.
- Operators must prepare the Safe/multisig before deployment.
- Successful production deployment means the manifest and on-chain authority state agree.
