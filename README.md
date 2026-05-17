# mcmap

[![npm](https://img.shields.io/npm/v/@hexben/mcmap)](https://www.npmjs.com/package/@hexben/mcmap)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A518.14-339933)](#环境要求)

MCP 服务，让 AI 编程工具能直接查 Minecraft 映射表、符号名称和 Mod Loader 依赖版本。基于 stdio，数据来自 Mojang、Fabric、Forge、NeoForge、Parchment 和 Legacy Fabric 上游。

## 目录

- [快速开始](#快速开始)
- [工具参考](#工具参考)
  - [list_namespaces](#list_namespaces)
  - [get_namespace_versions](#get_namespace_versions)
  - [search_mapping](#search_mapping)
  - [get_loader_versions](#get_loader_versions)
  - [get_ecosystem_recommendations](#get_ecosystem_recommendations)
- [输出格式](#输出格式)
- [数据源](#数据源)
- [缓存](#缓存)
- [本地开发](#本地开发)
- [发布](#发布)
- [环境要求](#环境要求)

## 快速开始

```powershell
npm install -g @hexben/mcmap@latest
claude mcp add mcmap -- mcmap        # 或 codex mcp add mcmap -- mcmap
```

用 npx 免安装：

```powershell
claude mcp add mcmap -- npx -y @hexben/mcmap@latest
```

注册后即可在 AI 编程工具中使用下面列出的 5 个工具。

## 工具参考

所有工具均声明 MCP `outputSchema`，成功调用会同时返回 `structuredContent`。默认输出格式为 `compact`（紧凑摘要）；需要完整 JSON 时传 `format: "json"`。

### list_namespaces

列出所有可用的映射命名空间及其数据源和版本覆盖信息。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `format` | `"compact"` \| `"json"` | `"compact"` | 输出格式 |

### get_namespace_versions

查询指定命名空间支持的 Minecraft 版本，区分稳定版与快照版。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `namespace` | `string` | 是 | 命名空间 ID：`yarn`、`mojmap`/`mojang`、`intermediary`、`mcp`/`srg`、`parchment`、`legacy-yarn`、`quilt-mappings` |
| `format` | `"compact"` \| `"json"` | 否 | 输出格式，默认 `"compact"` |

### search_mapping

搜索类、方法或字段的映射名。支持部分关键词匹配，返回 obfuscated → mojmap → intermediary → yarn 全链路映射。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | `string` | — | 搜索关键词，支持部分匹配 |
| `namespace` | `string` | `"yarn"` | 命名空间 ID |
| `version` | `string` | `"1.21.1"` | Minecraft 版本，如 `1.21.1`、`1.20.4` |
| `limit` | `number` (1–200) | `20` | 最多返回条目数 |
| `allow_classes` | `boolean` | `true` | 是否包含类结果 |
| `allow_methods` | `boolean` | `true` | 是否包含方法结果 |
| `allow_fields` | `boolean` | `true` | 是否包含字段结果 |
| `assist` | `boolean` | `false` | 启用 AI 辅助发现，低置信候选放入 `relatedCandidates` |
| `format` | `"compact"` \| `"json"` \| `"human"` | `"compact"` | 输出格式 |

Mojmap 类搜索会在同版本 Fabric 数据可用时补充 Intermediary/Yarn 名称。Legacy Yarn 查询优先排列精确类命中。

### get_loader_versions

查询 Fabric / Forge / NeoForge / Legacy Fabric 的 Gradle 依赖坐标。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `loader` | `"fabric"` \| `"forge"` \| `"neoforge"` \| `"legacy-fabric"` | `"fabric"` | Mod 加载器 |
| `stable_only` | `boolean` | `true` | 是否只返回稳定版 Minecraft |
| `limit` | `number` (1–50) | `10` | 返回最近的 N 个版本 |
| `view` | `"core"` \| `"with_ecosystem"` | `"core"` | `core` 只返回核心依赖；`with_ecosystem` 同步返回生态建议 |
| `format` | `"compact"` \| `"json"` | `"compact"` | 输出格式 |

### get_ecosystem_recommendations

可选生态依赖建议（Mod Menu、Cloth Config、JEI/REI 等）。已验证版本直接返回可复制的 `coordinate`。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `loader` | `"fabric"` \| `"forge"` \| `"neoforge"` \| `"legacy-fabric"` | `"fabric"` | Mod 加载器 |
| `minecraft` | `string` | — | 目标 Minecraft 版本，如 `1.21.1` |
| `format` | `"compact"` \| `"json"` | `"compact"` | 输出格式 |

推荐项以 `confidence=verified` / `confidence=unversioned` 区分，仅 verified 项给出可复制坐标。Forge 生态包含 Architectury API、Cloth Config、REI 和 JEI（Forge/NeoForge 差异化 artifact 解析）。

## 输出格式

### compact（默认）

模型可见文本压缩为摘要头 + 表格行，同时保留完整结构化结果。compact 调用会返回 MCP `resource_link`，指向进程内可读的完整 JSON 资源。客户端需要原始数据时用 `resources/read` 读取；不需要时只把紧凑摘要放进上下文。

```text
!summary 2 primary results for yarn 1.21.1 query="ServerPlayer".
@S=mcmap.search.v1 query=ServerPlayer namespace=yarn version=1.21.1 count=2
@cols=rank|kind|primary|names|owner|desc|score|why
1|class|net/minecraft/server/network/ServerPlayerEntity|intermediary=class_3222,...|||100|exact_primary_name
@full mcmap://result/search_mapping/...
```

`get_namespace_versions` 的 compact 输出只给版本数量、样本和 alias key 样本；完整 alias 映射保留在 `structuredContent` 和 `resource_link` 中。

### json

返回完整 JSON 文本，适合脚本解析、调试或兼容旧客户端。

### human（仅 search_mapping）

保留兼容，推荐 AI 使用 compact。

### 格式选择建议

- **写 mod 时**：使用默认 compact，减少重复 JSON key 占用上下文。
- **调试 / 脚本解析**：显式传 `format: "json"`。
- `search_mapping` 的 `relatedCandidates` 在 compact 下单独分区，不混入主结果。
- `list_namespaces` 给出每个命名空间的版本计数摘要，区分"已知名字"和"已完整支持搜索"。

## 数据源

从上游直接解析，不依赖第三方中间层：

Mojang version manifest、Fabric Maven (yarn / intermediary)、Legacy Fabric Maven、Quilt Maven、Forge Maven (MCPConfig / MCP CSV / SRG / CSRG)、ParchmentMC Maven、Fabric Meta v2、NeoForge Maven、Legacy Fabric Meta v2。

## 缓存

网络响应缓存到用户级目录，不污染项目文件夹：

```
Windows:  %LOCALAPPDATA%\mcmap\
Linux:    $XDG_CACHE_HOME/mcmap/ 或 ~/.cache/mcmap/
macOS:    ~/Library/Caches/mcmap/
```

删除缓存目录即可强制重新拉取上游数据。

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

## 发布

```powershell
npm run build
npm run check
npm pack --dry-run
```

## 环境要求

Node.js ≥ 18.14，Windows 下需 PowerShell 7。
