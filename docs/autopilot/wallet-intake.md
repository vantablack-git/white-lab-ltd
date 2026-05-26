# Wallet Intake

Fill this file with **public receive addresses only**. Do not add seed phrases, private keys, keystore files, wallet passwords, or 2FA recovery codes.

## Public Treasury Addresses

| Asset | Network | Purpose | Public address | Owner-held signing method | Status |
| --- | --- | --- | --- | --- | --- |
| ETH | Ethereum / Base-compatible EVM | Operating treasury receive address | `TODO_PUBLIC_ETH_ADDRESS` | Trust Wallet / Safe / hardware wallet | pending |
| BTC | Bitcoin | Long-horizon treasury receive address | `TODO_PUBLIC_BTC_ADDRESS` | Trust Wallet / hardware wallet | pending |
| DOGE | Dogecoin | Community treasury receive address | `TODO_PUBLIC_DOGE_ADDRESS` | Trust Wallet / hardware wallet | pending |

## Optional Separation

| Wallet | Purpose | Notes |
| --- | --- | --- |
| Hot wallet | Small daily operations | Keep low balance only |
| Treasury wallet | Main ETH/BTC/DOGE holdings | Prefer Safe/hardware wallet where supported |
| Receivables wallet | Public inbound payments | Can sweep manually to treasury |

## Rules

- Public addresses may be used in Notion, website config, reports, and n8n workflows.
- Signing remains manual.
- Cashout to bank is represented as an Approval Queue item, not an automated transfer.
- Any address replacement requires an Audit Log entry.
