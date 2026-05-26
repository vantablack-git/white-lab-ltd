# WhiteLab Command Center

Default platform: **Notion**.

The command center is the daily operating surface for WhiteLab. It separates automated background work from manual approvals and keeps every material action logged.

## Top-Level Pages

| Page | Purpose |
| --- | --- |
| WhiteLab Command Center | Home dashboard and weekly priorities |
| Access Map | Where accounts live and who owns access |
| Treasury Ledger | ETH/BTC/DOGE and fiat movement records |
| Marketing Calendar | Content, announcements, and campaign schedule |
| Growth Experiments | Measurable experiments and outcomes |
| Audit Log | Immutable operational action log |
| Approval Queue | Manual approval tasks for sensitive actions |
| Weekly Reports | Generated weekly operating summaries |

## Dashboard Blocks

- Current launch status: testnet candidate, audit pending, mainnet blocked.
- Open blockers: Base Sepolia env, external audit, Safe rehearsal, legal/compliance.
- This week: three highest priority tasks.
- Treasury summary: public balances or manually entered balances, no secrets.
- Growth summary: visits, console opens, wallet connect clicks, whitepaper views.
- Approval queue: pending owner actions.
- Latest automation runs: deploy logs, report runs, failed jobs.

## Cadence

| Cadence | Action |
| --- | --- |
| Daily | Review Approval Queue and failed automation jobs |
| Twice weekly | Review Growth Experiments and Marketing Calendar |
| Weekly | Generate Weekly Report and reconcile Treasury Ledger |
| Per deploy | Write Audit Log entry and publish manifest checksum |
| Per campaign | Create campaign brief, track source links, capture result |

## Human Approval Rule

Autopilot may prepare work, but the owner signs or approves:

- bank cashout
- crypto transfer
- wallet signature
- card payment
- DNS/domain change
- production deploy
- contract admin action
- public social post
- email campaign send
