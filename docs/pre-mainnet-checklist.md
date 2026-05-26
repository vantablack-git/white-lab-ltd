# Pre-Mainnet Checklist

Mainnet remains blocked until every item below is closed with evidence.

## Security

- [ ] External smart contract audit completed and remediated
- [ ] Public bug bounty live post-audit
- [ ] Latest Slither SARIF/JSON archived from CI
- [ ] Threat model V2 reviewed against final code (`docs/13-threat-model.md`)
- [ ] Audit prep package frozen to a single commit hash (`docs/audit-prep.md`)

## Operations

- [ ] Base Sepolia rehearsal with real Safe/multisig completed
- [ ] Residual deployer authority audit passed on-chain
- [ ] All contracts verified on Basescan
- [ ] Signed or checksum-published manifest on site
- [ ] Operations runbook V2 ceremony rehearsed

## Product / Surface

- [ ] Address registry shows live manifest with copy + explorer links
- [ ] Console chain guard tested on Base Sepolia
- [ ] Tokenomics dashboard driven by `shared/tokenomics.json`
- [ ] Turkish `/tr/` page reviewed for calibrated claims
- [ ] SEO/OG metadata present on public pages

## Governance / Economics

- [ ] Safe signer set verified out-of-band
- [ ] Token concentration and quorum sensitivity disclosed
- [ ] Bridge decision finalized: remove stub from mainnet scope or ship audited OFT v2
- [ ] Liquidity and market-making plan approved outside codebase

## Legal / Comms

- [ ] Legal/compliance review for sale participation
- [ ] Public status channel and incident contacts defined
- [ ] No "audit-ready" or "mainnet-ready" language in public copy
