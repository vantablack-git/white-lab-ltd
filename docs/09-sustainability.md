# BÖLÜM 9 — PROTOKOL İYİLEŞTİRME VE SÜRDÜRÜLEBİLİRLİK

---

## 9.1 Upgradeable Kontrat Mimarisi

### Transparent vs UUPS

| | Transparent | UUPS |
|---|-------------|------|
| Upgrade fonksiyonu | Proxy'de | Implementation'da |
| Gas | Daha yüksek | Daha düşük |
| Risk | Admin proxy karmaşası | `_authorizeUpgrade` unutulursa brick |

**WhiteLab seçimi:** **UUPS** — Treasury ve gelecek modüller için ([`WLABTreasuryUUPS.sol`](../contracts/upgrades/WLABTreasuryUUPS.sol)).

**Token:** Immutable (proxy yok) — holder güveni.

### Storage Collision

- OpenZeppelin `storage-gap` kullan
- Implementation upgrade'de layout dokümantasyonu
- `hardhat-storage-layout` diff CI

---

## 9.2 Protokol Geliri ve Sürdürülebilirlik

### Fee Switch (DAO)

`WLABTreasuryUUPS.setFeeSwitch(enabled, bps)` — Governor timelock ile.

| Gelir kaynağı | Oran |
|---------------|------|
| Launch listing fee | 100% WLAB veya stable |
| Transfer fee | %0.5 (toggle) |
| Performance fee (vault) | %10 |

### Treasury Yönetimi

- **40%** LP / MM
- **30%** Buyback & burn
- **30%** Grants & ops

### Protocol Owned Liquidity (POL)

Olympus Pro benzeri: tahvil satışı → LP → DAO'ya ait kalıcı likidite.

Hedef Y2: TVL'nin %30'u POL.

---

## 9.3 Governance Lock Vault Modeli

[`WLABLockVault.sol`](../contracts/WLABLockVault.sol) bir **weighted governance lock vault**'tur. veCRV tarzı sürekli decay'in olduğu bir vote-escrow değildir.

- Max lock 4 yıl → voting power = `amount × (duration / MAX_LOCK)` — kilit anında sabitlenir, zamanla **decay etmez**.
- Gauge emission yönlendirme (vote weight gauge'lara mutlak olarak atanır, additive değil).
- Withdraw sadece `unlockTime` sonrası ve aktif gauge votes salındıktan sonra mümkündür.

**Oy gücü:** `totalVotingPower[account]` — DAO Governor entegrasyonu ileri bir roadmap maddesi olarak listelenmiştir; gerçek bir decaying ve dağıtılması ayrı bir mühendislik çalışmasıdır, bu vault'a retrofit değildir.

---

## 9.4 On-chain Risk Yönetimi

| Mekanizma | Uygulama |
|-----------|----------|
| **Pause guardian** | `PAUSER_ROLE` — 3/5 multisig, 24h sonra DAO review |
| **Rate limiting** | Roadmap: max transfer X WLAB / block per address |
| **Circuit breaker** | Oracle fiyat %20 sapma → sale pause |
| **Insurance fund** | Treasury'nin %5'i — exploit sonrası kullanıcı tazminatı (DAO vote) |

### Insurance Fund Akışı

```
Incident declared → Governor emergency proposal
→ Timelock 48h → Payout merkle claim
→ Max per user cap
```

---

## BÖLÜM 9 — Bölüm Özeti & Sonraki Adım

UUPS treasury, Lock Vault, fee switch ve risk çerçevesi tamamlandı. WhiteLab master rehberi Bölüm 0–9 ile eksiksiz repo'da.

**Sonraki adım:** `npm install && npm test` → testnet deploy → audit → mainnet TGE.

---

## Master Rehber İndeksi

| Bölüm | Dosya |
|-------|-------|
| 0 | [00-conceptual-foundation.md](./00-conceptual-foundation.md) |
| 1 | [01-identity-strategy.md](./01-identity-strategy.md) |
| 2 | [02-whitepaper.md](./02-whitepaper.md) |
| 3 | [03-tokenomics.md](./03-tokenomics.md) |
| 5 | [05-security-audit.md](./05-security-audit.md) |
| 6 | [06-deployment.md](./06-deployment.md) |
| 7 | [07-ecosystem.md](./07-ecosystem.md) |
| 8 | [08-crosschain-defi.md](./08-crosschain-defi.md) |
| 9 | [09-sustainability.md](./09-sustainability.md) |
| 10 | [10-production-candidate-readiness.md](./10-production-candidate-readiness.md) |
| 11 | [11-operations-runbook.md](./11-operations-runbook.md) |
| 12 | [12-user-guides.md](./12-user-guides.md) |
| Log | [../ARCHITECT_LOG.md](../ARCHITECT_LOG.md) |
