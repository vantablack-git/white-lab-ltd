# Senin adımların (15 dakika checklist)

Repo **testnet adayı** durumda. Mainnet için audit, legal, Safe doğrulaması ve launch operasyon kapıları hâlâ zorunlu.

## A) Lokal kontrol (3 dk)

```powershell
cd "white-lab\white-lab\whitelab"
npm install
npm test
npm run deploy:local:demo
npm run build:site
npm run preview:site
```

Tarayıcı:
- http://127.0.0.1:4173 → ana site
- http://127.0.0.1:4173/app → console (Public IDO açık)
- http://127.0.0.1:4173/legal → risk uyarısı

## B) GitHub (5 dk)

```powershell
git init
git add .
git commit -m "WhiteLab testnet candidate"
git branch -M main
git remote add origin SENIN_REPO_URL
git push -u origin main
```

## C) Cloudflare Pages — domain yok, $0 (5 dk)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → Connect GitHub  
2. Repo seç  
3. Ayarlar:
   - **Build command:** `npm run build:site`
   - **Build output directory:** `dist`
   - **Node version:** 20  
4. Deploy  

Site: `https://XXXX.pages.dev`

## D) Base Sepolia — canlı kontrat (10 dk)

1. `copy .env.example .env`  
2. Doldur: `PRIVATE_KEY`, `BASE_SEPOLIA_RPC`, `ETHERSCAN_API_KEY`, `TREASURY_ADDRESS`  
3. Faucet → test ETH  
4. `npm run env:check`  
5. `npm run deploy:sepolia:demo`  
6. `npm run verify`  
7. `npm run build:site` → Cloudflare **Retry deployment**

MetaMask → **Base Sepolia** → `https://XXXX.pages.dev/app`

## E) Mainnet (sonra)

- Gnosis Safe → `npm run handover:multisig -- --network base`
- `npm run deploy:base`
- Audit + LP + legal

---

**Rehber:** [GO-LIVE.md](./GO-LIVE.md) · Tokenomics: `shared/tokenomics.json`
