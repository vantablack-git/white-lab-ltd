# WhiteLab — Tamamlama Yol Haritası (Master Plan)

**Tarih:** 2026-05-30  
**Durum:** 7 makro aşama · **Aşama 1–2 tamamlandı** · Aşama 3 operatör · Aşama 4–7 sırayla

Bu doküman, projeyi bitirmek için gereken tüm aşamaları tek yerde toplar. Cloud Agent bu sırayı **auto-continue** ile takip eder; operatör-blocked adımlar `.env` / audit / legal gerektirir.

---

## Özet tablo

| Aşama | Ad | Durum | Kim yapar | Çıktı |
| --- | --- | --- | --- | --- |
| **1** | Protokol çekirdeği | ✅ Bitti | Agent | 192 test, 95.45% branch coverage |
| **2** | Sunum katmanı (web/mobil) | ✅ Bitti | Agent | Site + console responsive, OG, PR #6 |
| **3** | Testnet canlı deploy | ⏳ Bekliyor | **Operatör** | Base Sepolia manifest + Basescan verify |
| **4** | Güvenlik & uyum | ⏳ Bekliyor | **Operatör + audit firması** | Audit raporu, legal opinion, bug bounty |
| **5** | API Intelligence (yan gelir) | 🔄 Bu oturum | Agent | Araştırma doc + `/apis` dizini |
| **6** | Soft launch operasyonu | ⏳ Aşama 3–4 sonrası | Operatör + Agent | CMC/CG listing, Discord, grants |
| **7** | Mainnet release | ⏳ Audit sonrası | Safe + operatör | `npm run deploy:base` ceremony |

**Kalan agent-executable iş:** Aşama 5 (bu PR) + Aşama 6 dokümantasyon/otomasyon parçaları.  
**Kalan operatör iş:** Aşama 3 `.env` + Safe, Aşama 4 audit/legal.

---

## Aşama 1 — Protokol çekirdeği ✅

| Kontrol | Kanıt |
| --- | --- |
| 8 kontrat compile | `npm run compile` |
| 192 regression test | `npm test` |
| E2E local IDO → claim | `npm run e2e:local` |
| Multisig deploy policy | `scripts/lib/deployment-policy.js` |
| Slither CI gate | `.github/workflows/ci.yml` |
| 30-phase internal roadmap | `docs/internal/ROADMAP-30.md` |

---

## Aşama 2 — Sunum katmanı ✅

| Kontrol | Kanıt |
| --- | --- |
| Marketing + TR + whitepaper + legal | `website/` |
| Protocol console `/app` | `frontend/` |
| Mobil hamburger nav (tüm sayfalar) | `website/css/site.css` @900px |
| Cloudflare static build | `npm run build:site` → `dist/` |
| OG / SEO meta | `public/og-card.svg` |

**Deploy:** PR merge → Cloudflare Pages otomatik.

---

## Aşama 3 — Testnet canlı deploy ⏳ (Operatör)

**Süre:** ~1 oturum (credentials hazırsa)

```bash
cp .env.example .env
# PRIVATE_KEY, BASE_SEPOLIA_RPC, ETHERSCAN_API_KEY,
# TREASURY_ADDRESS, MULTISIG_ADDRESS (Gnosis Safe ≠ deployer)

npm run env:check
npm run deploy:sepolia
npm run verify
npm run build:site
git add deployments/ public/deployments.json
git commit -m "ops: Base Sepolia manifest"
git push
```

**Başarı kriteri:** `deployments/base-sepolia.json` dolu, site registry canlı adres gösterir, deployer yetkisi yok.

Rehber: `docs/internal/BASE-SEPOLIA-REHEARSAL.md`

---

## Aşama 4 — Güvenlik & uyum ⏳ (Operatör + dış firma)

| Madde | Tahmini süre | Maliyet bandı |
| --- | --- | --- |
| Tier-1 smart contract audit | 3–4 hafta | $15K–$50K |
| Remediation + re-audit | 1–2 hafta | Dahil / ek |
| Public bug bounty (Immunefi) | Audit sonrası | Havuz + ops |
| Legal/compliance opinion | Paralel | Değişken |
| Safe signer doğrulama | 1 gün | $0 |

Paket: `docs/audit-prep.md` · Checklist: `docs/pre-mainnet-checklist.md`

---

## Aşama 5 — API Intelligence (yan gelir katmanı) 🔄

**Amaç:** Freelancer / builder ekosistemine yönelik **ücretsiz + ücretli API** rehberi; WLAB ekosisteminin veri/scraping yan gelir hattı.

| Alt-adım | Durum | Dosya |
| --- | --- | --- |
| Web araştırması (scraping + crypto data) | ✅ | `docs/ecosystem/api-intelligence-research.md` |
| Yapılandırılmış API dizini (JSON) | ✅ | `shared/api-directory.json` |
| Public `/apis` sayfası | ✅ | `website/apis.html` |
| Monetizasyon modeli | ✅ Doc | Araştırma doc §6 |

**Gelir modelleri (dokümante):**
1. Affiliate / referral (ScraperAPI, Apify, Bright Data partner programları)
2. WhiteLab API Gateway (ücretli tier + WLAB stake indirimi)
3. Premium data bundle (crypto + scraping cookbook satışı)
4. Grants ile builder onboarding → protokol fee payback

---

## Aşama 6 — Soft launch operasyonu ⏳

Aşama 3–4 tamamlandıktan sonra:

- CoinGecko / CoinMarketCap listing başvurusu
- Discord / Telegram + Collab.Land token gate
- Grants program MVP (`docs/07-ecosystem.md`)
- Subgraph (The Graph) — sale/stake/gov events
- Public status page + incident contacts

Agent yapabilir: subgraph scaffold, Discord bot config template, listing checklist doc.

---

## Aşama 7 — Mainnet release ⏳

**Önkoşul:** Aşama 4 audit sign-off + Aşama 3 rehearsal kanıtı.

```bash
npm run env:check:base
npm run deploy:base
npm run verify:base
npm run handover:multisig -- --network base
```

Ceremony: `docs/internal/RC2-VALIDATION.md` · Mainnet checklist: `docs/06-deployment.md`

---

## Auto-continue kuralı (Agent)

1. Aşama sırasını atla — P0 önce protokol, sonra surface, sonra ops.
2. Operatör-blocked adımda dur, net `.env` / Safe / audit talebi yaz.
3. Her aşama sonunda: `npm run validate` + commit + PR güncelle.
4. DEC-001..009 değiştirme.
5. Public copy: "testnet candidate, audit pending" — mainnet-ready iddiası yok.

---

## İlgili dosyalar

- `docs/internal/LAUNCH-COMPLETION.md` — mevcut durum snapshot
- `docs/ecosystem/api-intelligence-research.md` — API araştırması
- `docs/tr/TAMAMLAMA-ROADMAP.md` — Türkçe özet
- `shared/api-directory.json` — site `/apis` veri kaynağı
