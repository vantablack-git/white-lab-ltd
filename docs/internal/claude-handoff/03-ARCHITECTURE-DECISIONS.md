# WhiteLab — Mimari Kararlar (DEĞİŞTİRME)

Claude bu tabloyu **override etmemeli**. İyileştirme sadece implementasyon detayında olmalı.

---

## DEC Registry

| ID | Karar | Detay |
|----|--------|-------|
| **DEC-001** | Ürün: **WhiteLab Launch OS** | Kurumsal uyumlu token launchpad + geliştirici SDK |
| **DEC-002** | Birincil zincir: **Base** | Testnet: Base Sepolia (chainId 84532) |
| **DEC-003** | Crosschain: **LayerZero OFT v2** | Şu an stub: `WLABOFTAdapter.sol` |
| **DEC-004** | Monorepo | docs + contracts + test + scripts tek repo |
| **DEC-005** | **$WLAB**, max **1.000.000.000**, 18 decimal | Deflasyon: fee burn + buyback |
| **DEC-006** | Utility token; **Swiss Association** + **Cayman Foundation** | MiCA bilgilendirme — hukuki tavsiye değil |
| **DEC-007** | Ekip: `team-public.md` / `team-anon.md` | |
| **DEC-008** | Token **immutable**; Treasury **UUPS** | Governor timelock min 48h |
| **DEC-009** | `ARCHITECT_LOG.md` her fazda güncellenir | |

---

## Teknoloji stack (sabit)

| Katman | Seçim |
|--------|--------|
| Solidity | 0.8.26, `evmVersion: cancun` |
| Framework | Hardhat 2.x |
| Kütüphane | OpenZeppelin Contracts 5.x |
| Test | Mocha + Chai + hardhat-network-helpers |
| L2 | Base |
| DEX (plan) | Uniswap v3 |
| Indexer (plan) | The Graph |
| Oracle (plan) | Chainlink |

---

## Tokenomics özeti (DEC-005)

| Kategori | % |
|----------|---|
| Ekip & Kurucu | 15% |
| Seed | 6% |
| Private | 8% |
| Public IDO | 5% |
| Ekosistem & Dev | 20% |
| Likidite & MM | 10% |
| Staking ödülleri | 18% |
| Hazine | 12% |
| Topluluk & Airdrop | 4% |
| Danışmanlar | 2% |

FDV hedefleri: Seed $12M | Private $25M | Public $40M

---

## Problem / Çözüm (ürün dili)

- **Problem:** Parçalı launch araçları, zayıf compliance, opak tokenomics
- **Çözüm:** Audit-ready şablonlar + KYC IDO + on-chain vesting/gov
- **Fark:** "Clean room launch" — tek SDK, compliance-native ERC-20

---

## Bilinçli teknik sapmalar (dokümante)

| Konu | Plan | Gerçek implementasyon |
|------|------|------------------------|
| ERC20Snapshot | Planlandı | OZ v5 kaldırdı → `snapshotId` event + `ERC20Votes` checkpoints |
| Satır satır `//` yorum | Planlandı | NatSpec + kritik satırlar (Claude tamamlayabilir) |

Bu sapmalar kabul edilebilir; Claude geri almak zorunda değil.
