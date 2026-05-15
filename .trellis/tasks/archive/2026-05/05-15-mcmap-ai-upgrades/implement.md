# Implementation Plan

## P0: Improve AI decision quality

- [x] Add richer search scoring with deterministic match reasons.
- [x] Return scoring metadata in formatted search results.
- [x] Build descriptor-resolution helpers and expose readable descriptors where available.
- [x] Replace bare text tool errors with structured JSON error payloads.
- [x] Extend smoke coverage for:
  - fuzzy ranking
  - readable descriptors
  - structured errors

## P1: Improve translation and namespace capability

- [x] Define and implement real `translate_mode` semantics.
- [x] Add safe cross-namespace enrichment where source data supports reliable joins.
- [x] Add `legacy-yarn` namespace support.
- [x] Add `quilt-mappings` namespace support.
- [x] Clarify modern SRG-related behavior and documentation.
- [x] Extend smoke coverage for:
  - reverse lookup
  - extra namespaces
  - cross-namespace enrichment

## P2: Add optional breadth and presentation

- [x] Add optional ecosystem dependency recommendations without changing the default core-loader contract.
- [x] Add opt-in human-readable formatting while keeping JSON default.
- [x] Document AI-first usage guidance and caveats in README.
- [x] Add smoke coverage for opt-in presentation paths and recommendation paths if introduced.

## Validation

- [x] `npm run build`
- [x] `npm run check`
- [x] `npm run smoke`
- [x] Manual sample queries for representative P0/P1/P2 behavior

## Rollback Points

- Ranking changes can be reverted independently from namespace expansion.
- Descriptor rendering is additive and can be disabled without touching raw descriptors.
- P1 namespace modules should remain isolated so any unstable source can be withdrawn without affecting the existing namespaces.
