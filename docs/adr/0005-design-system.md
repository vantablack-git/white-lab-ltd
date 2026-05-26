# ADR 0005: Design System and Motion Language

Status: Accepted

## Context

Marketing site and protocol console evolved separately. Users need a coherent black-white visual language, accessible motion, and shared spacing/type scales without logo clutter.

## Decision

White Lab uses a shared token file at `shared/tokens.css`:

- Pure black background with white/gray ink hierarchy
- Thin italic wordmark: **White Lab** (no separate logo mark in production UI)
- Shared spacing, typography, easing, and duration tokens
- `prefers-reduced-motion` disables nonessential animation globally

Marketing site carries cinematic ambient motion (aurora, orb, scan sheen). Console stays denser and audit-friendly while using the same tokens.

## Consequences

- Both surfaces import `shared/tokens.css`
- New UI work must use tokens, not ad hoc hex values
- Console must not reintroduce colorful chart palettes; tokenomics visuals use grayscale steps
- Motion additions require reduced-motion parity
