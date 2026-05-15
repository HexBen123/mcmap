# Technical Design

## Overview

This task upgrades `mcmap` in three stages:

1. P0 improves AI decision quality without expanding the namespace surface.
2. P1 expands translation and namespace capability while keeping joins conservative.
3. P2 adds lower-priority ecosystem breadth and optional presentation features.

The design goal is to keep `mcmap` as a structured fact service, then layer richer search and enrichment on top.

## Current Architecture Constraints

- `MappingRecord` is the central normalized model.
- Search currently loads one namespace at a time, scores flat records, then formats results.
- Tiny v2 parsing already exposes enough data to derive richer descriptor views for Yarn and Intermediary-backed records.
- Loader queries already source live metadata separately from mapping search.

## P0 Design

### Search ranking

Replace the current three-level score with a feature-based scorer.

Candidate features:

- exact primary-name match
- exact alternate-name match
- exact leaf-name match
- prefix match
- token or camel-case match
- owner leaf match
- descriptor match
- path-only substring match

Search results should keep deterministic ordering and expose:

- `score`
- `matchReasons`
- optionally `matchedNames`

### Readable descriptors

Build class-name lookup tables while loading mappings so descriptor types can be rendered in a named form when possible.

The stored record keeps the raw descriptor untouched. Formatting adds derivative fields such as:

- `readableDescriptor`
- optional namespace-specific descriptor variants later if needed

### Structured errors

Move from bare text errors to JSON payloads with:

- `code`
- `message`
- `namespace`
- `version`
- optional `suggestions`

Unknown failures can still fall back to a generic code.

## P1 Design

### Real translate mode

Interpret `translate_mode` as a query-direction constraint:

- `none`: search every available name field as today.
- `ab`: favor source-side names and emit target-side enrichments when available.
- `ba`: favor reverse-direction lookups from alternate names back to the namespace's primary output.

Because current public inputs do not expose arbitrary namespace pairs, the first real implementation should define clear behavior per namespace rather than pretending every pair is supported.

### Cross-namespace enrichment

Add enrichment only where joins are defensible:

- Yarn artifacts already contain intermediary and named values.
- Intermediary can be enriched from paired Yarn for the same Minecraft version when class/member identity can be matched safely.
- MCPConfig and CSV already merge SRG/MCP; modern SRG-style data can be clarified without fabricating Mojmap joins.

Join keys must include enough structure to avoid false positives:

- record kind
- owner
- descriptor when present
- stable source-side names

### Extra namespaces

Add:

- `legacy-yarn`
- `quilt-mappings`

Each namespace needs:

- list support
- version support
- artifact loading
- search support
- smoke coverage

If upstream artifact formats differ, add dedicated source modules instead of overloading unrelated loaders.

## P2 Design

### Ecosystem dependency recommendations

Keep `get_loader_versions` focused on authoritative loader coordinates.

If common optional dependencies are added, expose them through:

- a separate tool, or
- an explicit opt-in field

They must never obscure the core loader facts, and they must not masquerade as already-verified copy-paste coordinates when no version resolution has been performed.

### Human-readable output

Add an opt-in presentation mode while keeping JSON as the default response contract.

Recommended approach:

- `format: "json" | "human"` on search-related tools
- keep identical underlying result semantics

### Additional breadth

Consider lower-priority ecosystems only after the higher-value namespaces are stable.

## Compatibility

- Existing tool names remain unchanged.
- Existing JSON fields remain available.
- New fields are additive.
- Default output remains JSON.
- Errors become more structured; clients that only display text still receive a text payload containing JSON.

## Risks

- Over-aggressive joins could silently produce wrong translations.
- Overfit ranking rules could improve current examples while hurting unseen queries.
- Wider namespace support increases cache and fetch complexity.
- P2 presentation work can distract from core AI utility if done too early.

## Verification Strategy

- Add focused unit-like smoke assertions for known queries.
- Keep representative samples for:
  - exact class search
  - exact method search
  - broad fuzzy search
  - reverse lookup
  - unsupported namespace/version behavior
- Re-run live MCP smoke after each phase.
