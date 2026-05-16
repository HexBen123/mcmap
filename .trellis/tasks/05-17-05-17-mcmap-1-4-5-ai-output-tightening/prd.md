# mcmap 1.4.5 compact projection and ecosystem recommendations

## Goal

Ship `mcmap` 1.4.5 as a tightening release for the 1.4.0 AI-facing output
contract. The release should keep JSON, `structuredContent`, output schemas,
and full-result resources compatible while making compact output spend fewer
tokens on large version metadata and broadening optional ecosystem dependency
coverage learned from the linkie comparison.

## Requirements

- Keep the existing MCP tools and response contracts compatible.
- Keep `format: "json"` as the canonical full machine/debug projection.
- Keep `format: "compact"` model-facing, but ensure large result details that
  are already available through `resource_link` are summarized instead of
  dumped into text.
- Specifically, `get_namespace_versions(format:"compact")` must not emit the
  complete `aliases` map in the model-visible text. It should expose bounded
  samples, counts, and the full-result resource URI.
- Keep `structuredContent` unchanged so clients that want the full alias map can
  still read it without depending on compact text.
- Add Forge ecosystem recommendations for Architectury API and Roughly Enough
  Items where versions can be verified. Existing Cloth Config and JEI behavior
  must continue to work.
- Preserve `confidence: "verified"` for copyable coordinates and
  `confidence: "unversioned"` with a reason when a coordinate cannot be
  verified.
- Bump package version to `1.4.5`.
- Update README to describe the tightened compact projection and broader Forge
  ecosystem coverage.

## Acceptance Criteria

- [ ] `get_namespace_versions({ namespace: "yarn", format: "compact" })`
      returns a bounded compact text projection rather than tens of thousands of
      characters of aliases.
- [ ] The same compact call still includes a `resource_link`, and reading that
      resource returns the complete JSON payload including aliases.
- [ ] `get_ecosystem_recommendations({ loader: "forge", minecraft: "1.21.1" })`
      includes Architectury API, Cloth Config, Roughly Enough Items, and JEI
      entries, with verified coordinates where upstream metadata allows.
- [ ] Existing Forge 1.16.5 JEI verified coordinate smoke coverage remains
      green.
- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] `npm run smoke` passes.
- [ ] `npm pack --dry-run` succeeds before release.

## Notes

- This is a compatibility-preserving minor release. Do not remove JSON fields,
  change tool names, or change resource URI shape.
