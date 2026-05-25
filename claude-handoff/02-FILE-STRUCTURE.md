# WhiteLab — Dosya Yapısı

```
whitelab/
│
├── claude-handoff/              ← Claude'a verilecek brief paketi (BU KLASÖR)
│   ├── 00-README-CLAUDE-HANDOFF.md
│   ├── 01-PROJECT-STATUS.md
│   ├── 02-FILE-STRUCTURE.md
│   ├── 03-ARCHITECTURE-DECISIONS.md
│   ├── 04-KNOWN-ISSUES-AND-TODO.md
│   ├── 05-CLAUDE-PROMPT-TEMPLATE.md
│   └── 06-COMPLETION-CHECKLIST.md
│
├── ARCHITECT_LOG.md             ← Tüm mimari kararlar + faz logları (GÜNCEL TUT)
├── README.md                    ← Hızlı başlangıç
├── package.json                 ← npm scripts
├── hardhat.config.js            ← Base Sepolia + Base mainnet, Solidity 0.8.26, Cancun
├── .env.example                 ← PRIVATE_KEY, RPC, ETHERSCAN_API_KEY
│
├── docs/                        ← Master rehber (Bölüm 0–9)
│   ├── 00-conceptual-foundation.md
│   ├── 01-identity-strategy.md
│   ├── 02-whitepaper.md
│   ├── 03-tokenomics.md
│   ├── 04-smart-contracts.md
│   ├── 05-security-audit.md
│   ├── 06-deployment.md
│   ├── 07-ecosystem.md
│   ├── 08-crosschain-defi.md
│   ├── 09-sustainability.md
│   ├── team-public.md
│   └── team-anon.md
│
├── contracts/                   ← Production Solidity
│   ├── WLABToken.sol            ← ERC20 + Permit + Votes + fee + compliance
│   ├── WLABVesting.sol          ← Cliff + linear + revoke
│   ├── WLABStaking.sol          ← 30/90/180/365 gün tier
│   ├── WLABGovernor.sol         ← OZ Governor + timelock
│   ├── WLABTokenSale.sol        ← IDO 3 faz (⚠️ P0 fix gerekli)
│   ├── WLABVeToken.sol          ← Vote escrow (Faz 2)
│   ├── WLABOFTAdapter.sol       ← Bridge stub (Faz 2)
│   └── upgrades/
│       └── WLABTreasuryUUPS.sol ← UUPS treasury
│
├── test/                        ← Hardhat / Mocha / Chai
│   ├── WLABToken.test.js
│   ├── WLABVesting.test.js
│   ├── WLABStaking.test.js
│   ├── WLABGovernor.test.js
│   ├── WLABTokenSale.test.js
│   └── integration.test.js
│
├── scripts/
│   ├── deploy.js                ← Full stack deploy
│   └── verify.js                ← Basescan verify
│
├── deployments/
│   └── base-sepolia.json        ← Deploy sonrası adresler
│
├── artifacts/                   ← Derleme çıktısı (gitignore önerilir)
├── cache/
└── node_modules/
```

---

## Hangi dosyayı ne zaman paylaş?

| Claude görevi | Minimum dosyalar | İdeal |
|---------------|------------------|-------|
| TokenSale düzelt | `WLABTokenSale.sol`, `WLABVesting.sol`, ilgili test | + tüm `contracts/` |
| Güvenlik review | `contracts/*.sol`, `docs/05` | + `test/` |
| Deploy | `scripts/deploy.js`, `hardhat.config.js`, `.env.example` | + `deployments/` |
| Whitepaper edit | `docs/02`, `docs/03` | — |
| Full complete | `claude-handoff/*` + tüm repo | ZIP veya GitHub |

---

## Git önerisi (Claude ile çalışırken)

```bash
git init
git add docs contracts test scripts claude-handoff ARCHITECT_LOG.md README.md
# node_modules, artifacts, cache, .env → .gitignore'da zaten
git commit -m "WhiteLab v1.0 MVP monorepo"
```

Claude'a **GitHub link** vermek, dosya yapıştırmaktan daha verimli olur.
