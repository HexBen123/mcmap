# Build complete local Linkie MCP server

## Goal

Build a local, stdio-based MCP server that provides Linkie-style Minecraft mapping lookup tools without depending on the unstable remote `https://mc-linkie.mcp.codelib.space/mcp` service.

The server should let AI coding agents query Minecraft mappings and loader dependency versions while developing mods across modern and legacy ecosystems.

## Requirements

- Expose the same four tool names as the remote Linkie MCP:
  - `list_namespaces`
  - `get_namespace_versions`
  - `search_mapping`
  - `get_loader_versions`
- Support modern mapping namespaces:
  - `mojmap` / `official`, backed by Mojang official mapping downloads from the Mojang version manifest.
  - `intermediary`, backed by FabricMC Intermediary Maven artifacts.
  - `yarn`, backed by FabricMC Yarn Maven artifacts.
  - `parchment`, backed by ParchmentMC Maven metadata and artifacts where practical.
- Support legacy Forge/MCP mapping use cases in the first version, not as a later phase:
  - MCP/SRG CSV exports from Forge Maven or MCPBot mirrors.
  - MCPConfig TSRG/TSRG2 data for obfuscated-to-SRG style mapping where available.
  - Historical `de.oceanlabs.mcp:mcp` SRG/CSRG exports for pre-1.13 versions where MCPConfig is not available.
- Provide deterministic local caching under this project so repeated queries do not redownload large mapping artifacts.
- Do not modify unrelated workspace projects.
- Prefer authoritative upstream sources and document every source used.
- Return clear structured results that include:
  - namespace
  - Minecraft version
  - symbol kind: class, method, field, or param when available
  - owner class when available
  - source names such as obfuscated, intermediary, srg, mojmap, yarn, and mcp when available
  - descriptors for methods and fields when available
  - source artifact/provenance
- Handle partial coverage honestly. If a namespace/version combination cannot be resolved from configured sources, return a clear error instead of fabricated data.
- Provide Windows-friendly install and Codex configuration instructions.

## Acceptance Criteria

- [x] `npm run build` completes successfully.
- [x] The server can be launched over stdio with Node.js on Windows.
- [x] `tools/list` exposes all four Linkie-compatible tools.
- [x] `list_namespaces` reports supported namespaces and their backing sources.
- [x] `get_namespace_versions` returns stable/snapshot or available-version information for `mojmap`, `intermediary`, `yarn`, `parchment`, and `mcp`.
- [x] `search_mapping` can return useful class/method/field results for at least:
  - Yarn 1.21.1.
  - Intermediary 1.21.1.
  - Mojmap 1.18.2 or 1.21.1.
  - Legacy MCP/SRG for 1.12.2 or 1.7.10.
- [x] `get_loader_versions` returns useful dependency coordinates for Fabric, Forge, NeoForge, and Legacy Fabric.
- [x] Cache files are contained under the user-level `mcmap` cache directory.
- [x] README documents setup, Codex registration, supported namespaces, and known limitations.

## Notes

- The user explicitly prefers completeness over speed and wants legacy MCP/SRG included in this first implementation.
- The existing remote Linkie MCP times out during tool calls, so this local server should avoid depending on that remote service.
