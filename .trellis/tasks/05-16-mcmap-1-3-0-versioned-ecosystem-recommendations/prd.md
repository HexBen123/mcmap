# mcmap 1.3.0 versioned ecosystem recommendations

## Goal

Upgrade `get_ecosystem_recommendations` from a static unversioned catalog into an AI-facing optional dependency helper that can return verified Gradle coordinates for common Minecraft mod ecosystem libraries.

## Requirements

- Preserve the separation between core loader facts and optional ecosystem suggestions. `get_loader_versions` must remain the source for Fabric Loader, Fabric API, Forge, NeoForge, and Legacy Fabric core dependencies.
- Keep existing `get_ecosystem_recommendations` inputs: `loader` and `minecraft`.
- Return richer recommendation objects while keeping existing base fields such as `id`, `artifact`, `kind`, `source`, and `versioned`.
- For libraries where the tool can verify a version from an upstream metadata source, return `versioned: true`, a concrete `version`, and a full Maven `coordinate`.
- For libraries that cannot be verified for the requested Minecraft version and loader, either omit them or return an explicit unversioned entry with a machine-readable reason. Do not invent coordinates.
- Cover the ecosystem categories where linkie was stronger in the comparison:
  - Fabric: Architectury API, Cloth Config, Mod Menu, Roughly Enough Items.
  - Forge: Cloth Config and JEI where version metadata is available.
  - NeoForge: Architectury API, Cloth Config, Roughly Enough Items, and JEI where version metadata is available.
  - Legacy Fabric: keep conservative optional guidance; do not fabricate versions if metadata is not confidently versioned.
- Document that ecosystem recommendations are optional guidance and that `coordinate` means the version was found and checked against an upstream source.
- Add smoke coverage that proves versioned Fabric recommendations work and old Forge JEI can be resolved for `1.12.2`.

## Acceptance Criteria

- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] `npm run smoke` passes.
- [ ] `get_ecosystem_recommendations` returns at least one `versioned: true` Fabric recommendation for `minecraft: "1.21.1"`.
- [ ] `get_ecosystem_recommendations` returns a versioned JEI recommendation for Forge `minecraft: "1.12.2"` when upstream metadata is reachable.
- [ ] Existing `search_mapping` assisted lookup behavior remains unchanged.
- [ ] README explains versioned recommendations, unversioned fallbacks, and the difference from core loader facts.

## Notes

- This is a complex task because it adds network-backed data flow, public output shape changes, and tests.
