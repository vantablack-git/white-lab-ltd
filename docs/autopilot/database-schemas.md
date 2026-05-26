# Autopilot Database Schemas

These schemas can be created in Notion or mirrored in another command center. Property names are stable because n8n workflows and local reports can refer to them.

## Access Map

Tracks which service exists, who owns it, and what level of access automation has.

| Property | Type | Notes |
| --- | --- | --- |
| Name | title | Service name |
| Category | select | `repo`, `hosting`, `analytics`, `wallet`, `social`, `payments`, `docs`, `automation` |
| URL | url | Login or dashboard URL |
| Owner | person/text | Human owner |
| Access Level | select | `owner-only`, `read-only`, `limited-write`, `automation-token`, `manual-login` |
| Secret Location | select/text | `1Password`, `Bitwarden`, `Notion redacted`, `not applicable` |
| Agent Can Operate | checkbox | True only for non-sensitive actions |
| Approval Required | checkbox | True for sensitive services |
| Status | select | `planned`, `active`, `blocked`, `deprecated` |
| Notes | text | Redacted operational notes |

## Treasury Ledger

Tracks money movement intent and records. It is not a bank or wallet.

| Property | Type | Notes |
| --- | --- | --- |
| Entry | title | Human-readable transaction or event name |
| Date | date | Date recorded |
| Direction | select | `inbound`, `outbound`, `internal-transfer`, `cashout-request`, `adjustment` |
| Asset | select | `ETH`, `BTC`, `DOGE`, `USD`, `EUR`, `TRY`, `WLAB`, `OTHER` |
| Amount | number | Native units |
| USD Estimate | number | Optional estimate |
| Source | text | Where funds came from |
| Destination | text | Public address, account label, or vendor |
| Tx / Receipt URL | url | Explorer, invoice, receipt |
| Approval ID | relation/text | Related Approval Queue item |
| Status | select | `draft`, `pending-approval`, `approved`, `completed`, `rejected`, `reconciled` |
| Notes | text | No secrets |

## Audit Log

Append-only operational record.

| Property | Type | Notes |
| --- | --- | --- |
| Event | title | Short action name |
| Timestamp | date | Time of action |
| Actor | select/text | `owner`, `agent`, `automation`, `github`, `cloudflare`, `n8n` |
| System | select | `repo`, `site`, `deploy`, `analytics`, `treasury`, `marketing`, `security` |
| Action | text | What changed |
| Link | url | PR, commit, dashboard, report |
| Result | select | `success`, `failed`, `blocked`, `pending`, `approved`, `rejected` |
| Approval Required | checkbox | Whether owner action was needed |
| Metrics Impact | text | Relevant metric movement |

## Approval Queue

Manual gate for sensitive work.

| Property | Type | Notes |
| --- | --- | --- |
| Request | title | Approval request name |
| Created | date | Creation time |
| Category | select | `payment`, `crypto-transfer`, `bank-cashout`, `dns`, `deploy`, `contract-admin`, `social-post`, `email-send` |
| Risk | select | `low`, `medium`, `high`, `critical` |
| Requested By | select/text | Agent, automation, owner |
| Summary | text | What will happen |
| Checklist | text | Pre-approval checks |
| Status | select | `pending`, `approved`, `rejected`, `completed`, `expired` |
| Evidence Link | url | Draft, tx preview, invoice, diff, report |
| Completed At | date | When done |

## Weekly Reports

| Property | Type | Notes |
| --- | --- | --- |
| Report | title | Week label |
| Week Start | date | Start date |
| Week End | date | End date |
| Traffic Summary | text | Analytics summary |
| Growth Summary | text | Campaign and experiment status |
| Treasury Summary | text | Ledger and approval summary |
| Engineering Summary | text | Repo/tests/deploy status |
| Blockers | text | Open risks |
| Next Actions | text | Top actions |
| Status | select | `draft`, `reviewed`, `sent` |

## Growth Experiments

| Property | Type | Notes |
| --- | --- | --- |
| Experiment | title | Short name |
| Hypothesis | text | What we expect |
| Channel | select | `seo`, `x`, `linkedin`, `community`, `content`, `referral`, `partnership` |
| Metric | select/text | Primary KPI |
| Start | date | Start date |
| End | date | End date |
| Status | select | `backlog`, `running`, `won`, `lost`, `inconclusive` |
| Result | text | Outcome |
