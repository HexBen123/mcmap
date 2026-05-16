# mcmap

[![npm](https://img.shields.io/npm/v/@hexben/mcmap)](https://www.npmjs.com/package/@hexben/mcmap)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A518.14-339933)](#环境要求)

让你的 AI 编程工具能直接查 Minecraft 映射表、符号名称和 Mod Loader 依赖版本。基于 stdio 的 MCP 服务，数据来自 Mojang、Fabric、Forge、NeoFore、Parchment 和 Legacy Fabric 上游。

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
