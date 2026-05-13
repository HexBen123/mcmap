# Technical Design

## Overview

mcmap is a TypeScript Node.js project using the official Model Context Protocol TypeScript SDK over stdio. It exposes Minecraft mapping and loader metadata lookup tools while using local parsing and caching for mapping artifacts.

The implementation has three layers:

1. Data source clients download and cache upstream metadata and artifacts.
2. Parsers normalize each mapping format into a shared index model.
3. MCP tools query the normalized index and format results for agents.

## Upstream Sources

### Mojang Official / Mojmap

Source:

- `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`
- Per-version JSON `downloads.client_mappings` and `downloads.server_mappings`

Use:

- Authoritative official obfuscated-to-Mojang class, method, and field names for versions where Mojang publishes mappings.

Format:

- ProGuard-style text mappings.
- Class line: `com.example.Named -> abc:`
- Member line: `int fieldName -> a`
- Method line includes return type, name, and Java parameter types.

Notes:

- Mojang mappings are official, but license terms are more restrictive than Yarn.
- Parameter names and Javadocs are not provided in older versions.

### Fabric Intermediary

Source:

- `https://maven.fabricmc.net/net/fabricmc/intermediary/maven-metadata.xml`
- Artifacts such as `net.fabricmc:intermediary:<mcVersion>:v2@jar`

Use:

- Stable Fabric runtime namespace.
- Important for mod binary compatibility and Fabric remapping workflows.

Format:

- Tiny v2 under `mappings/mappings.tiny`.
- Usually namespaces: `official`, `intermediary`.

### Fabric Yarn

Source:

- `https://maven.fabricmc.net/net/fabricmc/yarn/maven-metadata.xml`
- Artifacts such as `net.fabricmc:yarn:<mcVersion>+build.<n>:v2@jar`

Use:

- Human-readable Fabric mapping names for versions where Yarn exists.

Format:

- Tiny v2 under `mappings/mappings.tiny`.
- Usually namespaces: `intermediary`, `named`.
- The implementation should merge with Intermediary for the same Minecraft version to include official/obfuscated names when available.

### Parchment

Source:

- `https://maven.parchmentmc.org/org/parchmentmc/data/parchment-<mcVersion>/maven-metadata.xml`
- Artifacts such as `org.parchmentmc.data:parchment-<mcVersion>:<date>@zip`

Use:

- Mojmap-compatible parameter names and Javadocs.

Format:

- Parchment mapping zip export. Inspect actual artifact layout during parser implementation.

Notes:

- Parchment augments Mojmap rather than replacing it.
- First implementation should expose Parchment availability and use parameter/doc information when parser support is complete.

### Forge MCPConfig

Source:

- `https://maven.minecraftforge.net/de/oceanlabs/mcp/mcp_config/maven-metadata.xml`
- Artifacts such as `de.oceanlabs.mcp:mcp_config:<mcVersion>-<timestamp>@zip`

Use:

- SRG/TSRG/TSRG2 mapping data for Forge/MCP workflows, especially 1.12.2 and newer legacy Forge workflows.

Format:

- `config/joined.tsrg` or similar files inside the zip.
- TSRG2 example header: `tsrg2 obf srg id`.

### Forge MCP Stable/Snapshot CSV

Source:

- `https://maven.minecraftforge.net/de/oceanlabs/mcp/mcp_stable/maven-metadata.xml`
- `https://maven.minecraftforge.net/de/oceanlabs/mcp/mcp_snapshot/maven-metadata.xml`
- Mirror fallback: `https://mcp.zeith.org/`

Use:

- Human-readable MCP names mapped from SRG names.

Format:

- Zip files containing `fields.csv`, `methods.csv`, and `params.csv`.
- CSV columns include `searge`, `name`, `side`, and optional `desc`.

### Historical MCP SRG/CSRG Exports

Source:

- `https://maven.minecraftforge.net/de/oceanlabs/mcp/mcp/maven-metadata.xml`
- Artifacts such as:
  - `de.oceanlabs.mcp:mcp:<mcVersion>:srg@zip`
  - `de.oceanlabs.mcp:mcp:<mcVersion>:csrg@zip`

Use:

- Pre-MCPConfig obfuscated-to-SRG class/member mapping for versions like 1.7.10, 1.8.9, 1.12, and 1.12.2.

Format:

- SRG and compact SRG files. Inspect before parser finalization.

### Loader Versions

Sources:

- Fabric:
  - `https://meta.fabricmc.net/v2/versions/game`
  - `https://meta.fabricmc.net/v2/versions/loader`
  - `https://meta.fabricmc.net/v2/versions/loader/<mcVersion>`
  - `https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/maven-metadata.xml`
- Forge:
  - `https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml`
- NeoForge:
  - `https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml`
- Legacy Fabric:
  - Investigate Fabric legacy metadata or return documented partial support if no authoritative metadata is available.

## Normalized Mapping Model

Each parsed mapping is normalized into records:

```ts
type MappingKind = "class" | "method" | "field" | "param";

interface MappingRecord {
  kind: MappingKind;
  version: string;
  source: string;
  owner?: string;
  descriptor?: string;
  names: {
    obfuscated?: string;
    official?: string;
    mojmap?: string;
    intermediary?: string;
    yarn?: string;
    named?: string;
    srg?: string;
    mcp?: string;
    parchment?: string;
  };
  comment?: string;
}
```

The search layer checks every available name, owner, descriptor, and comment for substring matches. Exact matches rank above suffix/package matches, which rank above plain substring matches.

## Cache Layout

Use a user-level cache root so global installs do not create project-local state:

```text
Windows: %LOCALAPPDATA%\mcmap\
Linux/macOS: $XDG_CACHE_HOME/mcmap/ or ~/.cache/mcmap/
```

The current implementation stores HTTP response bodies and metadata beneath `<cache-root>/http/`:

```text
<cache-root>/
  http/
    <sha256-url>.body
    <sha256-url>.json
```

Network responses are cached by URL. Parsed indexes can be cached separately once parser output is stable.

## MCP Tools

### list_namespaces

Returns namespace metadata, supported source families, and caveats.

### get_namespace_versions

Returns available versions for a namespace:

- Mojmap: Mojang version manifest versions with mapping downloads.
- Intermediary: Fabric intermediary Maven versions.
- Yarn: grouped Yarn versions by Minecraft version.
- Parchment: versions with Parchment Maven metadata.
- MCP: versions from Forge MCP versions metadata, MCPConfig, and historical MCP artifacts.

### search_mapping

Inputs should remain stable and simple for MCP clients:

- `query`
- `namespace`
- `version`
- `limit`
- `allow_classes`
- `allow_methods`
- `allow_fields`
- `translate_mode`

For `namespace=mcp`, combine:

1. SRG/obfuscated data from MCPConfig or historical SRG/CSRG exports.
2. Human names from MCP stable/snapshot CSV.

### get_loader_versions

Returns recent dependency coordinates for:

- Fabric
- Forge
- NeoForge
- Legacy Fabric when authoritative metadata is available.

## Known Risks

- Mapping licenses differ. The tool should cache and expose metadata but should not redistribute bundled mapping data in the repository.
- Legacy MCP source coverage varies by Minecraft version.
- Full translation across all namespace pairs requires merging indexes from multiple sources. First implementation should return best-effort records with provenance and avoid pretending a missing join is complete.
