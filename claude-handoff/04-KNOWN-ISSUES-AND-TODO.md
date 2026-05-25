# WhiteLab — Bilinen Sorunlar ve Yapılacaklar

Claude için **öncelik sıralı** iş listesi.

---

## P0 — Launch blocker ✅ KAPALI

### 1. TokenSale token dağıtımı — FIXED

- `purchasedTokens` mapping + `claim(phase)` + `refund` entitlement sıfırlama
- Test: `WLABTokenSale.test.js` (E2E, double-claim, multi-buyer)

### 2. Transfer fee + ERC20Votes — FIXED (Option A)

- `_update()` fee: net + tek fee transfer + burn from feeReceiver
- Test: `WLABToken.test.js` → P0 votes regression

---

## P1 — Production kalitesi

| # | Görev | Komut / çıktı |
|---|--------|----------------|
| 3 | Coverage ≥95% | `npx hardhat coverage` |
| 4 | Fuzz test (stake, vesting) | Hardhat veya Foundry doc |
| 5 | Sepolia deploy | `npm run deploy:sepolia` + `deployments/base-sepolia.json` doldur |
| 6 | Basescan verify | `scripts/verify.js` |
| 7 | Slither temiz Critical/High | `slither contracts/` |

---

## P2 — Roadmap

| # | Görev |
|---|--------|
| 8 | LayerZero OFT gerçek implementasyon (stub kaldır) |
| 9 | `WLABVeToken` + Governor entegrasyonu |
| 10 | Subgraph (The Graph) |
| 11 | Minimal React dashboard (ayrı `whitelab-app/` repo önerilir) |

---

## P3 — Launch öncesi

| # | Görev |
|---|--------|
| 12 | Tier-1 audit (OZ / Certik / Trail of Bits) |
| 13 | Hukuki opinion letter |
| 14 | Gnosis Safe 4/7 + admin handover |
| 15 | Uniswap v3 LP + 12 ay kilit |
| 16 | Immunefi bug bounty |

---

## Dokümantasyon sync

Kod değişince güncelle:
- `docs/04-smart-contracts.md` — API değişiklikleri
- `ARCHITECT_LOG.md` — ACTION / VERIFY satırları
- `docs/06-deployment.md` — yeni adresler

---

## Başarı kriteri (P0 bitince)

```bash
npm test          # 20+ test, 0 fail
npx hardhat compile
# TokenSale E2E: buy → finalize → claim → balance > 0
```
