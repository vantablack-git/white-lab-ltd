# WhiteLab Protocol Console

Static operational dApp for local demos and testnet review.

```bash
npm run frontend
```

Open `http://127.0.0.1:4173`. The console reads:

- `deployments/hardhat.json`
- Hardhat artifact ABIs under `artifacts/contracts/`
- Injected wallet provider from the browser

The UI intentionally labels mainnet blockers instead of presenting the protocol as audited or production-safe.
