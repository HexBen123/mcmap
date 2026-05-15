# Linkie Lessons for mcmap 1.2.0

## What to Learn

Linkie's useful behavior is not its prose output. Its useful behavior is that it tries to help the caller keep moving when the query is imprecise.

The parts worth adapting are:

- mixed query rescue for inputs that contain both owner and member names,
- low-confidence related candidates,
- old-version exploration for MCP/Forge-era names,
- broader alias and leaf-name matching,
- scan-friendly human output as an optional display format.

## What Not to Learn

Do not copy these traits:

- prose-first output as the default,
- fuzzy candidates mixed into the authoritative result list,
- raw JavaScript exceptions from unsupported or malformed old-version data,
- recommendations that look like verified dependency coordinates when they are only ecosystem hints.

## 1.2.0 Direction

The correct direction is not "make mcmap fuzzier." The correct direction is "keep strict answers strict, and add a separate assisted discovery lane."

Primary `results` should stay authoritative. Assisted or related output should be clearly separated and include confidence and reason metadata.

## Acceptance Examples

- `getPlayerManager` should continue to return exact Yarn method mappings in primary `results`.
- `MinecraftServer getPlayerManager` should be able to produce assisted candidates without changing strict default semantics.
- `EntityPlayerSP` on MCP `1.7.10` should identify the class and useful owner-related methods.
- `EntityPlayerSP updateEntityActionState` on MCP `1.7.10` should expose owner/member-related candidates without collapsing repeated MCP names across owners.
- The same owner/member assistance idea should be checked against other important old versions, especially `1.8.9`, `1.12.2`, and `1.16.5`.
- `1.7.10` is a stress case, not the whole product scope.
