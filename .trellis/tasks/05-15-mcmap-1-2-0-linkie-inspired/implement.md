# Implementation Plan: mcmap 1.2.0

## Phase 0: Baseline

- [x] Run `npm run check`.
- [x] Run `npm run build`.
- [x] Run `npm run smoke`.
- [x] Capture current outputs for:
  - `search_mapping` yarn `1.21.1` query `getPlayerManager`
  - `search_mapping` yarn `1.21.1` query `MinecraftServer getPlayerManager`
  - `search_mapping` mcp `1.7.10` query `EntityPlayerSP`
  - `search_mapping` mcp `1.7.10` query `EntityPlayerSP updateEntityActionState`
  - `search_mapping` mcp `1.8.9` representative owner/member queries
  - `search_mapping` mcp `1.12.2` representative owner/member queries
  - `search_mapping` mcp `1.16.5` representative owner/member queries

## Phase 1: Query Analysis

- [x] Add a small query analysis helper in `src/search.ts` or a focused new module.
- [x] Classify query tokens into owner-like, member-like, descriptor-like, and raw tokens.
- [x] Keep classification conservative and deterministic.
- [x] Add tests through `scripts/smoke.mjs` for query analysis visible in assisted outputs.

## Phase 2: Assisted Discovery

- [x] Add an optional `assist` input to `search_mapping`.
- [x] Keep default behavior unchanged when `assist` is false or omitted.
- [x] When `assist` is true, run strict search first, then secondary searches only as additive assistance.
- [x] Add `relatedCandidates` or equivalent separated field.
- [x] Ensure assisted candidates include reason and confidence metadata.

## Phase 3: Mixed Owner/Member Queries

- [x] Implement split owner/member matching.
- [x] Support queries like `MinecraftServer getPlayerManager`.
- [x] Support legacy queries like `EntityPlayerSP updateEntityActionState`.
- [x] Avoid treating mixed-query candidates as primary authoritative results unless they also satisfy existing primary scoring rules.

## Phase 4: Old MCP Usability

- [x] Improve owner leaf matching for MCP/SRG style classes.
- [x] Preserve repeated methods across multiple owners.
- [x] Include owner-related member candidates when the class is confidently identified.
- [x] Validate with a version matrix: `1.7.10`, `1.8.9`, `1.12.2`, and `1.16.5`.
- [x] Keep `1.21.1` Yarn examples as modern regression guards.
- [x] Avoid version-specific hard-coding unless a source format truly requires it and the reason is documented.

## Phase 5: Documentation and Release Prep

- [x] Update README for 1.2.0 assistance behavior.
- [x] Document that assisted candidates are guidance, not authoritative facts.
- [x] Update smoke tests for:
  - default compatibility
  - assisted mixed query
  - old MCP assisted query matrix
  - structured errors
- [x] Run `npm run check`.
- [x] Run `npm run build`.
- [x] Run `npm run smoke`.

## Review Gates

- [x] No public default behavior is loosened.
- [x] Primary `results` remain authoritative.
- [x] Assisted candidates are separated and reasoned.
- [x] Raw mapping fields remain raw.
- [x] Derived fields are additive.

## Release Notes Draft

`1.2.0` adds optional AI-facing assisted discovery for mixed and legacy Minecraft mapping queries. The default structured result behavior remains strict and backward compatible.
