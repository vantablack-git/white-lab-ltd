# Autopilot Analytics Events

The public site and protocol console emit privacy-conscious conversion events. The event bridge is provider-neutral:

- if `window.plausible` exists, it sends Plausible custom events;
- if `window.posthog` exists, it sends PostHog events;
- it always stores a bounded local queue in `localStorage` for debugging and manual reporting.

No wallet private data, seed phrase, private key, card data, bank data, or raw signature payload is tracked.

## Event Taxonomy

| Event | Surface | Trigger | Properties |
| --- | --- | --- | --- |
| `open_console` | marketing | User clicks console CTA | `source`, `path` |
| `whitepaper_open` | marketing | User clicks whitepaper link | `source`, `path` |
| `tr_page_open` | marketing | Turkish page loads | `path` |
| `tokenomics_interaction` | marketing | Allocation row/donut interaction | `bucket`, `percent` |
| `copy_contract_address` | marketing + console | User copies address | `contract`, `chainId`, `network` |
| `wallet_connect_click` | console | User clicks Connect Wallet | `path` |
| `wallet_connected` | console | Wallet connection succeeds | `chainId`, `expectedChainId`, `networkOk` |
| `chain_mismatch` | console | Connected wallet chain differs from manifest | `connectedChainId`, `expectedChainId` |
| `tx_intent` | console | User submits a tx flow | `action` |
| `tx_submitted` | console | Transaction hash returned | `action`, `chainId` |
| `tx_confirmed` | console | Transaction receipt confirmed | `action`, `chainId` |
| `tx_failed` | console | Transaction flow fails | `action`, `reason` |

## Provider Setup

### Plausible

Add Plausible script to the deployed site only after the domain is final:

```html
<script defer data-domain="YOUR_DOMAIN" src="https://plausible.io/js/script.js"></script>
```

### PostHog

Use PostHog only if deeper funnel analytics are needed. Keep session replay disabled until privacy policy is updated.

## Reporting

Weekly reports should summarize:

- total console CTA clicks;
- wallet connect attempts;
- successful wallet connects;
- chain mismatch count;
- whitepaper opens;
- Turkish page opens;
- top copied contract addresses;
- tx intent/submission/confirmation ratio.
