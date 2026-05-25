# BÖLÜM 1 — PROJENİN KİMLİĞİ VE STRATEJİSİ

---

## 1.1 Proje Vizyonu ve Misyonu

### Problem / Çözüm / Fark

| | İçerik |
|---|--------|
| **Problem** | Token lansmanları parçalı araçlar, zayıf KYC/AML, opak vesting ve kopyala-yapıştır sözleşmeler nedeniyle yatırımcı kaybı ve regülasyon riski yaratıyor. 2024–2025 döneminde launchpad dolandırıcılık ve rug-pull vakaları toplam kaybın önemli kısmını oluşturdu. |
| **Çözüm** | **WhiteLab Launch OS** — audit-ready şablon sözleşmeler, tier'lı KYC IDO, şeffaf tokenomics, zincir üstü vesting/staking/governance ve DAO treasury. |
| **Fark yaratma** | "Clean room launch": tek SDK + compliance hooks (blacklist, permit, snapshot) + Tier-1 denetim checklist'i; rakiplerde parçalı olan uçtan uca paket. |

### Vizyon & Misyon

- **Vizyon:** Her ciddi projenin tokenını güvenli, uyumlu ve topluluk odaklı şekilde piyasaya sürebildiği varsayılan altyapı olmak.
- **Misyon:** Geliştiricilere production-grade akıllı sözleşme seti, kurumlara KYC katmanı, yatırımcılara şeffaf ekonomi sunmak.

### Hedef Kitle (Tier Profilleri)

| Tier | Profil | İhtiyaç | WhiteLab değeri |
|------|--------|---------|-----------------|
| **Tier 1** | Kurumsal fon, RWA issuer, regulated entity | MiCA/AML uyumu, multisig, raporlama | Whitelist IDO, compliance token hooks, Swiss/Cayman yapı |
| **Tier 2** | DeFi/Web3 proje kurucuları | Hızlı ama güvenli launch | Hardhat SDK, vesting/sale şablonları, subgraph |
| **Tier 3** | Retail yatırımcı, topluluk | Şeffaflık, staking getirisi | On-chain dashboard, DAO oy hakkı, Dune metrikleri |

### Value Proposition Canvas

| Blok | İçerik |
|------|--------|
| **Müşteri işleri** | Token lansmanı, likidite, topluluk, uyum |
| **Acılar** | Hack riski, hukuki belirsizlik, düşük güven |
| **Kazançlar** | Tek paket launch, denetimli kod, DAO ile sürdürülebilirlik |
| **Ürün** | Launch OS, $WLAB utility, staking, governance |
| **Pain relievers** | OZ tabanlı kontratlar, KYC sale, timelock |
| **Gain creators** | Grants, MM likidite programı, crosschain OFT |
| **Rakiplerden fark** | Compliance-native ERC-20 + tam vesting/gov entegrasyonu |

**Bölüm özeti:** WhiteLab = kurumsal launch + retail katman. **Sonraki:** Pazar analizi.

---

## 1.2 Pazar Analizi

### Pazar Büyüklüğü (2025–2026 referans)

| Metrik | Değer | Kaynak çerçevesi |
|--------|-------|------------------|
| Global kripto market cap | ~$2.5–3.0T | CoinGecko / industry reports 2025 |
| Yıllık büyüme (projeksiyon) | %15–25 CAGR (2025–2028) | a16z State of Crypto, Statista |
| Token launch / infra segment | ~$8–12B SAM | Launchpad + tooling fee havuzu |

### TAM / SAM / SOM (WhiteLab)

| | Tanım | WhiteLab tahmini |
|---|--------|------------------|
| **TAM** | Global kripto ekonomisi | ~$2.8T |
| **SAM** | Launchpad + dev infra + compliance tooling | ~$10B |
| **SOM (Yıl 3)** | WhiteLab payı hedefi (%0.08 SAM) | ~$8M yıllık protocol revenue eşdeğeri |

### Rakip Analizi (5 Proje)

| Rakip | Güçlü | Zayıf | WhiteLab fırsatı |
|-------|-------|-------|------------------|
| **DAO Maker** | SHO mekanizması, kullanıcı tabanı | Compliance derinliği sınırlı | KYC-native sale + snapshot gov |
| **Polkastarter** | Çok zincir, POLS ekosistemi | Eski UX, şeffaflık eleştirisi | Base-first modern stack |
| **Pump.fun** | Hız, meme hacim | Utility/regülasyon zayıf | Kurumsal "clean" launch alternatifi |
| **CoinList** | Regülasyon itibarı | Yüksek bariyer, merkezi | On-chain DAO + açık şablonlar |
| **Synapse** | Crosschain | Launchpad değil | OFT + launch birleşimi |

### SWOT (WhiteLab'e özgü)

| **Strengths** | **Weaknesses** |
|---------------|----------------|
| Tam OZ kontrat seti, compliance hooks | Yeni marka, sınırlı likidite başlangıç |
| Base düşük maliyet | Çoklu zincir gecikmesi (Faz 2) |
| Şeffaf tokenomics | Hukuki yapı kurulum maliyeti |

| **Opportunities** | **Threats** |
|-------------------|-------------|
| MiCA ile uyumlu utility positioning | Regülasyon sıkılaşması |
| Kurumsal RWA tokenizasyonu | Bear market hacim düşüşü |
| L2 büyümesi | Rakip fork / kopya |

**Bölüm özeti:** SAM ~$10B; diferansiyasyon compliance + SDK. **Sonraki:** Regülasyon.

---

## 1.3 Yasal ve Regülasyon Çerçevesi

### Token Sınıflandırması

| Tür | WhiteLab $WLAB |
|-----|----------------|
| Utility Token | **Evet** — launch fee, staking, governance |
| Security Token | **Hayır** — kâr payı / ortaklık vaadi yok |
| Payment Token | **Kısmi** — ödeme aracı değil, hizmet erişimi |

### Howey Test (ABD)

| Kriter | WLAB değerlendirmesi |
|--------|---------------------|
| Para yatırımı | IDO ile alım var; ancak tek başına yeterli değil |
| Ortak girişim | Protokol geliri token'a yansır ama pasif ortaklık vaadi yok |
| Kâr beklentisi | Resmi materyallerde garanti edilmez; utility odaklı |
| Başkalarının çabası | DAO + açık kaynak; merkezi tek aktör yok |

**Sonuç:** Bilgilendirme amaçlı utility pozisyonu; ABD'de satış geo-kısıtlı.

### MiCA Konumlandırma

- **CAS / CASP:** WhiteLab protokolü doğrudan saklama hizmeti sunmaz; partner KYC sağlayıcı ile.
- **ART/EMT:** WLAB stablecoin değildir.
- **Utility token beyanı:** Hizmet erişimi (launch slot, fee indirimi) dokümante edilir.

### KYC / AML Stratejisi

| Tier | Gereksinim |
|------|------------|
| Public IDO | Temel KYC (Sumsub/Onfido partner) |
| Private/Seed | Enhanced DD + accredited (yargı alanına göre) |
| Proje listeleme | KYB + tokenomics review |

On-chain: `WLABTokenSale` whitelist mapping; off-chain: KYC provider webhook → merkle root güncelleme.

### Geo Kısıtlamalar

**Blacklist (varsayılan):** US, CN, KP, IR, CU, SY + OFAC SDN eşleşmesi.

**Whitelist yaklaşımı:** Kurumsal round'lar için explicit allowlist; public için KYC-passed merkle.

### Hukuki Varlık Yapısı

| Varlık | Rol |
|--------|-----|
| **Swiss Association** (Zürich) | DAO yönetişim, topluluk, non-profit çerçeve |
| **Cayman Islands Foundation** | Treasury, yatırımcı anlaşmaları, IP |
| **Marshall Islands DAO LLC** (opsiyonel) | Operasyonel DAO wrapper (Y2) |

**Uyarı:** Canlı launch öncesi yerel avukat zorunludur.

---

## BÖLÜM 1 — Bölüm Özeti & Sonraki Adım

WhiteLab kimliği, pazar konumu ve regülasyon çerçevesi tanımlandı.

**Sonraki adım:** [Bölüm 2 — Whitepaper](./02-whitepaper.md)
