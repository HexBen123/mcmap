# mcmap

面向 Minecraft Mod 开发的映射表查询 MCP 服务。

mcmap 是一个基于 stdio 的 MCP 服务，帮助 AI 编程工具在编写 Mod 时查询 Minecraft 映射表、符号名称和各类 Mod Loader 依赖版本。它直接从 Minecraft、Fabric、Forge、NeoForge、Parchment 和 Legacy Fabric 等上游数据源解析数据，并使用用户级缓存目录保存网络响应。

## 环境要求

- Node.js 18.14 或更新版本。
- Windows 下支持 PowerShell 7。

## 安装与注册

全局安装 npm 包后，可以把 `mcmap` 二进制命令注册给 Codex 或 Claude Code：

```powershell
npm install -g @hexben/mcmap@latest
codex mcp add mcmap -- mcmap
claude mcp add mcmap -- mcmap
```

如果你的 MCP 客户端使用带 `mcpServers` 的 JSON 配置文件，可以写成：

```json
{
  "mcpServers": {
    "mcmap": {
      "command": "mcmap"
    }
  }
}
```

如果不想全局安装，可以用 `npx` 注册：

```powershell
codex mcp add mcmap -- npx -y @hexben/mcmap@latest
claude mcp add mcmap -- npx -y @hexben/mcmap@latest
```

对应的 `mcpServers` JSON 配置是：

```json
{
  "mcpServers": {
    "mcmap": {
      "command": "npx",
      "args": ["-y", "@hexben/mcmap@latest"]
    }
  }
}
```

## 本地开发

从源码运行时，先安装依赖并构建：

```powershell
npm install
npm run build
npm run start
```

本地开发时可以直接注册构建产物：

```powershell
npm run build
codex mcp add mcmap -- node "dist\index.js"
```

对应的 `mcpServers` JSON 配置是：

```json
{
  "mcpServers": {
    "mcmap": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

运行本地 MCP 冒烟测试：

```powershell
npm run smoke
```

这个测试会启动 `dist/index.js`，执行 MCP `initialize` 和 `tools/list`，并验证 Mojmap、Yarn、Intermediary、Legacy MCP/SRG 以及 Loader 版本查询。

## 可用工具

### `list_namespaces`

列出支持的映射命名空间、数据源说明和本机缓存根目录。

### `get_namespace_versions`

查询指定命名空间支持的 Minecraft 版本。当前支持：

- `mojmap` / `official`
- `intermediary`
- `yarn` / `named`
- `mcp` / `srg`
- `parchment`

### `search_mapping`

搜索类、方法、字段和参数名称。结果会尽量包含 owner class、descriptor、obfuscated、official、mojmap、intermediary、yarn、srg、mcp 等可获得的名称。

默认返回 JSON，适合 AI 编程代理继续推理。结果还会包含：

- `score`
- `matchReasons`
- `matchedNames`
- 可推导时的 `readableDescriptor`

`translate_mode` 现在会真实影响搜索方向：

- `none`：搜索当前记录里的全部可用名称。
- `ab`：只按当前命名空间的主名称搜索。
- `ba`：只按替代名称反查回当前命名空间。

如果需要人类快速查看，可显式请求 `format: "human"`；默认仍保持 JSON。

如果查询是“类名 + 成员名”这类不够精确的短语，可以显式打开 `assist: true`。辅助发现不会把低置信候选混进主 `results`，而是额外返回：

- `queryAnalysis`：工具如何拆分 owner-like token、member-like token 和 descriptor-like token。
- `relatedCandidates`：辅助候选列表，每项包含 `confidence`、`reasons` 和完整的 `mapping`。

这个模式适合 AI 在老版本 Forge/MCP 或不确定名称时继续探路。它是辅助发现，不是权威重映射；真正的精确结果仍以主 `results` 为准。

Yarn 查询示例：

```json
{
  "query": "ServerPlayer",
  "namespace": "yarn",
  "version": "1.21.1",
  "limit": 5
}
```

Legacy MCP/SRG 查询示例：

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

反向查询示例：

```json
{
  "query": "method_45729",
  "namespace": "yarn",
  "version": "1.21.1",
  "allow_classes": false,
  "allow_methods": true,
  "allow_fields": false,
  "translate_mode": "ba"
}
```

辅助发现示例：

```json
{
  "query": "MinecraftServer getPlayerManager",
  "namespace": "yarn",
  "version": "1.21.1",
  "limit": 5,
  "assist": true
}
```

老版本 Forge/MCP 辅助发现示例：

```json
{
  "query": "EntityPlayerSP updateEntityActionState",
  "namespace": "mcp",
  "version": "1.7.10",
  "limit": 5,
  "assist": true
}
```

### `get_loader_versions`

查询 Mod Loader 依赖坐标。当前支持：

- `fabric`
- `forge`
- `neoforge`
- `legacy-fabric`

返回结果会按 Minecraft 版本分组，并尽量给出可直接放进 Gradle 的依赖坐标。

### `get_ecosystem_recommendations`

返回某个加载器下常见的**可选**生态建议目录，例如配置库、菜单库或物品查看库。这个工具与 `get_loader_versions` 分开，是为了避免把“核心 loader 事实”和“常见但非必需的生态选择”混在一起。

当工具能从上游 metadata 核验版本时，会返回可直接放进 Gradle 的 `coordinate`：

```json
{
  "loader": "fabric",
  "minecraft": "1.21.1",
  "recommendations": [
    {
      "id": "modmenu",
      "name": "Mod Menu",
      "artifact": "com.terraformersmc:modmenu",
      "kind": "ui",
      "source": "https://api.modrinth.com/v2/project/modmenu/version and https://maven.terraformersmc.com/releases",
      "repositories": ["https://maven.terraformersmc.com/releases"],
      "versioned": true,
      "confidence": "verified",
      "version": "11.0.4",
      "coordinate": "com.terraformersmc:modmenu:11.0.4",
      "versionSource": "https://api.modrinth.com/v2/project/modmenu/version"
    }
  ]
}
```

AI 或脚本只有在 `versioned: true` 且 `confidence: "verified"` 时，才应把 `coordinate` 当成可复制依赖。若上游没有对应版本或临时不可用，结果会保持 `versioned: false`，并给出 `reason`，例如：

```json
{
  "id": "cloth-config",
  "name": "Cloth Config",
  "artifact": "me.shedaniel.cloth:cloth-config-forge",
  "kind": "ui",
  "repositories": ["https://maven.shedaniel.me"],
  "versioned": false,
  "confidence": "unversioned",
  "reason": "No Modrinth version matched Minecraft 1.12.2 with loader forge."
}
```

当前会尽量解析：

- Fabric：Architectury API、Cloth Config、Mod Menu、Roughly Enough Items。
- Forge：Cloth Config、Just Enough Items。JEI 会按上游 Maven metadata
  核验多个历史 artifact 形态，例如旧版 `jei_<minecraft>`、中间版本
  `jei-<minecraft>` 和现代 `jei-<minecraft>-forge-api`。
- NeoForge：Architectury API、Cloth Config、Roughly Enough Items、Just Enough Items。
- Legacy Fabric：保持保守建议，核心 Legacy Fabric API 版本仍以 `get_loader_versions` 为准。

## 数据源

| 类型 | 数据源 |
| --- | --- |
| Mojmap | Mojang version manifest 和官方 client/server mapping 下载 |
| Yarn | Fabric Maven `net.fabricmc:yarn` Tiny v2 artifacts |
| Intermediary | Fabric Maven `net.fabricmc:intermediary` Tiny v2 artifacts |
| Legacy Yarn | Legacy Fabric Maven `net.legacyfabric:yarn` Tiny v2 artifacts |
| Quilt Mappings | Quilt Maven `org.quiltmc:quilt-mappings` intermediary Tiny v2 artifacts |
| MCP/SRG | Forge Maven MCPConfig、MCP stable/snapshot CSV、历史 MCP SRG/CSRG artifacts |
| Parchment | ParchmentMC Maven metadata |
| Fabric Loader | Fabric Meta v2 和 Fabric Maven metadata |
| Forge Loader | Forge Maven `net.minecraftforge:forge` metadata |
| NeoForge Loader | NeoForge Maven `net.neoforged:neoforge` metadata，并结合 Mojang release manifest 推断 Minecraft 版本 |
| Legacy Fabric Loader | Legacy Fabric Meta v2 和 Legacy Fabric Maven metadata |

## 缓存目录

网络响应会缓存到用户级目录：

```text
Windows: %LOCALAPPDATA%\mcmap\
Linux/macOS: $XDG_CACHE_HOME/mcmap/ 或 ~/.cache/mcmap/
```

缓存不会写到项目目录内，因此全局安装后不会在不同工作目录里到处生成 `.cache`。删除这个缓存目录后，下一次查询会重新拉取上游 metadata 和 mapping artifacts。

## 开发与发布检查

构建项目：

```powershell
npm run build
```

检查 TypeScript：

```powershell
npm run check
```

运行 MCP 冒烟测试：

```powershell
npm run smoke
```

发布前可以先做 dry run，确认 npm tarball 只包含 `dist/`、`README.md` 和 `package.json`：

```powershell
npm pack --dry-run
```

## 当前限制

- `parchment` 当前主要暴露版本 metadata，完整参数名和 Javadoc 搜索仍是增量支持范围。
- `search_mapping` 仍以单一主命名空间为入口，但会在可安全对齐时做有限增强，例如 Yarn / Intermediary 之间的补充命名，以及 MCP/SRG 与 MCP CSV 的合并。
- `assist: true` 只做辅助发现。它会返回相关候选和理由，但不会保证候选就是唯一或最终答案；老版本 MCP 尤其可能存在同名方法、多 owner 和多来源 artifact。
- Loader metadata 依赖上游 Maven 和 meta API。如果上游版本格式变化，应调整解析器，而不是伪造结果。
