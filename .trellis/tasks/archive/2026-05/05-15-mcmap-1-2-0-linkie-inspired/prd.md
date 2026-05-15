# mcmap 1.2.0 linkie-inspired upgrades

## Goal

Plan and implement mcmap `1.2.0` as a conservative AI-first upgrade that learns the useful discovery behavior from Linkie without weakening the current `1.1.0` guarantees.

The release should keep the current structured JSON contract as the default behavior and add targeted assistance for cases where an AI agent has an imprecise query, especially older Minecraft versions such as `1.7.10`.

## Requirements

- Preserve `mcmap 1.1.0` behavior by default:
  - `search_mapping` must continue to return structured JSON by default.
  - Existing result fields such as `descriptor`, `readableDescriptor`, `score`, `matchReasons`, `matchedNames`, `source`, and `names` must remain stable unless explicitly extended additively.
  - Empty exact searches must continue to return a successful empty result, not throw.
- Add Linkie-inspired query assistance without mixing low-confidence hits into the authoritative result set.
- Improve mixed query handling for inputs such as `MinecraftServer getPlayerManager`, `EntityPlayerSP updateEntityActionState`, or `owner member` style phrases.
- Add an opt-in discovery surface that can return related or lower-confidence candidates with machine-readable reasons.
- Improve old-version usability for Forge/MCP-style workflows across a representative version matrix, not only `1.7.10`.
- Treat `1.7.10` as the lowest-version stress case, but validate the design against multiple historically important modding versions:
  - `1.7.10` for early Forge/MCP and heavily obfuscated SRG-era workflows.
  - `1.8.9` for common legacy modding and client-side code lookup.
  - `1.12.2` for the largest classic Forge ecosystem line.
  - `1.16.5` for late MCP/Forge transition-era workflows.
  - `1.21.1` for modern regression coverage so assisted discovery does not degrade current Yarn behavior.
- Keep raw facts and derived facts separated:
  - Source names, SRG names, obfuscated names, owners, and raw descriptors must remain intact.
  - Any query-splitting, related candidate, alias, or owner heuristic must be represented as derived metadata.
- Avoid copying Linkie's weak points:
  - Do not replace JSON with prose.
  - Do not make fuzzy matches authoritative by default.
  - Do not allow malformed or unsupported old-version data to crash the MCP tool.

## Acceptance Criteria

- [ ] Existing smoke coverage for `mcmap 1.1.0` still passes.
- [ ] `search_mapping` with the existing default mode remains backward compatible for exact searches.
- [ ] A mixed query such as `MinecraftServer getPlayerManager` can produce useful assistance without contaminating exact result semantics.
- [ ] MCP assisted discovery is validated against at least `1.7.10`, `1.8.9`, `1.12.2`, and `1.16.5`.
- [ ] Modern Yarn exact lookup behavior remains validated against at least `1.21.1`.
- [ ] A `1.7.10` MCP query can expose useful owner/member candidates for old Forge workflows without being the only old-version acceptance case.
- [ ] Related or low-confidence candidates are visibly separated from primary `results`.
- [ ] Every assisted candidate includes machine-readable reason metadata.
- [ ] Error responses remain structured and do not throw raw JavaScript exceptions.
- [ ] README documents the new 1.2.0 behavior as AI-facing assistance, not as authoritative remapping.
- [ ] `npm run check`, `npm run build`, and `npm run smoke` pass before release.

## Notes

- The central design constraint is "add assistance, do not loosen truth."
- Linkie is treated as a behavioral reference for discovery ergonomics, not as a source to clone or name in public docs.
