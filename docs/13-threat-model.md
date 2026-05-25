# WhiteLab Threat Model

## 1. Trust Assumptions

| Actor | Deploy-time power | Post-multisig target |
|-------|-------------------|----------------------|
| Deployer EOA | Mint, pause, configure sale, own vesting/staking/sale | Revoked; Safe holds admin |
| Gnosis Safe (4/7) | — | DEFAULT_ADMIN, ownership, timelock admin |
| Timelock | 48h+ delay on governance execution | Queued privileged ops |
| Buyers | Purchase, claim, refund per sale rules | No protocol admin |
| OFT operator | Can enable stub bridge if misused | Bridge disabled until audited OFT v2 |

## 2. Attack Surfaces

### Governance capture
- Flash-loan vote inflation mitigated by ERC20Votes checkpoints and voting delay.
- Residual: concentrated supply can dominate quorum (4% of total supply).

### IDO manipulation
- Front-running public buys on mempool.
- Mitigations: per-wallet caps, Merkle whitelist, soft/hard caps.
- Residual: no commit-reveal (roadmap).

### Staking drain
- Incorrect reward accounting.
- Mitigations: reward debt pattern, invariant tests on `totalWeightedStake`.

### Vesting grief
- Owner revokes revocable schedules.
- Mitigations: documented schedules; beneficiary monitoring.

### Bridge stub
- Owner enables `WLABOFTAdapter` and bridges incorrectly.
- Mitigations: disabled by default; production requires LayerZero OFT audit.

### Treasury upgrade
- Malicious UUPS implementation.
- Mitigations: `UPGRADER_ROLE` on Safe; upgrade tests; timelock-gated upgrades on mainnet.

## 3. Mitigations In Place

- P0 sale accounting (`purchasedTokens`, `totalUnclaimedTokens`)
- Fee-exempt sale + staking contracts in deploy script
- Timelock proposer/canceller on Governor
- SafeERC20 on sale, staking, vesting, treasury
- Refund sync on `tokensSold` / `totalRaisedWei`

## 4. Residual Risks (External Audit)

- Full Governor defeat/cancel edge cases
- Economic sustainability under low protocol revenue
- Legal/compliance for IDO in target jurisdictions
- Real cross-chain OFT integration

## 5. Emergency Procedures

1. **Pause token** — `PAUSER_ROLE` on `WLABToken`
2. **Disable bridge** — ensure `bridgeEnabled == false` on OFT adapter
3. **Cancel timelock op** — `CANCELLER_ROLE` (Governor)
4. **Communicate** — status page + on-chain event monitoring
