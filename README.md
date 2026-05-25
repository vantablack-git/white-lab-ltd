# WhiteLab ($WLAB)

**WhiteLab Launch OS** — Base üzerinde audit-ready token launchpad, DAO ve compliance modülleri.

> **Sunum ve eksiksiz kurulum:** [SUNUM.md](./SUNUM.md) (Türkçe, adım adım + mimari + P0 özeti)  
> **Windows 11 PowerShell:** [KURULUM-WIN11.md](./KURULUM-WIN11.md) + `.\setup-win11.ps1`

## Hızlı başlangıç

```bash
cd whitelab
cp .env.example .env
# PRIVATE_KEY ve ETHERSCAN_API_KEY doldur
npm install
npx hardhat compile
npm test
npm run e2e:local
npm run frontend
```

Beklenen: **50 passing** test.

```bash
npm run deploy:local
npm run start
```

- Site: `http://127.0.0.1:4173`
- Console: `http://127.0.0.1:4173/app`

Detaylı launch: [LAUNCH.md](./LAUNCH.md)  
**Senin checklist:** [SENIN-ADIMLAR.md](./SENIN-ADIMLAR.md)  
Cloudflare: `npm run build:site` → output `dist/`

## Deploy (Base Sepolia)

```bash
npm run deploy:sepolia
npm run verify
```

Adresler: `deployments/baseSepolia.json`

Mainnet: `npm run deploy:base` → `npm run verify:base`

## Yapı

| Dizin | İçerik |
|-------|--------|
| `docs/` | Bölüm 0–9 master rehber |
| `contracts/` | 8 production Solidity sözleşmesi |
| `test/` | Hardhat test suite (47+ test) |
| `scripts/` | Deploy & verify |
| `frontend/` | Static protocol console |
| `SUNUM.md` | Sunum + divine komut + P0/P1 özeti |
| `ARCHITECT_LOG.md` | Mimari karar logu |

## Kontratlar

| Sözleşme | Rol |
|----------|-----|
| `WLABToken` | ERC-20 + Votes + fee + compliance |
| `WLABTokenSale` | 3 fazlı IDO, claim, refund |
| `WLABVesting` | Cliff + linear vesting |
| `WLABStaking` | Tier lock + rewards |
| `WLABGovernor` | DAO + Timelock |
| `WLABVeToken` | Vote escrow |
| `WLABOFTAdapter` | Cross-chain stub (Faz 2) |
| `WLABTreasuryUUPS` | Upgradeable treasury |

## Zincir

- **Testnet:** Base Sepolia (`chainId` 84532)
- **Mainnet:** Base (`chainId` 8453)

## Token

- **Sembol:** WLAB
- **Max supply:** 1,000,000,000
- **Standard:** ERC-20 (+ Permit, Votes, compliance)

## Lisans

MIT — eğitim ve geliştirme. Mainnet öncesi profesyonel audit ve hukuki görüş zorunludur.

## Claude handoff

AI devam paketi: [claude-handoff/](./claude-handoff/) — `00-README-CLAUDE-HANDOFF.md` ile başla.

## Production Candidate Notes

- Readiness summary: [docs/10-production-candidate-readiness.md](./docs/10-production-candidate-readiness.md)
- Operations runbook: [docs/11-operations-runbook.md](./docs/11-operations-runbook.md)
- User guides: [docs/12-user-guides.md](./docs/12-user-guides.md)

WhiteLab remains unaudited and is not mainnet-ready until audit, Safe/timelock handover, Slither, coverage uplift, and bridge replacement are complete.
