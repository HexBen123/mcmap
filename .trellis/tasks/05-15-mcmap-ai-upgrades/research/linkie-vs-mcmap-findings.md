# Linkie vs mcmap findings

## Purpose

Record the observed differences between the live `linkie` and `mcmap` MCP tools before designing the next `mcmap` iteration.

## Observed strengths of mcmap

- JSON-first responses with stable fields such as `kind`, `owner`, `descriptor`, `names`, and `source`.
- Clear namespace model: `mojmap`, `intermediary`, `yarn`, `mcp`, and `parchment`.
- Better error behavior on several edge cases, for example `count: 0` instead of raw runtime exceptions.
- Stronger support for source provenance and machine consumption.
- More authoritative loader-version behavior in the sampled Forge and NeoForge checks.

## Observed strengths of linkie

- Better fuzzy ranking for broad semantic queries such as `network`.
- More readable mapping output for direct inspection, especially readable descriptors.
- Wider namespace coverage, including `legacy-yarn`, `quilt-mappings`, `mojang_srg`, and several smaller ecosystems.
- Better convenience for exploratory lookup when the caller has only a partial idea of the symbol name.

## Observed weaknesses to address in mcmap

- Current ranking in `src/search.ts` only distinguishes exact, suffix, and substring matches.
- Yarn descriptors remain in intermediary form even when named class translations are available from the same artifact.
- `translate_mode` is currently a retained compatibility argument with no real behavior.
- Namespace coverage does not yet include useful legacy and Quilt families.
- `formatMappingRecord` emits raw facts only; it does not expose confidence metadata or readable derivative fields.

## Product direction

`mcmap` should remain the AI-facing primary tool. It should absorb:

1. Better ranking.
2. Better readable derivative fields.
3. Better exploratory coverage.

It should not absorb:

1. Plain-text-first response contracts.
2. Ambiguous namespace semantics.
3. Mixed core-loader and optional ecosystem dependency output in the default path.
4. Unversioned ecosystem suggestions that look like verified dependency coordinates.
