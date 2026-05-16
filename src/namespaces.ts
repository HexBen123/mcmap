import type { MappingRecord, VersionList } from "./types.js";
import { loadIntermediary, getIntermediaryVersionList, getYarnVersionList, loadYarn } from "./sources/fabric.js";
import { getLegacyYarnVersionList, loadLegacyYarn } from "./sources/legacyFabric.js";
import { getMcpVersionList, loadMcp } from "./sources/mcp.js";
import { getMojangVersionList, loadMojmap } from "./sources/mojang.js";
import { getParchmentVersionList } from "./sources/parchment.js";
import { getQuiltMappingsVersionList, loadQuiltMappings } from "./sources/quilt.js";

export type NamespaceSupportStatus = "search" | "alias" | "metadata" | "known-unsupported";

export interface NamespaceVersionSummary {
  stableCount: number;
  snapshotCount: number;
  aliasCount?: number;
  latestStable?: string;
  latestSnapshot?: string;
  status: "available" | "unavailable" | "not_implemented";
  reason?: string;
}

export interface NamespaceInfo {
  id: string;
  aliases: string[];
  description: string;
  supports: string[];
  status: NamespaceSupportStatus;
  searchTarget?: string;
  versionSummary?: NamespaceVersionSummary;
}

interface NamespaceDefinition {
  id: string;
  aliases: string[];
  description: string;
  supports: string[];
  status: NamespaceSupportStatus;
  searchTarget?: string;
  versionTarget?: string;
  versionList?: () => Promise<VersionList>;
  loader?: (version: string) => Promise<MappingRecord[]>;
}

export const namespaceDefinitions: NamespaceDefinition[] = [
  {
    id: "mojmap",
    aliases: ["official", "mojang", "mojang_raw"],
    description: "Mojang official mappings from the official version manifest.",
    supports: ["class", "method", "field"],
    status: "search",
    versionList: getMojangVersionList,
    loader: loadMojmap,
  },
  {
    id: "intermediary",
    aliases: [],
    description: "Fabric Intermediary mappings from Fabric Maven.",
    supports: ["class", "method", "field"],
    status: "search",
    versionList: getIntermediaryVersionList,
    loader: loadIntermediary,
  },
  {
    id: "yarn",
    aliases: ["named"],
    description: "Fabric Yarn named mappings from Fabric Maven.",
    supports: ["class", "method", "field", "param"],
    status: "search",
    versionList: getYarnVersionList,
    loader: loadYarn,
  },
  {
    id: "legacy-yarn",
    aliases: [],
    description: "Legacy Fabric Yarn named mappings from Legacy Fabric Maven.",
    supports: ["class", "method", "field", "param"],
    status: "search",
    versionList: getLegacyYarnVersionList,
    loader: loadLegacyYarn,
  },
  {
    id: "quilt-mappings",
    aliases: [],
    description: "Quilt Mappings named mappings from Quilt Maven.",
    supports: ["class", "method", "field", "param"],
    status: "search",
    versionList: getQuiltMappingsVersionList,
    loader: loadQuiltMappings,
  },
  {
    id: "mcp",
    aliases: ["srg"],
    description: "Legacy Forge MCP/SRG mappings from Forge Maven MCPConfig, MCP CSV, and historical SRG/CSRG artifacts.",
    supports: ["class", "method", "field", "param"],
    status: "search",
    versionList: getMcpVersionList,
    loader: loadMcp,
  },
  {
    id: "mojang_srg",
    aliases: [],
    description: "Linkie-style alias backed by mcmap's MCP/SRG data where available.",
    supports: ["class", "method", "field", "param"],
    status: "alias",
    searchTarget: "mcp",
    versionTarget: "mcp",
  },
  {
    id: "parchment",
    aliases: [],
    description: "Parchment Mojmap parameter and Javadoc metadata. Version metadata is supported; full search support is incremental.",
    supports: ["param", "comment"],
    status: "metadata",
    versionList: getParchmentVersionList,
  },
  {
    id: "mojang_hashed",
    aliases: [],
    description: "Known Linkie namespace for hashed Mojang-derived mappings. Listed for discovery; search support is not implemented in mcmap.",
    supports: ["class", "method", "field"],
    status: "known-unsupported",
    versionTarget: "mojmap",
  },
  {
    id: "feather",
    aliases: [],
    description: "Known Linkie namespace. Listed for discovery; search support is not implemented in mcmap.",
    supports: ["class", "method", "field"],
    status: "known-unsupported",
  },
  {
    id: "barn",
    aliases: [],
    description: "Known Linkie namespace. Listed for discovery; search support is not implemented in mcmap.",
    supports: ["class", "method", "field"],
    status: "known-unsupported",
  },
  {
    id: "plasma",
    aliases: [],
    description: "Known Linkie namespace. Listed for discovery; search support is not implemented in mcmap.",
    supports: ["class", "method", "field"],
    status: "known-unsupported",
  },
  {
    id: "yarrn",
    aliases: [],
    description: "Known Linkie namespace. Listed for discovery; search support is not implemented in mcmap.",
    supports: ["class", "method", "field"],
    status: "known-unsupported",
  },
];

export function listNamespaceInfo(): NamespaceInfo[] {
  return namespaceDefinitions.map(toNamespaceInfo);
}

export async function listNamespaceInfoWithVersions(): Promise<NamespaceInfo[]> {
  return Promise.all(namespaceDefinitions.map(async (definition) => ({
    ...toNamespaceInfo(definition),
    versionSummary: await resolveVersionSummary(definition),
  })));
}

export async function getVersionListForNamespace(namespace: string): Promise<VersionList> {
  const definition = resolveNamespaceDefinition(namespace);
  if (definition.versionTarget) {
    const target = await getVersionListForNamespace(definition.versionTarget);
    return {
      ...target,
      namespace: definition.id,
      source: `${target.source} (via ${definition.versionTarget})`,
    };
  }
  if (!definition.versionList) {
    throw new Error(`Version metadata is not implemented for namespace: ${namespace}`);
  }
  const result = await definition.versionList();
  return definition.id === result.namespace ? result : { ...result, namespace: definition.id };
}

export async function loadRecordsForNamespace(namespace: string, version: string): Promise<MappingRecord[]> {
  const definition = resolveNamespaceDefinition(namespace);
  if (definition.searchTarget) {
    return loadRecordsForNamespace(definition.searchTarget, version);
  }
  if (!definition.loader || definition.status !== "search") {
    throw new Error(`Search is not implemented for namespace: ${namespace}`);
  }
  return definition.loader(version);
}

export function canonicalSearchNamespace(namespace: string): string {
  const definition = resolveNamespaceDefinition(namespace);
  return definition.searchTarget ?? definition.id;
}

export function resolveNamespaceDefinition(namespace: string): NamespaceDefinition {
  const lower = namespace.toLowerCase();
  const definition = namespaceDefinitions.find(
    (item) => item.id === lower || item.aliases.some((alias) => alias.toLowerCase() === lower),
  );
  if (!definition) {
    throw new Error(`Unsupported namespace: ${namespace}`);
  }
  return definition;
}

function toNamespaceInfo(definition: NamespaceDefinition): NamespaceInfo {
  return {
    id: definition.id,
    aliases: definition.aliases,
    description: definition.description,
    supports: definition.supports,
    status: definition.status,
    searchTarget: definition.searchTarget ?? (definition.status === "alias" ? definition.id : undefined),
  };
}

async function resolveVersionSummary(definition: NamespaceDefinition): Promise<NamespaceVersionSummary> {
  if (definition.status === "known-unsupported" && !definition.versionTarget) {
    return {
      stableCount: 0,
      snapshotCount: 0,
      status: "not_implemented",
      reason: "Version metadata is not implemented in mcmap.",
    };
  }
  try {
    const versions = await getVersionListForNamespace(definition.id);
    return {
      stableCount: versions.stable.length,
      snapshotCount: versions.snapshots.length,
      aliasCount: versions.aliases ? Object.keys(versions.aliases).length : undefined,
      latestStable: versions.stable[0],
      latestSnapshot: versions.snapshots[0],
      status: "available",
    };
  } catch (error) {
    return {
      stableCount: 0,
      snapshotCount: 0,
      status: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
