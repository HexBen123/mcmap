# Enhance mcmap for AI mod development

## Goal

Improve `mcmap` from a first-pass mapping lookup service into a stronger AI-facing Mod development tool by absorbing the useful parts of `linkie` while preserving `mcmap`'s current strengths: structured JSON, provenance, namespace clarity, and reliable loader metadata.

## Requirements

- Preserve JSON-first MCP responses as the default contract for AI clients.
- Preserve source provenance and namespace boundaries rather than collapsing unrelated concepts into ambiguous free text.
- Improve `search_mapping` so approximate semantic queries rank likely coding targets ahead of incidental path matches.
- Expose match confidence details that AI clients can reason over, including a score and machine-readable match reasons.
- Add readable descriptors where the loaded mapping data can resolve intermediary or obfuscated type names into named forms.
- Return structured, machine-readable tool errors instead of bare error strings.
- Expand useful namespace coverage for AI Mod work:
  - Add `legacy-yarn`.
  - Add `quilt-mappings`.
  - Clarify or expose modern SRG-style usage without weakening existing `mcp` support.
- Make `translate_mode` a real search constraint instead of a compatibility-only placeholder.
- Add best-effort cross-namespace enrichment where joins can be done reliably, especially for Yarn, Intermediary, Mojmap, SRG, and MCP-related records.
- Keep loader-version queries authoritative and separate core loader facts from optional ecosystem recommendations.
- Add an opt-in human-readable output mode without replacing JSON as the default AI-facing format.
- Keep behavior honest when coverage is partial or joins are unavailable; do not fabricate translations.
- Update README and smoke coverage so the new AI-facing behavior is documented and regression-tested.

## Acceptance Criteria

- [ ] Ambiguous searches such as `network` return higher-quality top results than the current exact/suffix/substring ranking baseline.
- [ ] `search_mapping` results include stable machine-readable ranking metadata such as `score` and `matchReasons`.
- [ ] Yarn search results can return a readable descriptor when the referenced types are resolvable from loaded mapping data.
- [ ] Tool failures return structured error payloads with enough information for an AI client to choose a fallback.
- [ ] `translate_mode` changes search behavior in a documented and testable way.
- [ ] `legacy-yarn` and `quilt-mappings` are exposed through namespace listing, version listing, and mapping search where upstream artifacts are available.
- [ ] Cross-namespace enrichment adds useful names without introducing incorrect joins.
- [ ] Core loader-version queries remain authoritative; optional ecosystem dependency recommendations, if exposed, are kept separate from core loader coordinates.
- [ ] JSON remains the default response format; any human-readable output is opt-in.
- [ ] Build, type-check, and smoke tests pass after the changes.
- [ ] README documents the new capabilities, caveats, and intended AI usage pattern.

## Notes

- `mcmap` is optimized for AI coding agents, not primarily for direct human inspection.
- The target is not to clone `linkie`; the target is to combine `mcmap`'s structure with the most useful `linkie` strengths.
- Implementation should proceed incrementally in P0, P1, and P2 groups so each stage can be validated before the next expands scope.
