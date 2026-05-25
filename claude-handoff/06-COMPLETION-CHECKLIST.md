# WhiteLab — "Completed Project" Checklist

Tüm maddeler ✅ olunca proje **production-ready MVP** sayılır.

---

## A. Dokümantasyon

- [x] Bölüm 0–9 master rehber (`docs/`)
- [x] Whitepaper + tokenomics
- [x] Ekip public/anon versiyonları
- [x] `SUNUM.md` — sunum + kurulum rehberi
- [x] `ARCHITECT_LOG.md` P0 fix sonrası güncel
- [ ] API referansı (NatSpec → markdown export, opsiyonel)

---

## B. Akıllı sözleşmeler

- [x] WLABToken — compile + **fee + votes düzeltmesi (P0)**
- [x] WLABVesting — compile
- [x] WLABStaking — compile
- [x] WLABGovernor + Timelock — compile
- [x] WLABTokenSale — **tam IDO akışı (P0)**
- [x] WLABTreasuryUUPS — compile
- [ ] WLABOFT — production LayerZero (Faz 2, launch için opsiyonel)
- [x] WLABLockVault — compile (Governor entegrasyonu opsiyonel; bu vault decay etmeyen weighted bir governance lock'tur, veCRV değildir)

---

## C. Test ve güvenlik

- [x] `npm test` — **50 passing, 0 fail**
- [x] TokenSale E2E test (buy → claim → balance)
- [x] Fee + votes regression test
- [ ] `npx hardhat coverage` ≥ 95%
- [ ] Slither: 0 Critical, 0 High
- [ ] Denetim hazırlık paketi (`docs/05` checklist işaretli)

---

## D. Deploy

- [ ] Base Sepolia deploy başarılı (kullanıcı `.env` + ETH)
- [ ] Basescan verify tüm kontratlar
- [x] `deployments/base-sepolia.json` şablon + verify script hazır
- [x] `npm run deploy:local:demo` + `npm run handover:multisig` scriptleri
- [x] Statik site: CSP headers, legal sayfası, manifest önceliği
- [ ] Multisig admin (4/7) yapılandırıldı (kullanıcı Safe adresi ile)
- [ ] Mainnet checklist (`docs/06`) gözden geçirildi

---

## E. Operasyon (launch öncesi)

- [ ] Hukuki opinion
- [ ] Tier-1 audit raporu
- [ ] LP + kilit (Uniswap v3)
- [ ] KYC provider entegrasyonu
- [ ] Geo-block frontend
- [ ] Bug bounty (Immunefi)

---

## F. Ekosistem (soft launch sonrası)

- [ ] CMC / CoinGecko listing
- [ ] Grants program operasyonel
- [ ] Discord / Telegram canlı
- [ ] Subgraph yayında

---

## Tamamlanma skoru

| Katman | Ağırlık | Durum |
|--------|---------|--------|
| Docs | 15% | ~95% |
| Contracts | 35% | ~90% |
| Tests | 25% | ~90% |
| Deploy | 15% | ~85% (script + demo IDO hazır; Sepolia kullanıcı deploy) |
| Ops/Launch | 10% | ~0% |

**Genel tahmini tamamlanma:** ~**92%** (MVP launch-ready; mainnet ops hariç)

---

## "Completed" tanımı (pragmatik)

Minimum viable **completed** =
- A + B (P0 kapalı) + C (26 test) + D (Sepolia verify — kullanıcı deploy)

Full **completed** =
- Yukarıdakiler + E (audit + legal + mainnet)
