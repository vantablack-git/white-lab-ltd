# Base Sepolia Rehearsal Log

Status: **blocked before deploy**.

Date: 2026-05-26

This log records the Phase 15 deployment rehearsal state. No Base Sepolia transaction was sent because the environment preflight failed before deploy.

## Preflight Command

```bash
npm run env:check
```

## Result

Environment validation failed. Missing required values:

- `PRIVATE_KEY`
- `BASE_SEPOLIA_RPC`
- `ETHERSCAN_API_KEY`
- `TREASURY_ADDRESS`
- `MULTISIG_ADDRESS`

The rehearsal must not proceed without a real deployer key, Base Sepolia RPC endpoint, Basescan API key, treasury fee receiver, and a non-zero multisig/Safe address that differs from the deployer EOA.

## Guardrail Added

`scripts/validate-env.js` now loads `.env` and validates `MULTISIG_ADDRESS` for `baseSepolia` and `base`, matching the production-network invariant enforced by `scripts/deploy.js`.

## Required Next Attempt

After setting the required environment variables:

```bash
npm run env:check
npm run deploy:sepolia
```

Expected success criteria:

- `deployments/baseSepolia.json` exists.
- `deployments/base-sepolia.json` exists.
- `public/deployments.json` includes the `baseSepolia` manifest.
- Manifest contains `adminHandover.deployerRevoked: true`.
- Manifest records the configured multisig as `multisig` and `treasuryProxyAdmin`.
- `WLABOFTAdapter` is deployed only as a disabled stub on Base Sepolia.
- Deployer retains no privileged token role, Ownable ownership, timelock admin, treasury spender, or treasury upgrader authority.

## Verification After Deploy

```bash
npm test
npm run e2e:local
```

Then proceed to Phase 16 for Basescan verification.
