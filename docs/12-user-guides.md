# WhiteLab User Guides

## IDO Participation

1. Connect a wallet on Base Sepolia or the configured demo network.
2. Confirm the active phase and token price.
3. Enter WLAB amount.
4. Submit purchase transaction with the required ETH amount.
5. After successful finalization, claim purchased tokens.
6. If the sale fails the soft cap, use refund instead of claim.

Risks: purchases are not claimable until finalization, refunds require failed finalization, whitelist phases require valid Merkle proof support, and mainnet sale should not open before external audit and legal review.

## Staking

1. Approve WLAB to staking contract.
2. Choose a tier: 30, 90, 180, or 365 days.
3. Stake amount.
4. Rewards accrue by weighted stake.
5. Claim rewards or unstake after lock expiry.
6. Emergency withdrawal is available but applies a 10% penalty.

Important invariant: a wallet has one active staking position. Additional deposits must use the same tier.

## veWLAB Locking

1. Approve WLAB to veToken contract.
2. Choose lock duration between 7 days and 4 years.
3. Voting power is `amount * duration / MAX_LOCK`.
4. Gauge votes set absolute weight per gauge.
5. Reduce active gauge votes before withdrawing a lock if withdrawal would overcommit voting power.

veWLAB is not yet wired into Governor. It is a gauge/vote-escrow module, not the current DAO voting token.

## Governance

1. Hold WLAB.
2. Delegate votes to yourself or a delegate.
3. Submit proposal if above proposal threshold.
4. Vote during voting period.
5. Queue successful proposal in Timelock.
6. Execute only after Timelock delay.

The current tests prove the happy path. Production governance also needs defeat, cancel, and malicious payload coverage.

## Treasury Transparency

Treasury UUPS has role-gated withdrawals and upgrades. It is tested through proxy, but the main deploy script does not yet deploy the treasury proxy. Mainnet treasury must be controlled by Safe/Timelock, not an EOA.
