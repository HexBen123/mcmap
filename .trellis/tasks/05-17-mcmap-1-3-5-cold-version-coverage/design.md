# mcmap 1.3.5 Cold Version Coverage Design

## Boundary

This release does not add new MCP tools or change the public output shape.
It only improves how `get_ecosystem_recommendations` chooses JEI artifact
metadata and broadens smoke tests for cold mapping versions.

## JEI Artifact Resolution

The current implementation derives a single artifact name. That works for old
Forge before 1.13 and modern Forge/NeoForge API artifacts, but it fails for
Forge 1.13.x through 1.16.x where BlameJared Maven publishes `jei-<minecraft>`.

Replace the single-artifact resolver with an ordered candidate resolver:

- NeoForge:
  - `jei-<minecraft>-neoforge-api`
- Forge before 1.13:
  - `jei_<minecraft>`
- Forge 1.13 through before 1.19:
  - `jei-<minecraft>-forge-api`
  - `jei-<minecraft>`
- Forge 1.19 and newer:
  - `jei-<minecraft>-forge-api`
  - `jei-<minecraft>`

The API artifact is preferred whenever it exists because the tool is used to
write Gradle dependencies for mod development. The fallback to `jei-<minecraft>`
keeps middle-era Forge versions such as 1.16.5 usable.

Each candidate performs a Maven metadata lookup. The first candidate with at
least one version returns a verified coordinate. If every candidate fails or has
no versions, return an unversioned JEI recommendation with the candidate list
and compact failure reasons.

## Smoke Coverage

Smoke tests should remain end-to-end MCP calls against `dist/index.js`.
Regression cases should assert behavior rather than implementation details:

- cold Legacy Yarn versions can search classes,
- assisted old MCP owner/member queries return high-confidence candidates,
- prerelease MCP queries return structured analysis without an MCP tool error,
- Forge 1.16.5 JEI returns a verified middle-era coordinate.

## Compatibility

The 1.3.0 ecosystem recommendation contract remains unchanged:

- verified results use `versioned: true`, `confidence: "verified"`, and
  `coordinate`;
- unverifiable results use `versioned: false`, `confidence: "unversioned"`,
  and `reason`;
- optional ecosystem lookup failures do not fail the whole tool response.
