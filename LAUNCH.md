# WhiteLab — Launch Guide

## Local (2 min)

```bash
npm install
npm test
npm run deploy:local:demo
npm run build:site
npm run preview:site
# OR static preview:
npm run build:site
npm run preview:site
```

| URL | Page |
|-----|------|
| http://127.0.0.1:4173/ | Marketing |
| http://127.0.0.1:4173/app | Protocol console |
| http://127.0.0.1:4173/whitepaper | Whitepaper |

## Cloudflare Pages (free, no domain)

1. Push repo to GitHub  
2. Cloudflare → Pages → Connect repository  
3. **Build command:** `npm run build:site`  
4. **Output directory:** `dist`  
5. Deploy → use `https://<project>.pages.dev`

Routing is handled by `dist/_redirects` (`/app`, `/whitepaper`).

After Sepolia deploy, run `npm run build:site` again and redeploy so `dist/deployments/` includes live addresses.

## Base Sepolia

```bash
cp .env.example .env
# PRIVATE_KEY, BASE_SEPOLIA_RPC, ETHERSCAN_API_KEY, TREASURY_ADDRESS
npm run env:check
npm run deploy:sepolia
npm run verify
npm run build:site
```

Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

## Tokenomics source of truth

Edit only: `shared/tokenomics.json`  
Copied to: `tokenomics.json` (site root) on deploy/build.

## Mainnet blockers

- Gnosis Safe admin handover (`scripts/deploy.js` TODO block)
- External audit
- Uniswap V3 LP
- Legal disclaimers

## Turkish quick checklist

See [SENIN-ADIMLAR.md](./SENIN-ADIMLAR.md).
