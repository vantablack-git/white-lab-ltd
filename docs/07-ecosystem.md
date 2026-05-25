# BÖLÜM 7 — EKOSİSTEM GELİŞTİRME VE TOPLULUK

---

## 7.1 Geliştirici Ekosistemi

### Grants Programı

| Tier | Miktar | Kriter |
|------|--------|--------|
| Micro | $5K–$25K WLAB | Hackathon kazananı |
| Standard | $25K–$100K | MVP + audit planı |
| Strategic | $100K–$500K | TVL / kullanıcı hedefi |

**Toplam havuz:** 200M WLAB (ekosistem allocation) — yıllık $2M eşdeğer hedef.

### SDK / API

```typescript
import { WhiteLabSDK } from '@whitelab/sdk';
const sdk = new WhiteLabSDK({ chainId: 8453, rpcUrl: '...' });
await sdk.launch.createSale({ phase: 'Public', price: '0.04', allocation: '1000000' });
```

Dokümantasyon: `docs/` + OpenAPI (REST indexer) — subgraph GraphQL.

### Hackathon

- **WhiteLab Buildathon** — 48h, $100K ödül havuzu
- Tracks: Compliance, DeFi integration, Crosschain
- Partner: Base, Galxe

---

## 7.2 Topluluk Büyütme

### Discord Yapısı

| Kanal | Rol erişimi |
|-------|-------------|
| #announcements | @everyone read |
| #general | Verified |
| #dev-support | Developer |
| #governance | Lock Vault holders / 10K WLAB |
| #launch-applications | Project Lead |

**Botlar:** Collab.Land (token gate), Wick (mod), MEE6 (levels).

### Telegram

- Announcement channel (read-only)
- Community group (slow mode)
- Türkçe + English regional groups

### Twitter/X Playbook

| Hafta | İçerik |
|-------|--------|
| 1-4 | Teaser, team hints, tech threads |
| 5-8 | Testnet tutorial, meme + education |
| TGE hafta | Live spaces, KOL AMA |
| Post-TGE | Weekly metrics thread |

### Ambassador Program

| Tier | Gereksinim | Ödül |
|------|------------|------|
| Bronze | 500 followers, 4 post/ay | 500 WLAB |
| Silver | 5K followers, content kalite | 2K WLAB + NFT |
| Gold | 25K+, video | 10K WLAB + event |

---

## 7.3 Airdrop Mekanizmaları

### Retroactive (Testnet)

- Base Sepolia deploy interact
- Min 5 tx, 3 farklı kontrat
- Snapshot block: TGE-7 gün

### Görev bazlı (Galxe / Layer3)

1. Follow + Discord verify
2. Stake tutorial
3. Governance mock vote
4. Referral (max 10, sybil check)

### Sybil Koruması

- Gitcoin Passport skor ≥ 20
- On-chain: benzer funding path clustering
- CEX deposit pattern exclusion
- Manuel review top 1% claim

**Airdrop allocation:** 40M WLAB — %20 TGE, 24 ay vesting.

---

## 7.4 Pazarlama ve PR

### İletişim Takvimi

| Faz | Aktivite |
|-----|----------|
| T-30 | Whitepaper, testnet |
| T-7 | IDO whitelist açılış |
| T-0 | TGE, LP, AMA marathon |
| T+7 | Audit publish, CMC listing |
| T+30 | İlk external launch |

### KOL Brief (özet)

- Mesaj: "Clean room launch infrastructure on Base"
- Yasak: guaranteed returns, price targets
- Zorunlu: #ad #sponsored, risk disclaimer link

### Press Release Şablonu

```
FOR IMMEDIATE RELEASE
WhiteLab Launches Compliance-First Token Launch OS on Base
[CITY, DATE] — WhiteLab protocol today announced...
Quote from Architect-0x / Alex Chen
About WhiteLab: ...
Media: press@whitelab.io
```

Hedef: CoinDesk, Cointelegraph, Decrypt, The Block.

---

## BÖLÜM 7 — Bölüm Özeti & Sonraki Adım

Ekosistem, topluluk ve pazarlama playbook tanımlandı.

**Sonraki adım:** [Bölüm 8 — Crosschain & DeFi](./08-crosschain-defi.md)
