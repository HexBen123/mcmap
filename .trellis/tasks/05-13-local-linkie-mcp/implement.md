# Implementation Plan

## 1. Project Setup

- [x] Convert package to ESM TypeScript.
- [x] Add `build`, `start`, and smoke-test scripts.
- [x] Create `src/` directory layout.
- [x] Add README and data source documentation.

## 2. Core Utilities

- [x] Implement HTTP fetch with file cache.
- [x] Implement XML metadata parser.
- [x] Implement zip/JAR text extraction.
- [x] Implement CSV parser for MCP CSV exports.
- [x] Implement version sorting helpers for Minecraft and Maven-style versions.

## 3. Parsers

- [x] Parse Tiny v2 mappings for Yarn and Intermediary.
- [x] Parse Mojang official ProGuard mapping files.
- [x] Parse TSRG/TSRG2 from MCPConfig.
- [x] Parse SRG/CSRG historical MCP exports.
- [x] Parse MCP stable/snapshot CSV files.
- [x] Inspect and parse Parchment artifacts enough to expose parameter/doc data, or document exactly what remains partial.

## 4. Data Source Clients

- [x] Mojang manifest and mapping downloads.
- [x] Fabric Yarn Maven metadata and artifacts.
- [x] Fabric Intermediary Maven metadata and artifacts.
- [x] Parchment Maven metadata and artifacts.
- [x] Forge MCPConfig Maven metadata and artifacts.
- [x] Forge MCP stable/snapshot metadata and artifacts.
- [x] Historical MCP SRG/CSRG metadata and artifacts.
- [x] Fabric loader metadata and Fabric API metadata.
- [x] Forge and NeoForge Maven metadata.

## 5. Index and Search

- [x] Normalize parsed mappings into shared records.
- [x] Merge related namespace records where practical.
- [x] Add search ranking.
- [x] Format compact JSON text results for MCP responses.
- [x] Return clear errors for unsupported combinations.

## 6. MCP Server

- [x] Register `list_namespaces`.
- [x] Register `get_namespace_versions`.
- [x] Register `search_mapping`.
- [x] Register `get_loader_versions`.
- [x] Ensure server logs go to stderr only.

## 7. Verification

- [x] Build TypeScript.
- [x] Run stdio MCP initialize/tools/list smoke test.
- [x] Query Yarn 1.21.1.
- [x] Query Intermediary 1.21.1.
- [x] Query Mojmap 1.18.2 or 1.21.1.
- [x] Query MCP/SRG legacy 1.12.2 or 1.7.10.
- [x] Query Fabric loader versions.
- [x] Query Forge versions.
- [x] Query NeoForge versions.
- [x] Query Legacy Fabric loader versions.

## 8. Codex Integration

- [x] Document `npm install -g @hexben/mcmap@latest`, `npx -y @hexben/mcmap@latest`, Codex, and Claude Code registration commands.
- [x] Document direct `mcpServers` JSON config examples.
- [x] Document user-level cache location and cleanup guidance.
