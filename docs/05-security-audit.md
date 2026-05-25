# BÖLÜM 5 — TEST, DENETİM VE GÜVENLİK

---

## 5.1 Hardhat Test Yazımı

Test dosyaları `test/` altında:

| Dosya | Kapsam |
|-------|--------|
| `WLABToken.test.js` | Mint, pause, blacklist, fee, snapshot |
| `WLABVesting.test.js` | Schedule, release, revoke |
| `WLABStaking.test.js` | Stake, rewards, emergency penalty |
| `WLABTokenSale.test.js` | Phase buy, refund |
| `WLABVeToken.test.js` | Gauge vote accounting, vote reuse prevention |
| `WLABGovernor.test.js` | Deploy, quorum |
| `WLABGovernorLifecycle.test.js` | Propose, vote, queue, timelock, execute |
| `WLABTreasuryUUPS.test.js` | Proxy init, roles, withdrawals, UUPS upgrade |
| `WLABOFTAdapter.test.js` | Disabled stub guardrails, replay protection |
| `invariants.test.js` | Sale obligations and staking weight invariants |
| `integration.test.js` | Full wiring |

### Komutlar

```bash
npm install
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat coverage
```

### Fuzzing (Hardhat)

```javascript
// Örnek: rastgele stake miktarı
for (let i = 0; i < 20; i++) {
  const amt = ethers.parseEther(String(Math.floor(Math.random() * 1000) + 1));
  if (amt <= balance) await staking.stake(amt, 0, false);
}
```

### Foundry (opsiyonel invariant)

```bash
forge init --force
# invariant: totalStaked <= token.balanceOf(staking)
```

---

## 5.2 Güvenlik Açığı Sınıflandırması

| Kategori | Açıklama | WhiteLab tezahür | Önlem |
|----------|----------|------------------|-------|
| **Reentrancy** | Dış çağrı sırasında state tekrar kullanımı | Sale, Vesting, Staking | `ReentrancyGuard` |
| **Overflow/Underflow** | Aritmetik taşma | Eski Solidity | 0.8 checked math |
| **Access Control** | Yetkisiz admin çağrısı | Mint, pause, upgrade | `AccessControl`, multisig |
| **Front-running** | Mempool sıra manipülasyonu | IDO buy | Commit-reveal (roadmap), cap limits |
| **Flash loan** | Anlık borç ile gov/manipülasyon | Governance snapshot | Timelock, vote delay |
| **Oracle manipulation** | Fiyat feed saldırısı | Chainlink entegrasyonu | TWAP, çoklu feed |
| **Centralization** | Tek admin key | Deployer admin | 4/7 Safe → DAO handover |
| **Upgrade proxy** | Storage collision, malicious impl | Treasury UUPS | `_authorizeUpgrade` role, timelock |

---

## 5.3 Statik Analiz Araçları

### Slither

```bash
pip install slither-analyzer
slither contracts/ --solc-remaps "@openzeppelin=node_modules/@openzeppelin"
```

Yorumlama: `reentrancy-eth`, `controlled-array-length`, `missing-zero-check` bulgularını Critical/High önceliğiyle ele al.

### Mythril

```bash
docker run -v $(pwd):/src mythril/myth analyze /src/contracts/WLABToken.sol --solc-json remappings.json
```

### 4naly3er

Manuel gas: storage packing, `immutable` kullanımı, custom error (roadmap).

---

## 5.4 Profesyonel Denetim Süreci

### Tier-1 Firmalar

Trail of Bits, Consensys Diligence, OpenZeppelin, CertiK, Hacken.

### Denetim Öncesi Checklist

- [ ] %95+ test coverage
- [ ] Governor propose/vote/queue/execute lifecycle tests
- [ ] Treasury UUPS proxy deployment and upgrade tests
- [ ] OFT adapter replacement or explicit production disablement
- [ ] NatSpec tam
- [ ] Known issues listesi
- [ ] Deploy script dry-run
- [ ] Admin key multisig
- [ ] Emergency pause testnet provası

### Bulgu Sınıflandırması

| Seviye | SLA |
|--------|-----|
| Critical | 24h fix, redeploy |
| High | 72h |
| Medium | 1 hafta |
| Low | Sprint backlog |
| Informational | Dokümante |

### Bug Bounty (Immunefi şablonu)

- **Max bounty:** $250,000 (mainnet TVL'ye bağlı)
- **Scope:** `contracts/*.sol` (exclude test mocks)
- **Out of scope:** Frontend, third-party bridges
- **KYC:** Kritik ödeme için gerekli

---

## BÖLÜM 5 — Bölüm Özeti & Sonraki Adım

Test suite ve güvenlik çerçevesi tanımlandı. `npm test` ile doğrulayın.

**Sonraki adım:** [Bölüm 6 — Deployment](./06-deployment.md)
