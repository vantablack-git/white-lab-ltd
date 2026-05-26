# WhiteLab Autopilot Command Center

Status: **ready for setup, external accounts not connected**.

This folder is the repo-side source of truth for the WhiteLab Autopilot Ops system. It is designed to be imported into Notion, wired to n8n, and used as the control plane for marketing operations, treasury tracking, approvals, analytics, and weekly reporting.

## Operating Model

- Notion is the default command center.
- n8n is the automation layer.
- GitHub, Cloudflare, Plausible/PostHog, and public wallet addresses are connected with least-privilege access.
- Secrets, seed phrases, private keys, card details, bank credentials, wallet signatures, and 2FA codes remain outside the repo and outside agent context.
- The system can prepare payment/cashout/transfer tasks, but final approval and signing stay with the owner.

## Files

| File | Purpose |
| --- | --- |
| `command-center.md` | Notion page structure and operating cadence |
| `database-schemas.md` | Notion database schemas for access, treasury, logs, approvals, reports |
| `wallet-intake.md` | Safe public-address intake for ETH, BTC, DOGE |
| `automation-workflows.md` | n8n workflow blueprints |
| `analytics-events.md` | Conversion and growth event taxonomy |
| `approval-policy.md` | Manual approval gate rules |

## Setup Order

1. Fill `wallet-intake.md` with public receive addresses only.
2. Create the Notion databases from `database-schemas.md`.
3. Connect analytics keys in the analytics provider, not in this repo.
4. Import n8n workflow blueprints from `automation-workflows.md`.
5. Run `npm run autopilot:report` to generate the first local ops report.

## Security Boundary

Never commit:

- seed phrases
- private keys
- wallet JSON files
- card data
- bank credentials
- API keys
- OAuth refresh tokens
- 2FA recovery codes
