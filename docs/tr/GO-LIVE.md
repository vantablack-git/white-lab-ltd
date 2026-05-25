# WhiteLab — Go Live (tamamlanmış MVP)

Kod ve site **testnet launch** için hazır. Mainnet için audit + Safe zorunlu.

## Tek komut — lokal demo (önerilen)

```powershell
cd white-lab\white-lab\whitelab
npm install
npm run deploy:local:demo
npm run build:site
npm run preview:site
```

| URL | Açıklama |
|-----|----------|
| http://127.0.0.1:4173/ | Marketing |
| http://127.0.0.1:4173/app | Console (IDO açık) |
| http://127.0.0.1:4173/legal | Hukuki uyarı |

## Canlı testnet (Base Sepolia)

1. `.env` doldur (`PRIVATE_KEY`, `BASE_SEPOLIA_RPC`, `ETHERSCAN_API_KEY`, `TREASURY_ADDRESS`)
2. `npm run env:check`
3. `npm run deploy:sepolia:demo`
4. `npm run verify`
5. `npm run build:site` → Cloudflare **Retry deployment**

## Multisig (mainnet öncesi)

```powershell
# .env → MULTISIG_ADDRESS=0xYourSafe...
npm run handover:multisig -- --network baseSepolia
npm run build:site
```

## Mainnet blokörleri (kod dışı)

- Tier-1 audit
- Hukuki görüş
- Uniswap LP sermayesi
- LayerZero OFT (köprü şu an kapalı stub)

Detay: [LAUNCH.md](./LAUNCH.md) · [SENIN-ADIMLAR.md](./SENIN-ADIMLAR.md)
