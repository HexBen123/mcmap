#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  asError,
  asJsonText,
  asToolResult,
  formatEcosystemCompact,
  formatLoaderVersionsCompact,
  formatMappingRecord,
  formatMappingRecordHuman,
  formatNamespacesCompact,
  formatSearchCompact,
  formatVersionsCompact,
  formatRelatedCandidate,
  formatRelatedCandidateHuman,
} from "./format.js";
import { listFullResultResources, readFullResultResource, registerFullResultResource } from "./resources.js";
import {
  ecosystemRecommendationOutputSchema,
  loaderVersionsOutputSchema,
  namespaceListOutputSchema,
  searchMappingOutputSchema,
  versionListOutputSchema,
} from "./schemas.js";
import { getVersionListForNamespace, listNamespaceInfoWithVersions } from "./namespaces.js";
import { searchMappingsWithAssistance } from "./search.js";
import { getEcosystemRecommendations, getLoaderVersions } from "./sources/loaders.js";
import { getCacheRoot } from "./utils/cache.js";

const server = new McpServer({
  name: "mcmap",
  version: "1.5.0",
});

const compactFormatSchema = z.enum(["compact", "json"]).default("compact").describe("输出格式，默认 compact；json 用于脚本解析和调试");

server.registerResource(
  "mcmap-full-results",
  new ResourceTemplate("mcmap://result/{tool}/{digest}", {
    list: () => ({ resources: listFullResultResources() }),
  }),
  {
    title: "mcmap full JSON results",
    description: "Process-local full JSON payloads referenced by mcmap compact tool results.",
    mimeType: "application/json",
    annotations: {
      audience: ["assistant"],
      priority: 0.2,
    },
  },
  async (uri) => readFullResultResource(uri.toString()),
);

server.registerTool(
  "list_namespaces",
  {
    description: "列出所有可用的 Minecraft 映射命名空间及其数据源。",
    inputSchema: z.object({
      format: compactFormatSchema,
    }),
    outputSchema: namespaceListOutputSchema,
  },
  async ({ format }) => {
    const payload = {
      cacheRoot: getCacheRoot(),
      namespaces: await listNamespaceInfoWithVersions(),
    };
    if (format === "compact") {
      const resourceLink = registerFullResultResource("list_namespaces", "mcmap.namespaces.v1", payload);
      return asToolResult({
        payload,
        text: formatNamespacesCompact(payload, resourceLink.uri),
        resourceLink,
      });
    }
    return asJsonText(payload);
  },
);

server.registerTool(
  "get_namespace_versions",
  {
    description: "查询指定命名空间支持的 Minecraft 版本，区分稳定版与快照版。",
    inputSchema: z.object({
      namespace: z
        .string()
        .describe("命名空间 ID，如 yarn、legacy-yarn、quilt-mappings、mojmap/mojang、mcp/srg、intermediary、parchment"),
      format: compactFormatSchema,
    }),
    outputSchema: versionListOutputSchema,
  },
  async ({ namespace, format }) => {
    try {
      const payload = await getVersionListForNamespace(namespace);
      if (format === "compact") {
        const resourceLink = registerFullResultResource("get_namespace_versions", "mcmap.versions.v1", payload);
        return asToolResult({
          payload: payload as unknown as Record<string, unknown>,
          text: formatVersionsCompact(payload, resourceLink.uri),
          resourceLink,
        });
      }
      return asJsonText(payload);
    } catch (error) {
      return asError(error, { namespace }, format);
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
      format: z.enum(["compact", "json", "human"]).default("compact").describe("输出格式，默认 compact；json 用于脚本解析和调试"),
      assist: z
        .boolean()
        .default(false)
        .describe("启用可选的 AI 辅助发现。低置信候选会放在 relatedCandidates，不会混入主 results。"),
    }),
    outputSchema: searchMappingOutputSchema,
  },
  async (args) => {
    try {
      const search = await searchMappingsWithAssistance({
        query: args.query,
        namespace: args.namespace,
        version: args.version,
        limit: args.limit,
        allowClasses: args.allow_classes,
        allowMethods: args.allow_methods,
        allowFields: args.allow_fields,
        translateMode: args.translate_mode,
        format: args.format,
        assist: args.assist,
      });
      const payload = {
        query: args.query,
        namespace: args.namespace,
        version: args.version,
        count: search.results.length,
        results: search.results.map(formatMappingRecord),
        queryAnalysis: search.queryAnalysis,
        relatedCandidates: search.relatedCandidates?.map(formatRelatedCandidate),
      };
      if (args.format === "compact") {
        const resourceLink = registerFullResultResource("search_mapping", "mcmap.search.v1", payload);
        return asToolResult({
          payload,
          text: formatSearchCompact(payload, resourceLink.uri),
          resourceLink,
        });
      }
      if (args.format === "human") {
        return asToolResult({
          payload,
          text: JSON.stringify({
            query: args.query,
            namespace: args.namespace,
            version: args.version,
            count: search.results.length,
            results: search.results.map(formatMappingRecordHuman),
            queryAnalysis: search.queryAnalysis,
            relatedCandidates: search.relatedCandidates?.map(formatRelatedCandidateHuman),
          }, null, 2),
        });
      }
      return asJsonText(payload);
    } catch (error) {
      return asError(
        error,
        { namespace: args.namespace, version: args.version },
        args.format === "compact" ? "compact" : "json",
      );
    }
  },
);

server.registerTool(
  "get_ecosystem_recommendations",
  {
    description:
      "按加载器和 Minecraft 版本返回可选生态依赖建议。该工具只给可选建议，不替代 get_loader_versions 的核心依赖事实。",
    inputSchema: z.object({
      loader: z.enum(["fabric", "forge", "neoforge", "legacy-fabric"]).default("fabric"),
      minecraft: z.string().describe("目标 Minecraft 版本，如 1.21.1"),
      format: compactFormatSchema,
    }),
    outputSchema: ecosystemRecommendationOutputSchema,
  },
  async ({ loader, minecraft, format }) => {
    const payload = await getEcosystemRecommendations(loader, minecraft);
    if (format === "compact") {
      const resourceLink = registerFullResultResource(
        "get_ecosystem_recommendations",
        "mcmap.ecosystem.v1",
        payload,
      );
      return asToolResult({
        payload: payload as unknown as Record<string, unknown>,
        text: formatEcosystemCompact(payload, resourceLink.uri),
        resourceLink,
      });
    }
    return asJsonText(payload);
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
      view: z.enum(["core", "with_ecosystem"]).default("core").describe("core 只返回加载器核心依赖；with_ecosystem 同步返回每个版本的常用生态建议"),
      format: compactFormatSchema,
    }),
    outputSchema: loaderVersionsOutputSchema,
  },
  async ({ loader, stable_only, limit, view, format }) => {
    try {
      const payload = await getLoaderVersions(loader, stable_only, limit, view);
      if (format === "compact") {
        const resourceLink = registerFullResultResource(
          "get_loader_versions",
          "mcmap.loader_versions.v1",
          payload,
        );
        return asToolResult({
          payload: payload as unknown as Record<string, unknown>,
          text: formatLoaderVersionsCompact(payload, resourceLink.uri),
          resourceLink,
        });
      }
      return asJsonText(payload);
    } catch (error) {
      return asError(error, {}, format);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mcmap MCP server running on stdio");
