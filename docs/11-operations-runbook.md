# WhiteLab Operations Runbook

> **Runbook V2 additions:** manifest publish (`npm run publish:manifest`), Basescan ceremony (`docs/internal/BASESCAN-VERIFICATION.md`), pre-mainnet checklist (`docs/pre-mainnet-checklist.md`), and RC-2 validation (`docs/internal/RC2-VALIDATION.md`).

## Deployment Ceremony

1. Freeze release branch and tag candidate.
2. Run `npm ci`.
3. Run `npm run validate`.
4. Run `npm run coverage` and confirm coverage target for the release.
5. Run `npm run env:check` or `npm run env:check:base`.
6. Verify deployer wallet, Safe address, RPC endpoint, and Basescan API key.
7. Dry-run on Hardhat: `npx hardhat run scripts/deploy.js --network hardhat`.
8. Deploy to Base Sepolia.
9. Verify contracts with `npm run verify`.
10. Execute IDO buy/finalize/claim and failed-sale refund testnet scenarios.
11. Record addresses in `deployments/baseSepolia.json`.
12. Publish a signed deployment manifest.

## Role Handover

Production deploys on `base` and `baseSepolia` enforce handover inside `scripts/deploy.js`. A deploy must not be considered successful unless `adminHandover.deployerRevoked == true` is present in the manifest and the residual-authority audit passes.

- `DEFAULT_ADMIN_ROLE` on `WLABToken` must move from deployer to Safe or Timelock.
- `PAUSER_ROLE` should be held by emergency Safe.
- Sale, staking, vesting, OFT (if deployed), and lock-vault owner roles should be transferred to Safe or Timelock.
- Timelock `PROPOSER_ROLE` and `CANCELLER_ROLE` should be Governor.
- Timelock `EXECUTOR_ROLE` can be open if execution payloads are fully timelocked.
- Deployer should retain no unilateral mint, pause, withdraw, or upgrade power.

Standalone recovery/idempotent re-run:

```bash
MULTISIG_ADDRESS=0x... npm run handover:multisig -- --network baseSepolia
```

## Upgrade Procedure

1. Write new implementation and storage layout note.
2. Verify no storage variable reorder or type change.
3. Add proxy upgrade tests that prove old storage survives.
4. Deploy implementation.
5. Queue `upgradeToAndCall` through Timelock.
6. Wait delay.
7. Execute upgrade.
8. Verify implementation slot and post-upgrade state.
9. Publish upgrade report.

## Emergency Procedure

| Severity | Examples | Response |
|----------|----------|----------|
| Critical | Supply inflation, fund drain, governance bypass | Pause affected modules, announce incident, prepare patched deployment or governance action |
| High | Claim/refund accounting error, privileged role misconfiguration | Freeze sale/admin actions, snapshot balances, remediation proposal |
| Medium | UI misreporting, non-critical stuck flow | Patch frontend/docs, no contract action unless needed |
| Low | Documentation or operational issue | Backlog |

Emergency actions must be logged with timestamp, triggering transaction or report, impacted contracts, user funds at risk, role used, remediation transaction, and postmortem.

## Bridge Policy

`WLABOFTAdapter` is a stub and is disabled by default. Do not enable it on public deployments except in isolated demos. Production cross-chain support requires audited LayerZero OFT v2 implementation, verified remote adapter mapping, replay protection, endpoint authorization, rate limits, emergency disable switch, and separate bridge risk disclosure.

## Release Checklist

- [ ] `npm run validate` passing
- [ ] `npm run coverage` meets release threshold
- [ ] Slither run attached
- [ ] Deployment manifest reviewed
- [ ] Safe owners verified
- [ ] Timelock roles verified
- [ ] Manifest `adminHandover.deployerRevoked` is true on production networks
- [ ] Frontend points to verified manifests
- [ ] Emergency contacts confirmed
- [ ] Known risks updated
