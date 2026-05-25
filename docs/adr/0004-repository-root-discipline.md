# ADR 0004: Repository Root Discipline

Status: Accepted

## Context

The repository root contained protocol source, Turkish operator documents, internal handoff material, QA notes, and generated/static data. That made it harder to identify canonical source files and public protocol entrypoints.

## Decision

The root should expose only project entrypoints and canonical source directories. Phase 4 moved:

- Turkish guides to `docs/tr/`.
- Internal logs and handoff material to `docs/internal/`.
- Windows setup script to `scripts/setup/`.
- Root `tokenomics.json` out of source control; `shared/tokenomics.json` is canonical.

The migration is documented in `docs/repo-structure-map.md`.

## Consequences

- Public readers see a cleaner root.
- Internal scaffolding remains available but is not presented as protocol documentation.
- Build output still exposes `/tokenomics.json`; source control does not duplicate tokenomics data at the root.
