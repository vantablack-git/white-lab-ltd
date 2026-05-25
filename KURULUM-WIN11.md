# WhiteLab — Windows 11 Kurulum Rehberi

Bu rehber, `whitelab` monorepo'sunun **kapsamını**, **yapısını** ve **tek script ile kurulumunu** anlatır.

**Çalışma dizini:**

```powershell
cd C:\Users\zylmz\Documents\Project\WLAB\white-lab\white-lab\whitelab
```

---

## 1. Proje nedir?

**WhiteLab Launch OS** — Base zincirinde audit-ready token launchpad:

| Bileşen | Açıklama |
|---------|----------|
| **WLAB** | ERC-20 token (max 1B), fee, pause, blacklist, votes |
| **IDO** | 3 fazlı satış (Seed / Private / Public), claim, refund |
| **Vesting / Staking / Lock Vault / Governor** | Tam protokol yığını (weighted governance lock — decay yok) |
| **Site** | Marketing (`website/`) + Protocol console (`frontend/`) |
| **Zincir** | Test: Base Sepolia (84532) → Prod: Base (8453) |

**Durum:** MVP launch-ready — **50 passing** test, lokal demo deploy, statik site build.

---

## 2. Dizin yapısı

```
whitelab/
├── contracts/          # 8 production Solidity (+ test mocks)
├── test/               # 11 test dosyası (Hardhat)
├── scripts/            # deploy, verify, build-site, e2e, env check
├── deployments/        # hardhat.json, base-sepolia.json (deploy sonrası)
├── frontend/           # Protocol console (ethers + MetaMask)
├── website/            # Marketing, whitepaper, legal
├── shared/             # tokenomics.json, dom-utils.js
├── docs/               # Bölüm 0–13 master dokümantasyon
├── dist/               # Cloudflare Pages çıktısı (npm run build:site)
├── .github/workflows/  # CI: Node 20, compile, test, e2e, coverage, build
├── setup-win11.ps1     # ← Bu makinedeki ana kurulum scripti
└── package.json        # npm scriptleri
```

---

## 3. Gereksinimler

| Araç | Zorunlu? | Not |
|------|----------|-----|
| **Node.js** ≥ 18 (öneri: **20 LTS**) | Evet | Sende v22 çalışıyor; CI Node 20 |
| **npm** | Evet | Node ile gelir |
| **Git** | GitHub/Cloudflare için | Şu an PATH'te yok — script kurabilir |
| **MetaMask** | Canlı /app için | Base Sepolia ağı ekle |
| **Python + Slither** | Hayır | P1 güvenlik analizi |
| **GitHub CLI (`gh`)** | Hayır | PR/issue kolaylığı |

Harici (testnet/mainnet):

- `.env` → `PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `TREASURY_ADDRESS`
- Base Sepolia ETH → [Coinbase faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
- Basescan API → [basescan.org/myapikey](https://basescan.org/myapikey)

---

## 4. Tek komut — lokal MVP (önerilen)

PowerShell'i **whitelab** klasöründe aç:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
.\setup-win11.ps1 -StartPreview
```

Bu komut sırayla:

1. Ön koşulları kontrol eder  
2. `npm install` → `compile` → **50 test** → `e2e:local`  
3. `deploy:local:demo` → `build:site`  
4. `http://127.0.0.1:4173` önizlemesini başlatır  

| URL | Sayfa |
|-----|--------|
| http://127.0.0.1:4173/ | Marketing |
| http://127.0.0.1:4173/app | Protocol console |
| http://127.0.0.1:4173/legal | Risk uyarısı |
| http://127.0.0.1:4173/whitepaper | Whitepaper |

---

## 5. Script parametreleri

```powershell
# Sadece kontrol
.\setup-win11.ps1 -Phase check

# Git (+ opsiyonel araçlar) kur
.\setup-win11.ps1 -Phase tools -InstallTools

# Lokal pipeline (varsayılan)
.\setup-win11.ps1 -Phase local

# Hızlı build (test atla)
.\setup-win11.ps1 -SkipTests

# Geliştirme sunucusu (frontend + website kaynak)
.\setup-win11.ps1 -StartDevServer

# Base Sepolia (.env dolu olmalı)
.\setup-win11.ps1 -Phase testnet

# Araç kur + lokal + .env hazırsa testnet dene
.\setup-win11.ps1 -Phase full -InstallTools
```

Log dosyası: `setup-win11.log`

---

## 6. `.env` — testnet

Lokal kurulumda `.env` **gerekmez** (placeholder anahtar Hardhat derlemesini bozar).  
Sadece Base Sepolia deploy öncesi oluştur:

```powershell
copy .env.example .env
notepad .env
```

Doldur:

```env
PRIVATE_KEY=anahtar_0x_olmadan
BASE_SEPOLIA_RPC=https://sepolia.base.org
ETHERSCAN_API_KEY=basescan_anahtarin
TREASURY_ADDRESS=0xSeninCüzdanAdresin
```

Doğrula ve deploy:

```powershell
npm run env:check
.\setup-win11.ps1 -Phase testnet
```

---

## 7. Market yol haritası (sıra)

| Adım | Süre | Komut / aksiyon |
|------|------|-----------------|
| A) Lokal doğrulama | 3 dk | `.\setup-win11.ps1` |
| B) GitHub push | 5 dk | Git kur → `git init` → push |
| C) Cloudflare Pages | 5 dk | Build: `npm run build:site`, Output: `dist` |
| D) Base Sepolia | 10 dk | `.env` + `.\setup-win11.ps1 -Phase testnet` |
| E) Mainnet | Sonra | Audit + Safe multisig + LP + legal |

Detay checklist: [SENIN-ADIMLAR.md](./SENIN-ADIMLAR.md) · [GO-LIVE.md](./GO-LIVE.md)

---

## 8. npm script referansı

| Script | Ne yapar |
|--------|----------|
| `npm test` | 50 Hardhat testi |
| `npm run e2e:local` | IDO + stake + vesting E2E |
| `npm run deploy:local:demo` | Lokal kontrat + demo IDO |
| `npm run build:site` | `dist/` (Cloudflare) |
| `npm run preview:site` | Statik önizleme :4173 |
| `npm run start` | Dev sunucu (kaynak HTML) |
| `npm run deploy:sepolia:demo` | Canlı testnet |
| `npm run verify` | Basescan verify |
| `npm run handover:multisig` | Safe devretme (mainnet öncesi) |

---

## 9. Mainnet öncesi blokörler (kod dışı)

WhiteLab **henüz audit edilmedi** — README ve `docs/10-production-candidate-readiness.md` bunu açıkça belirtir:

- Tier-1 güvenlik denetimi  
- Gnosis Safe 4/7 admin  
- Hukuki görüş / geo-block  
- Uniswap V3 LP + kilit  
- LayerZero OFT (şu an stub, kapalı)  

---

## 10. Sorun giderme

| Sorun | Çözüm |
|-------|--------|
| `npm` tanınmıyor | Node kur, terminali yeniden aç |
| `git` tanınmıyor | `.\setup-win11.ps1 -Phase tools -InstallTools` |
| Script çalışmıyor | `Set-ExecutionPolicy RemoteSigned` |
| Test fail | `npm run compile` sonra `npm test` |
| Sepolia deploy fail | `.env`, faucet ETH, `npm run env:check` |
| MetaMask bağlanmıyor | Ağ: Base Sepolia (84532), RPC: sepolia.base.org |

---

*Son doğrulama: compile OK, 50 passing, E2E PASSED, build:site OK — Windows 11 / Node 22.*
