# Basescan Verification Ceremony

Use after a successful Base Sepolia or Base mainnet deploy.

## Preconditions

- `deployments/<network>.json` exists with contract addresses
- `ETHERSCAN_API_KEY` set in `.env`
- Deploy manifest shows `adminHandover.deployerRevoked: true` on production networks

## Steps

1. Run `npm run env:check` or `npm run env:check:base`.
2. Run `npm run verify` (Sepolia) or `npm run verify:base`.
3. Confirm each contract on Basescan:
   - WLABToken
   - WLABVesting
   - WLABStaking
   - TimelockController
   - WLABGovernor
   - WLABTokenSale
   - WLABLockVault
   - WLABTreasuryUUPS proxy (implementation + proxy)
   - WLABOFTAdapter only if present in manifest
4. Record verified URLs in the deployment manifest notes or release log.
5. Run `npm run publish:manifest -- hardhat` or network key after any manifest update.
6. Run `npm run build:site` and confirm `/public/deployments.json` checksum in `public/deployments.meta.json`.

## Failure Handling

- "Already Verified" is acceptable.
- Constructor argument mismatch means redeploy or manual verification with corrected args.
- Do not mark Phase 16 complete until every in-scope production contract has a public source match on Basescan.
