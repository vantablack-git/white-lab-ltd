# BÖLÜM 3 — TOKENOMİCS MÜHENDİSLİĞİ ($WLAB)

---

## 3.1 Token Arzı Tasarımı

### Model Karşılaştırması

| Model | Avantaj | Dezavantaj | WhiteLab |
|-------|---------|------------|----------|
| **Deflasyonist** | Scarcity narrative, fee burn | Likidite daralabilir | **Seçildi (kısmi)** — burn + sabit cap |
| **Enflasyonist** | Staking teşviki kolay | Satış baskısı | Sadece staking emission (sınırlı) |
| **Sabit arz** | Basit hikâye | Ödül için mint gerekir | **Max 1B cap** |

**Karar:** Sabit **max supply 1,000,000,000 WLAB**; staking için önceden ayrılmış emission havuzu (18%); protocol fee ile **buyback-and-burn**.

---

## 3.2 Dağıtım Tablosu

| Kategori | % | Miktar | Cliff | Vesting | TGE Unlock |
|----------|---|--------|-------|---------|------------|
| Ekip & Kurucu | 15% | 150,000,000 | 12 ay | 36 ay lineer | 0% |
| Seed | 6% | 60,000,000 | 6 ay | 18 ay lineer | 10% (6M) |
| Private | 8% | 80,000,000 | 3 ay | 12 ay lineer | 15% (12M) |
| Public IDO | 5% | 50,000,000 | 0 | 6 ay lineer | 25% (12.5M) |
| Ekosistem & Dev | 20% | 200,000,000 | 0 | 48 ay | 5% (10M) |
| Likidite & MM | 10% | 100,000,000 | 0 | 12 ay | 40% (40M) |
| Staking ödülleri | 18% | 180,000,000 | 0 | 60 ay emission | 0% |
| Hazine | 12% | 120,000,000 | 6 ay | DAO | 0% |
| Topluluk & Airdrop | 4% | 40,000,000 | 0 | 24 ay | 20% (8M) |
| Danışmanlar | 2% | 20,000,000 | 6 ay | 24 ay | 0% |
| **Toplam** | **100%** | **1,000,000,000** | | | |

**TGE dolaşım (yaklaşık):** 6M + 12M + 12.5M + 10M + 40M + 8M ≈ **88.5M (~8.85%)**

---

## 3.3 Fiyatlandırma Modeli

| Round | FDV | Fiyat (USD) | Raise | Gerekçe |
|-------|-----|-------------|-------|---------|
| Seed | $12M | $0.012 | $720K | Erken risk primi |
| Private | $25M | $0.025 | $2M | Ürün-market fit kanıtı |
| Public IDO | $40M | $0.04 | $2M (50M token) | Topluluk genişlemesi |

**Hedef market cap (TGE):** ~$3.5–4M (dolaşım × $0.04)

### Kıyaslama (benzer TGE)

| Proje tipi | TGE performans (ortalama band) |
|------------|-------------------------------|
| L2 infra launch | +20% to -30% day 1 |
| Launchpad token | Yüksek volatilite, vesting cliff sonrası düşüş riski |

WhiteLab mitigasyonu: agresif LP lock, düşük TGE team unlock (0%), buyback treasury.

---

## 3.4 Token Ekonomisi Simülasyonu (12 Ay)

Varsayımlar: IDO fiyat $0.04; aylık protocol revenue $50K→$200K; staking participation 25%→40%.

### Arz-Talep Özeti

| Ay | Yeni Unlock (M) | Staking Emission (M) | Burn (M) | Net Arz Artışı (M) | Talep Driver |
|----|-----------------|----------------------|----------|----------------------|--------------|
| 1 | 88.5 (TGE) | 3.0 | 0.5 | +91.0 | IDO, listing hype |
| 2 | 2.1 | 3.0 | 0.6 | +4.5 | LP mining |
| 3 | 8.3 (Private cliff) | 3.0 | 0.8 | +10.5 | Sell pressure ↑ |
| 4 | 2.5 | 3.0 | 1.0 | +4.5 | Staking lock |
| 5 | 2.5 | 3.0 | 1.2 | +4.3 | Launch fees |
| 6 | 6.0 (Seed cliff) | 3.0 | 1.5 | +7.5 | Vesting wave |
| 7 | 3.0 | 3.0 | 1.8 | +4.2 | Governance |
| 8 | 3.0 | 3.0 | 2.0 | +4.0 | Buyback |
| 9 | 4.2 (Team start) | 3.0 | 2.2 | +5.0 | Team vesting |
| 10 | 4.2 | 3.0 | 2.5 | +4.7 | Ecosystem grants |
| 11 | 4.2 | 3.0 | 2.8 | +4.4 | CEX spec |
| 12 | 4.2 | 3.0 | 3.0 | +4.2 | Year-end |

### Sell Pressure (Vesting Cliffs)

| Dönem | Kategori | Potansiyel satış (M WLAB) | Baskı skoru (1-5) |
|-------|----------|---------------------------|-------------------|
| M3 | Private cliff | ~20 | 4 |
| M6 | Seed cliff | ~15 | 3 |
| M9+ | Team lineer | ~4.2/ay | 3 |
| M12 | Advisor | ~5 | 2 |

### Buy Pressure Kaynakları

| Kaynak | Etki |
|--------|------|
| Protocol revenue buyback | 30% revenue → market buy + burn |
| Staking lock | 25–40% supply locked |
| Launch fee demand | Projects acquire WLAB |
| LP incentives | Mercenary ama hacim artışı |

---

## 3.5 Deflasyon Mekanizmaları

| Mekanizma | Parametre |
|-----------|-----------|
| Transfer fee (toggle) | 0.5% → 70% burn / 30% treasury |
| Protocol fee buyback | 30% of USD revenue weekly |
| Bridge fee burn | 0.1% per OFT send |
| Staking lock bonus | 30d 1x → 365d 3x (reduces float) |

**Emission schedule:** 180M over 60 months = 3M/month average from staking pool.

---

## 3.6 Value Accrual

```
Protocol Revenue → Treasury → 30% Buyback & Burn
                            → 40% LP / MM
                            → 30% Grants & Ops

Utility Demand ← Launch fees, staking, governance, LP rewards
       ↓
   Reduced float (locks + burn)
       ↓
   Scarcity + usage → long-term value hypothesis
```

**Utility-driven demand döngüsü:** Daha fazla proje launch → daha fazla WLAB fee → buyback → holder confidence → daha fazla stake/gov katılımı.

---

## BÖLÜM 3 — Bölüm Özeti & Sonraki Adım

$WLAB tokenomics: 1B cap, dağıtım tablosu, fiyat kademeleri, 12 ay simülasyon, burn ve value accrual tanımlandı.

**Sonraki adım:** Bölüm 4 — Akıllı sözleşmeler (`contracts/`)
