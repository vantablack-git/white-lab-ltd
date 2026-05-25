# BÖLÜM 6 — DEPLOYMENT VE MAINNET LANSMANI

---

## 6.1 Testnet Deployment (Base Sepolia)

### Önkoşullar

1. Base Sepolia ETH (faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. `.env` doldur: `PRIVATE_KEY`, `BASE_SEPOLIA_RPC`, `ETHERSCAN_API_KEY`

### Adımlar

```bash
cd whitelab
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network baseSepolia
```

### Etherscan Verify

```bash
npx hardhat verify --network baseSepolia <TOKEN_ADDRESS> "<ADMIN>" "<TREASURY>"
npx hardhat run scripts/verify.js --network baseSepolia
```

### E2E Testnet Senaryoları

1. Mint test miktarı
2. Configure + start Public sale phase
3. Buy with whitelist merkle root
4. Stake 30-day tier
5. Create governance proposal (post-delegation)

---

## 6.2 Mainnet Deployment Stratejisi

### Gnosis Safe (4/7)

| Signer | Rol |
|--------|-----|
| 3× Founder hardware wallet | Operasyon |
| 2× Advisor | Oversight |
| 2× Community elected (Y2) | DAO |

### Deployer Key Güvenliği

- Ledger / Trezor imzalama
- Air-gapped backup seed
- Deploy script parametreleri offline review

### Pre-Mainnet Checklist (20+)

1. [ ] Audit raporu Critical/High kapalı
2. [ ] Multisig owners doğrulandı
3. [ ] Timelock min delay 48h
4. [ ] Token max supply mint tek seferde
5. [ ] MINTER_ROLE multisig'e revoke
6. [ ] Sale allocation kontrata transfer
7. [ ] Vesting schedules oluşturuldu
8. [ ] LP ETH+WLAB hazır
9. [ ] Uniswap pozisyon parametreleri onaylandı
10. [ ] LP tokens lock (Unicrypt 12+ ay)
11. [ ] Basescan verify tüm kontratlar
12. [ ] deployments/base.json yayınlandı
13. [ ] ARCHITECT_LOG güncel
14. [ ] Geo-block frontend
15. [ ] KYC provider canlı
16. [ ] Bug bounty aktif
17. [ ] Incident response runbook
18. [ ] Insurance fund seed
19. [ ] CMC/CG form gönderildi
20. [ ] Press embargo planı

### Adres Duyurusu

Resmi kanallardan tek JSON: `deployments/base.json` — phishing'e karşı domain pinning.

---

## 6.3 Likidite Yönetimi

### Uniswap v3 (Base)

- Pair: WLAB / WETH
- Fee tier: 0.3%
- Concentrated range: ±50% TGE fiyat
- Initial: $400K eşdeğer (40M WLAB @ $0.04)

### Price Discovery

- Seed/Private referans fiyat → IDO $0.04
- İlk 24h TWAP oracle

### LP Lock

- Unicrypt veya Team Finance: 12 ay minimum
- LP token'ların %60'si vesting 12 ay

---

## 6.4 CEX Listeleme Yolculuğu

| Aşama | Borsa | Gereksinim |
|-------|-------|------------|
| Tier 3 | MEXC, Gate | Listing fee, MM |
| Tier 2 | Bybit, OKX | Hacim, audit, legal opinion |
| Tier 1 | Binance | Due diligence, community size |

### Market Maker

- Anlaşma: 2% spread hedef, 30 gün loan + call option
- Raporlama: haftalık depth

### CoinMarketCap / CoinGecko

- CMC: https://coinmarketcap.com/request/
- CG: https://www.coingecko.com/en/coins/new
- Gerekli: contract verify, likidite, web sitesi, sosyal

---

## BÖLÜM 6 — Bölüm Özeti & Sonraki Adım

Deploy script ve checklist hazır. Testnet'te `deploy:sepolia` çalıştırın.

**Sonraki adım:** [Bölüm 7 — Ekosistem](./07-ecosystem.md)
