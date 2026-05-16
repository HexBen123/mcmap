# mcmap

[![npm](https://img.shields.io/npm/v/@hexben/mcmap)](https://www.npmjs.com/package/@hexben/mcmap)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A518.14-339933)](#环境要求)

让你的 AI 编程工具能直接查 Minecraft 映射表、符号名称和 Mod Loader 依赖版本。基于 stdio 的 MCP 服务，数据来自 Mojang、Fabric、Forge、NeoForge、Parchment 和 Legacy Fabric 上游。

## 快速开始

```powershell
npm install -g @hexben/mcmap@latest
claude mcp add mcmap -- mcmap        # 或 codex mcp add mcmap -- mcmap
```

用 npx 免安装：

```powershell
claude mcp add mcmap -- npx -y @hexben/mcmap@latest
```

## 工具一览

**`list_namespaces`** — 列出所有可用的映射命名空间和数据源。

**`get_namespace_versions`** — 查某个命名空间支持哪些 Minecraft 版本。支持 `mojmap`、`intermediary`、`yarn`、`mcp`、`parchment`。

**`search_mapping`** — 搜索类、方法、字段名称。指定命名空间和版本，得到 obfuscated → mojmap → intermediary → yarn 的全链路映射。支持正向搜索、反向查询，以及老版本 MCP/SRG 的辅助发现模式。

**`get_loader_versions`** — 查 Fabric/Forge/NeoFore/Legacy Fabric 在某 Minecraft 版本下的 Gradle 依赖坐标。

**`get_ecosystem_recommendations`** — 可选生态建议：Mod Menu、Cloth Config、JEI/REI 等。有已验证版本时直接返回 `coordinate`可复制进 build.gradle。

## AI 紧凑输出

1.4.0 起，每个工具都声明 MCP `outputSchema`，成功调用会同时返回 `structuredContent`。默认 `format: "json"` 保持兼容，文本内容仍是完整 JSON；需要节省模型上下文时传 `format: "compact"`。

1.4.5 起，`get_namespace_versions` 的 compact 输出只给版本数量、样本和 alias key 样本；完整 alias 映射仍保留在 `structuredContent` 和 `resource_link` 指向的完整 JSON 资源里，避免把大型版本元数据直接塞进模型上下文。

compact 模式会把模型可见文本压成摘要、schema 头和表格行，同时保留完整结构化结果：

```text
!summary 2 primary results for yarn 1.21.1 query="ServerPlayer".
@S=mcmap.search.v1 query=ServerPlayer namespace=yarn version=1.21.1 count=2
@cols=rank|kind|primary|names|owner|desc|score|why
1|class|net/minecraft/server/network/ServerPlayerEntity|intermediary=class_3222,yarn=...|||100|exact_primary_name
@full mcmap://result/search_mapping/...
```

compact 调用还会返回 MCP `resource_link`，指向同一进程内可读的完整 JSON 资源。客户端需要原始数据时，用 `resources/read` 读取 `mcmap://result/<tool>/<digest>`；不需要时，只把紧凑摘要放进模型上下文。

适用建议：

- 写 mod 时优先用 `format: "compact"`，让 AI 少读重复 JSON key。
- 调试、脚本解析、兼容旧客户端时继续用默认 JSON。
- `search_mapping` 的 `format: "human"` 仍保留兼容，但推荐 AI 使用 compact。
- compact 中的 `relatedCandidates` 仍单独分区，不会混入主结果。
- 生态依赖建议仍保留 `confidence=verified` / `confidence=unversioned` 区分；只有验证过的项才给可复制 `coordinate`。
- Forge 生态建议包含 Architectury API、Cloth Config、REI 和 JEI；其中 JEI 使用 Forge/NeoForge 时代差异化 artifact 解析。

## 本地开发

```powershell
npm install
npm run build
npm run start
```

注册本地构建产物：

```powershell
codex mcp add mcmap -- node "dist\index.js"
```

冒烟测试：

```powershell
npm run smoke
```

## 数据源

从上游直接解析，不依赖第三方中间层：

Mojang version manifest、Fabric Maven (yarn / intermediary)、Legacy Fabric Maven、Quilt Maven、Forge Maven (MCPConfig / MCP CSV / SRG / CSRG)、ParchmentMC Maven、Fabric Meta v2、NeoFore Maven、Legacy Fabric Meta v2。

## 缓存

网络响应缓存到用户级目录，不污染项目文件夹：

```
Windows:  %LOCALAPPDATA%\mcmap\
Linux:    $XDG_CACHE_HOME/mcmap/ 或 ~/.cache/mcmap/
macOS:    ~/Library/Caches/mcmap/
```

删除缓存目录即可强制重新拉取上游数据。

## 发布

```powershell
npm run build
npm run check
npm pack --dry-run
```

## 环境要求

Node.js ≥ 18.14，Windows 下需 PowerShell 7。
