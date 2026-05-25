# BÖLÜM 4 — AKILLI SÖZLEŞME GELİŞTİRME

---

## 4.1 Geliştirme Ortamı Kurulumu

### Gereksinimler

- Node.js ≥ 18, npm ≥ 9
- Git
- (Opsiyonel) Foundry

### Kurulum

```bash
git clone <repo>
cd whitelab
npm install
cp .env.example .env
npx hardhat compile
```

### Klasör Yapısı

```
contracts/     # Solidity kaynak
test/          # Mocha/Chai testleri
scripts/       # deploy.js, verify.js
deployments/   # Ağ bazlı adres JSON
hardhat.config.js
```

`hardhat.config.js` — Base Sepolia (84532) ve Base (8453) tanımlı; optimizer 200 runs, viaIR.

---

## 4.2–4.6 Sözleşme Referansları

| Sözleşme | Dosya | Özellikler |
|----------|-------|------------|
| **$WLAB Token** | [`WLABToken.sol`](../contracts/WLABToken.sol) | ERC20, Permit, Votes, Snapshot, Pausable, roles, fee, blacklist |
| **Vesting** | [`WLABVesting.sol`](../contracts/WLABVesting.sol) | Cliff, linear, revocable, emergency withdraw |
| **Staking** | [`WLABStaking.sol`](../contracts/WLABStaking.sol) | 30/90/180/365 gün çarpanlar, compound, emergency %10 ceza |
| **Governance** | [`WLABGovernor.sol`](../contracts/WLABGovernor.sol) | OZ Governor + Timelock 48h |
| **Token Sale** | [`WLABTokenSale.sol`](../contracts/WLABTokenSale.sol) | Seed/Private/Public, merkle WL, refund |
| **veToken** | [`WLABVeToken.sol`](../contracts/WLABVeToken.sol) | Vote escrow, gauges |
| **OFT Adapter** | [`WLABOFTAdapter.sol`](../contracts/WLABOFTAdapter.sol) | Bridge stub → LayerZero production |
| **Treasury UUPS** | [`upgrades/WLABTreasuryUUPS.sol`](../contracts/upgrades/WLABTreasuryUUPS.sol) | Upgradeable treasury |

### Rol Tablosu (WLABToken)

| Rol | Yetki |
|-----|-------|
| `MINTER_ROLE` | Mint (cap içi) |
| `BURNER_ROLE` | `burnFrom` |
| `PAUSER_ROLE` | pause/unpause |
| `SNAPSHOT_ROLE` | `snapshot()` |
| `COMPLIANCE_ROLE` | blacklist/whitelist |

### Fee Exemptions

`WLABToken.setFeeExempt(account, status)` is separate from compliance whitelist state. Use it for protocol contracts that must transfer exact entitlements, such as `WLABTokenSale` claims, without granting broader compliance-list semantics.

### Staking Restake Invariant

Additional deposits into an existing staking position must use the same tier. This keeps `amount`, `weight`, and `totalWeightedStake` aligned until per-deposit positions are introduced.

### veGauge Voting Invariant

`WLABVeToken.voteGauge(gaugeId, weight)` sets the user's absolute weight for that gauge. A user cannot allocate more aggregate gauge weight than their current `totalVotingPower`, and active votes must be reduced before withdrawing a lock that would leave votes overcommitted.

---

## Bölüm Özeti & Sonraki Adım

Akıllı sözleşmeler `contracts/` altında production-ready. Test: [05-security-audit.md](./05-security-audit.md).

**Sonraki adım:** `npm test`
