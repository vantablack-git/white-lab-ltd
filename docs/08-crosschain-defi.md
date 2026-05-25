# BÖLÜM 8 — CROSSCHAIN VE DeFi ENTEGRASYONLARI

---

## 8.1 Crosschain Köprü Tasarımı

### Lock-and-mint vs Burn-and-mint

| Model | Akış | WhiteLab |
|-------|------|----------|
| **Lock-and-mint** | Kaynakta kilitle → hedefte mint | `WLABOFTAdapter` stub (lock pool) |
| **Burn-and-mint** | Kaynakta yak → hedefte mint | **LayerZero OFT v2 (production)** |

### LayerZero OFT Entegrasyonu

Production adımlar:

1. `npm install @layerzerolabs/oapp-evm`
2. Deploy `WLABOFT` on Base (hub)
3. Deploy adapter on Polygon, Arbitrum
4. `setPeer(eid, peerAddress)` her zincir çifti
5. Test `send()` with 0.1 WLAB

Stub kontrat: [`contracts/WLABOFTAdapter.sol`](../contracts/WLABOFTAdapter.sol)

### Wormhole Alternatifi

- Portal Token Bridge — hızlı entegrasyon, farklı güven modeli (guardian set)
- WhiteLab Y2: ikincil köprü olarak değerlendirme — tek köprü riskini dağıtma

---

## 8.2 DeFi Protokol Entegrasyonları

### Aave v3 (Base)

Roadmap proposal:

1. LISTING_ON_AAVE forum post
2. Risk parameters: LTV 40%, liquidation 65%
3. Chainlink WLAB/USD oracle (if available) or ETH-correlated

### Yield Vault (Yearn-style)

```
User WLAB → WhiteLabVault → stake in Staking + compound
                ↓
         Performance fee 10% → Treasury
```

### Curve-style gauge (veWLAB)

`WLABVeToken.voteGauge()` — emission yönlendirme LP havuzlarına.

---

## 8.3 Zincir İçi Veri Yönetimi

### The Graph Subgraph (şema özeti)

```graphql
type TokenTransfer @entity {
  id: ID!
  from: Bytes!
  to: Bytes!
  value: BigInt!
  timestamp: BigInt!
}

type StakeEvent @entity {
  id: ID!
  user: Bytes!
  amount: BigInt!
  tier: Int!
}
```

Deploy: `graph deploy --node https://api.studio.thegraph.com whitelab/base`

### Dune Dashboard

| Query | Metrik |
|-------|--------|
| transfers daily | Aktif cüzdan |
| staking TVL | Kilitli WLAB |
| sale raised | IDO performans |

### Chainlink Oracle

Base ETH/USD: `0x71041dddad3595F9CEd3DcCFBe245E23B7750F87` (örnek — deploy öncesi doğrula)

Kullanım: Sale UI fiat gösterimi, vault NAV.

---

## BÖLÜM 8 — Bölüm Özeti & Sonraki Adım

Crosschain ve DeFi entegrasyon yolu belirlendi; OFT stub repo'da.

**Sonraki adım:** [Bölüm 9 — Sürdürülebilirlik](./09-sustainability.md)
