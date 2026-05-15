# mcmap 1.3.0 Versioned Ecosystem Recommendations Design

## Boundary

`get_ecosystem_recommendations` remains an optional guidance tool. It must not replace or change `get_loader_versions`, and it must not present an inferred ecosystem version as an authoritative loader dependency.

## Output Contract

Each recommendation keeps the existing base fields:

- `id`
- `artifact`
- `kind`
- `source`
- `versioned`

Versioned recommendations add:

- `name`
- `version`
- `coordinate`
- `repositories`
- `confidence: "verified"`

Unversioned recommendations add:

- `name`
- `repositories`
- `confidence: "unversioned"`
- `reason`

The key distinction is machine-readable: AI consumers should only copy `coordinate` into Gradle when `versioned === true` and `confidence === "verified"`.

## Data Sources

Use Maven metadata when artifact names are deterministic:

- Architectury Maven metadata for `dev.architectury:*`
- Shedaniel Maven metadata for Cloth Config and REI artifacts
- Terraformers Maven metadata for Mod Menu
- BlameJared Maven metadata for JEI

Use Modrinth version API to map a Minecraft version and loader to a project version when a Maven artifact contains many Minecraft lines:

- `architectury-api`
- `cloth-config`
- `modmenu`
- `rei`

For Modrinth-backed recommendations, verify the returned `version_number` exists in the target Maven artifact metadata before emitting a coordinate.

For JEI, use Maven metadata directly because modern JEI artifact names include the Minecraft version and loader, and old Forge uses `jei_<minecraft>`.

## Failure Handling

Network failures for one optional library must not fail the entire tool. Emit an unversioned fallback with a reason when a library is part of the static catalog but cannot be verified.

Unsupported combinations can be omitted when the project is not expected for that loader. Example: Mod Menu is Fabric/Quilt only.

## Compatibility

The tool becomes async, but the MCP tool response shape remains JSON text. Existing consumers that only read `id`, `artifact`, `kind`, `source`, and `versioned` continue to work.

`search_mapping`, namespace listing, loader core versions, and cache behavior are not part of this change.
