# mcmap

Local MCP server for Minecraft mapping lookup.

This project exists because the remote Linkie MCP endpoint can initialize but may time out during tool calls. The local server keeps the same four Linkie-compatible tool names and resolves mapping data from upstream Minecraft, Fabric, Forge, NeoForge, Parchment, and Legacy Fabric sources with a local file cache.

## Requirements

- Node.js 18.14 or newer.
- PowerShell 7 on Windows is supported.

## Install, Build, and Run

```powershell
npm install
npm run build
npm run start
```

Run the local MCP smoke test:

```powershell
npm run smoke
```

The smoke test starts `dist/index.js`, performs MCP `initialize` and `tools/list`, then verifies namespace version listing, Yarn, Intermediary, Mojmap, legacy MCP/SRG, and loader dependency queries.

## Install And Register

Install the published package globally and register the binary:

```powershell
npm install -g @hexben/mcmap@latest
codex mcp add mcmap -- mcmap
claude mcp add mcmap -- mcmap
```

Use `npx` when you want a one-off registration without a global install:

```powershell
codex mcp add mcmap -- npx -y @hexben/mcmap@latest
claude mcp add mcmap -- npx -y @hexben/mcmap@latest
```

For local development from this checkout, build first and register the generated file directly:

```powershell
npm run build
codex mcp add mcmap -- node "dist\index.js"
```

If the remote `linkie` MCP entry is still configured, keep this local server under the separate name `mcmap` so both entries are distinguishable. If you want to disable the remote entry, remove or comment out the remote server block in the Codex MCP config that contains:

```json
{
  "mcpServers": {
    "linkie": {
      "url": "https://mc-linkie.mcp.codelib.space/mcp"
    }
  }
}
```

Before publishing, run a packaging dry run and confirm the tarball only contains the built output and package metadata:

```powershell
npm pack --dry-run
```

## Tools

### `list_namespaces`

Returns supported mapping namespaces and the local cache root.

### `get_namespace_versions`

Returns available versions for:

- `mojmap` / `official`
- `intermediary`
- `yarn` / `named`
- `mcp` / `srg`
- `parchment`

### `search_mapping`

Searches classes, methods, fields, and parameters where the backing source exposes them.

Common examples:

```json
{
  "query": "ServerPlayer",
  "namespace": "yarn",
  "version": "1.21.1",
  "limit": 5
}
```

```json
{
  "query": "getEntityWorld",
  "namespace": "mcp",
  "version": "1.12.2",
  "allow_classes": false,
  "allow_methods": true,
  "allow_fields": false
}
```

### `get_loader_versions`

Returns recent dependency coordinates for:

- `fabric`
- `forge`
- `neoforge`
- `legacy-fabric`

The result is grouped by Minecraft version where the upstream source exposes many loader builds for the same game version.

## Data Sources

| Area | Source |
| --- | --- |
| Mojmap | Mojang version manifest and official client/server mapping downloads |
| Yarn | Fabric Maven `net.fabricmc:yarn` Tiny v2 artifacts |
| Intermediary | Fabric Maven `net.fabricmc:intermediary` Tiny v2 artifacts |
| MCP/SRG | Forge Maven MCPConfig, MCP stable/snapshot CSV, and historical MCP SRG/CSRG artifacts |
| Parchment | ParchmentMC Maven metadata |
| Fabric loader | Fabric Meta v2 and Fabric Maven metadata |
| Forge loader | Forge Maven `net.minecraftforge:forge` metadata |
| NeoForge loader | NeoForge Maven `net.neoforged:neoforge` metadata plus Mojang release manifest for Minecraft-version inference |
| Legacy Fabric loader | Legacy Fabric Meta v2 and Legacy Fabric Maven metadata |

## Cache

Network responses are cached under a user-level directory:

```text
Windows: %LOCALAPPDATA%\mcmap\
Linux/macOS: $XDG_CACHE_HOME/mcmap/ or ~/.cache/mcmap/
```

The cache stays outside the project so global installs do not create cache files in every checkout. Removing that directory forces the server to refetch upstream metadata and artifacts on the next query.

## Current Limitations

- `parchment` currently exposes version metadata. Full Parchment parameter and Javadoc search is not implemented yet.
- `search_mapping` loads one namespace at a time. Cross-namespace joining is only performed where the source naturally contains both names, such as Yarn Tiny v2 and MCP/SRG plus MCP CSV.
- Loader metadata depends on upstream Maven and meta APIs. If an upstream source changes versioning format, the parser should be adjusted rather than fabricating results.
