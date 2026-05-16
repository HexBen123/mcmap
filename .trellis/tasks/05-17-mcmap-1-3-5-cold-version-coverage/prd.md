# mcmap 1.3.5 cold version coverage

## Goal

Ship `mcmap` 1.3.5 as a narrow reliability release for cold Minecraft versions.
The release should keep the 1.3.0 AI-facing output contract unchanged while
improving JEI Forge ecosystem recommendation coverage and locking recently
tested cold-version mapping behavior into smoke tests.

## Requirements

- Preserve the existing MCP tool names, inputs, and output fields.
- Keep `get_ecosystem_recommendations` conservative: only emit `coordinate`
  when Maven metadata verifies the artifact and version.
- Improve JEI Forge artifact resolution beyond the current two-shape rule:
  - pre-1.13 Forge remains `mezz.jei:jei_<minecraft>`.
  - Forge 1.13.x through 1.16.x should resolve `mezz.jei:jei-<minecraft>`.
  - Forge versions where `jei-<minecraft>-forge-api` exists should prefer that
    API artifact over the legacy whole-mod artifact.
  - NeoForge should continue using the NeoForge API artifact.
- If all JEI artifact candidates fail, return one unversioned JEI entry with a
  reason that explains the attempted metadata lookups; do not fail the whole
  ecosystem recommendation response.
- Add smoke coverage for cold mapping versions observed during comparison:
  - `legacy-yarn` `1.3.2` class lookup for `MinecraftServer`.
  - `legacy-yarn` `15w14a` class lookup for `MinecraftServer`.
  - assisted MCP lookup for `1.8`, `1.10.2`, and `1.12`.
  - MCP prerelease `1.15-pre7` should remain a structured successful response
    with analysis rather than a raw tool error.
- Bump package version to `1.3.5`.
- Update README to document the broader JEI artifact handling.

## Acceptance Criteria

- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] `npm run smoke` passes.
- [ ] `get_ecosystem_recommendations` for Forge `1.16.5` returns a verified
  JEI coordinate starting with `mezz.jei:jei-1.16.5:`.
- [ ] Existing Forge `1.12.2` JEI recommendation still returns a verified
  coordinate starting with `mezz.jei:jei_1.12.2:`.
- [ ] Existing Fabric `1.21.1` versioned ecosystem recommendation behavior is
  unchanged.
- [ ] The cold mapping regression cases above are covered in `npm run smoke`.

## Notes

- This is a patch/minor reliability release, not a new output contract.
