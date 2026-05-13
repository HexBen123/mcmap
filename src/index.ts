#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { asError, asJsonText, formatMappingRecord } from "./format.js";
import { searchMappings } from "./search.js";
import { getIntermediaryVersionList, getYarnVersionList } from "./sources/fabric.js";
import { getLoaderVersions } from "./sources/loaders.js";
import { getMcpVersionList } from "./sources/mcp.js";
import { getMojangVersionList } from "./sources/mojang.js";
import { getParchmentVersionList } from "./sources/parchment.js";
import { getCacheRoot } from "./utils/cache.js";

const server = new McpServer({
  name: "mcmap",
  version: "1.0.0",
});

server.registerTool(
  "list_namespaces",
  {
    description: "列出所有可用的 Minecraft 映射命名空间及其数据源。",
    inputSchema: z.object({}),
  },
  async () => {
    return asJsonText({
      cacheRoot: getCacheRoot(),
      namespaces: [
        {
          id: "mojmap",
          aliases: ["official"],
          description: "Mojang official mappings from the official version manifest.",
          supports: ["class", "method", "field"],
        },
        {
          id: "intermediary",
          aliases: [],
          description: "Fabric Intermediary mappings from Fabric Maven.",
          supports: ["class", "method", "field"],
        },
        {
          id: "yarn",
          aliases: ["named"],
          description: "Fabric Yarn named mappings from Fabric Maven.",
          supports: ["class", "method", "field", "param"],
        },
        {
          id: "mcp",
          aliases: ["srg"],
          description: "Legacy Forge MCP/SRG mappings from Forge Maven MCPConfig, MCP CSV, and historical SRG/CSRG artifacts.",
          supports: ["class", "method", "field", "param"],
        },
        {
          id: "parchment",
          aliases: [],
          description: "Parchment Mojmap parameter and Javadoc metadata. Version metadata is supported; full search support is incremental.",
          supports: ["param", "comment"],
        },
      ],
    });
  },
);

server.registerTool(
  "get_namespace_versions",
  {
    description: "查询指定命名空间支持的 Minecraft 版本，区分稳定版与快照版。",
    inputSchema: z.object({
      namespace: z.string().describe("命名空间 ID，如 yarn、mojmap、mcp、intermediary、parchment"),
    }),
  },
  async ({ namespace }) => {
    try {
      switch (namespace.toLowerCase()) {
        case "mojmap":
        case "official":
          return asJsonText(await getMojangVersionList());
        case "intermediary":
          return asJsonText(await getIntermediaryVersionList());
        case "yarn":
        case "named":
          return asJsonText(await getYarnVersionList());
        case "mcp":
        case "srg":
          return asJsonText(await getMcpVersionList());
        case "parchment":
          return asJsonText(await getParchmentVersionList());
        default:
          throw new Error(`Unsupported namespace: ${namespace}`);
      }
    } catch (error) {
      return asError(error);
    }
  },
);

server.registerTool(
  "search_mapping",
  {
    description:
      "在指定命名空间和 Minecraft 版本中搜索类、方法或字段的映射名。支持部分关键词匹配。",
    inputSchema: z.object({
      query: z.string().describe("搜索关键词，支持部分匹配"),
      namespace: z.string().default("yarn").describe("命名空间 ID，默认 yarn"),
      version: z.string().default("1.21.1").describe("Minecraft 版本，如 1.21.1、1.20.4"),
      limit: z.number().int().min(1).max(200).default(20).describe("最多返回条目数"),
      allow_classes: z.boolean().default(true).describe("是否包含类结果"),
      allow_methods: z.boolean().default(true).describe("是否包含方法结果"),
      allow_fields: z.boolean().default(true).describe("是否包含字段结果"),
      translate_mode: z.enum(["none", "ab", "ba"]).default("none").describe("兼容字段，当前搜索模式下保留"),
    }),
  },
  async (args) => {
    try {
      const records = await searchMappings({
        query: args.query,
        namespace: args.namespace,
        version: args.version,
        limit: args.limit,
        allowClasses: args.allow_classes,
        allowMethods: args.allow_methods,
        allowFields: args.allow_fields,
        translateMode: args.translate_mode,
      });
      return asJsonText({
        query: args.query,
        namespace: args.namespace,
        version: args.version,
        count: records.length,
        results: records.map(formatMappingRecord),
      });
    } catch (error) {
      return asError(error);
    }
  },
);

server.registerTool(
  "get_loader_versions",
  {
    description:
      "查询指定 mod 加载器各 Minecraft 版本的依赖信息，包括 Yarn、Fabric Loader、Fabric API、Forge、NeoForge 等 Gradle 坐标。",
    inputSchema: z.object({
      loader: z.enum(["fabric", "forge", "neoforge", "legacy-fabric"]).default("fabric"),
      stable_only: z.boolean().default(true),
      limit: z.number().int().min(1).max(50).default(10),
    }),
  },
  async ({ loader, stable_only, limit }) => {
    try {
      return asJsonText(await getLoaderVersions(loader, stable_only, limit));
    } catch (error) {
      return asError(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mcmap MCP server running on stdio");
