import type { CallToolResult, ResourceLink } from "@modelcontextprotocol/sdk/types.js";
import type {
  EcosystemRecommendation,
  EcosystemRecommendationResult,
  LoaderVersionResult,
  RelatedCandidate,
  SearchResult,
  ToolErrorPayload,
  VersionList,
} from "./types.js";

export type ToolOutputFormat = "json" | "human" | "compact";

export interface NamespaceListPayload {
  cacheRoot: string;
  namespaces: Array<{
    id: string;
    aliases: string[];
    description: string;
    supports: string[];
    status?: string;
    searchTarget?: string;
    versionSummary?: {
      stableCount: number;
      snapshotCount: number;
      aliasCount?: number;
      latestStable?: string;
      latestSnapshot?: string;
      status: string;
      reason?: string;
    };
  }>;
}

export interface SearchMappingPayload {
  query: string;
  namespace: string;
  version: string;
  count: number;
  results: unknown[];
  queryAnalysis?: unknown;
  relatedCandidates?: unknown[];
}

export function asJsonText(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
    structuredContent: asStructuredContent(value),
  };
}

export function asToolResult(options: {
  payload: Record<string, unknown>;
  text?: string;
  resourceLink?: ResourceLink;
}): CallToolResult {
  const content: CallToolResult["content"] = [
    {
      type: "text",
      text: options.text ?? JSON.stringify(options.payload, null, 2),
    },
  ];
  if (options.resourceLink) {
    content.push(options.resourceLink);
  }
  return {
    content,
    structuredContent: options.payload,
  };
}

export function formatMappingRecord(record: SearchResult): unknown {
  return {
    kind: record.kind,
    version: record.version,
    owner: record.owner,
    descriptor: record.descriptor,
    readableDescriptor:
      record.readableDescriptor && record.readableDescriptor !== record.descriptor
        ? record.readableDescriptor
        : undefined,
    names: record.names,
    comment: record.comment,
    side: record.side,
    source: record.source,
    score: record.score,
    matchReasons: record.matchReasons,
    matchedNames: record.matchedNames,
  };
}

export function formatRelatedCandidate(candidate: RelatedCandidate): unknown {
  return {
    confidence: candidate.confidence,
    reasons: candidate.reasons,
    mapping: formatMappingRecord(candidate.mapping),
  };
}

export function formatMappingRecordHuman(record: SearchResult): string {
  const names = Object.entries(record.names)
    .filter(([, value]) => Boolean(value))
    .map(([namespace, value]) => `${namespace}=${value}`)
    .join(", ");
  const descriptor = record.readableDescriptor ?? record.descriptor;
  const parts = [
    `${record.kind}: ${names}`,
    record.owner ? `owner=${record.owner}` : undefined,
    descriptor ? `descriptor=${descriptor}` : undefined,
    `score=${record.score}`,
    record.matchReasons.length > 0 ? `reasons=${record.matchReasons.join(",")}` : undefined,
  ].filter(Boolean);
  return parts.join(" | ");
}

export function formatRelatedCandidateHuman(candidate: RelatedCandidate): string {
  return [
    `candidate confidence=${candidate.confidence}`,
    `reasons=${candidate.reasons.join(",")}`,
    formatMappingRecordHuman(candidate.mapping),
  ].join(" | ");
}

export function asError(
  error: unknown,
  context: { namespace?: string; version?: string } = {},
  format: "json" | "compact" = "json",
): CallToolResult {
  const payload = toToolErrorPayload(error, context);
  return {
    content: [
      {
        type: "text",
        text: format === "compact" ? formatCompactError(payload) : JSON.stringify(payload, null, 2),
      },
    ],
    isError: true,
  };
}

export function formatNamespacesCompact(payload: NamespaceListPayload, fullUri?: string): string {
  const searchable = payload.namespaces.filter((namespace) => namespace.status !== "known-unsupported").length;
  const lines = [
    `!summary ${payload.namespaces.length} namespaces listed; ${searchable} have search or metadata support.`,
    compactHeader("mcmap.namespaces.v1", {
      count: payload.namespaces.length,
      cacheRoot: payload.cacheRoot,
    }),
    dsvHeader(["id", "aliases", "status", "stable", "snapshots", "latest", "supports", "description"]),
    ...payload.namespaces.map((namespace) =>
      dsvRow([
        namespace.id,
        namespace.aliases.join(","),
        namespace.status ?? "",
        namespace.versionSummary?.status === "available" ? namespace.versionSummary.stableCount : "",
        namespace.versionSummary?.status === "available" ? namespace.versionSummary.snapshotCount : "",
        namespace.versionSummary?.latestStable ?? "",
        namespace.supports.join(","),
        namespace.description,
      ]),
    ),
  ];
  if (fullUri) {
    lines.push(`@full ${escapeCell(fullUri)}`);
  }
  return lines.join("\n");
}

export function formatVersionsCompact(payload: VersionList, fullUri?: string): string {
  const stableSample = boundedSample(payload.stable);
  const snapshotSample = boundedSample(payload.snapshots);
  const aliasKeys = payload.aliases ? Object.keys(payload.aliases) : [];
  const lines = [
    `!summary ${payload.namespace} supports ${payload.stable.length} stable versions and ${payload.snapshots.length} snapshots.`,
    compactHeader("mcmap.versions.v1", {
      namespace: payload.namespace,
      stable_count: payload.stable.length,
      snapshot_count: payload.snapshots.length,
      alias_count: aliasKeys.length || undefined,
      source: payload.source,
    }),
    `stable_sample=${escapeCell(stableSample)}`,
    `snapshot_sample=${escapeCell(snapshotSample)}`,
  ];
  if (aliasKeys.length > 0) {
    lines.push(`alias_key_sample=${escapeCell(boundedSample(aliasKeys))}`);
  }
  if (fullUri) {
    lines.push(`@full ${escapeCell(fullUri)}`);
  }
  return lines.join("\n");
}

export function formatSearchCompact(
  payload: {
    query: string;
    namespace: string;
    version: string;
    count: number;
    results: ReturnType<typeof formatMappingRecord>[];
    queryAnalysis?: unknown;
    relatedCandidates?: ReturnType<typeof formatRelatedCandidate>[];
  },
  fullUri?: string,
): string {
  const lines = [
    `!summary ${payload.count} primary results for ${payload.namespace} ${payload.version} query="${escapeInline(payload.query)}".`,
    compactHeader("mcmap.search.v1", {
      query: payload.query,
      namespace: payload.namespace,
      version: payload.version,
      count: payload.count,
    }),
    dsvHeader(["rank", "kind", "primary", "names", "owner", "desc", "score", "why"]),
    ...payload.results.map((result, index) => formatSearchRow(result, payload.namespace, index + 1)),
  ];
  const relatedCandidates = payload.relatedCandidates ?? [];
  if (relatedCandidates.length > 0) {
    lines.push(
      `@section related n=${relatedCandidates.length}`,
      dsvHeader(["rank", "confidence", "kind", "primary", "names", "owner", "desc", "score", "why"]),
      ...relatedCandidates.map((candidate, index) => {
        const candidateRecord = isRecord(candidate) ? candidate : {};
        const mapping = isRecord(candidateRecord.mapping) ? candidateRecord.mapping : {};
        return dsvRow([
          index + 1,
          String(candidateRecord.confidence ?? ""),
          String(mapping.kind ?? ""),
          primaryName(mapping, payload.namespace),
          formatNames(mapping.names),
          String(mapping.owner ?? ""),
          descriptorText(mapping),
          String(mapping.score ?? ""),
          [...stringArray(candidateRecord.reasons), ...stringArray(mapping.matchReasons)].join(","),
        ]);
      }),
    );
  }
  if (fullUri) {
    lines.push(`@full ${escapeCell(fullUri)}`);
  }
  return lines.join("\n");
}

export function formatEcosystemCompact(
  payload: EcosystemRecommendationResult,
  fullUri?: string,
): string {
  const verified = payload.recommendations.filter((item) => item.confidence === "verified").length;
  const lines = [
    `!summary ${payload.loader} ${payload.minecraft}: ${verified} verified recommendations, ${payload.recommendations.length - verified} unversioned.`,
    compactHeader("mcmap.ecosystem.v1", {
      loader: payload.loader,
      minecraft: payload.minecraft,
      count: payload.recommendations.length,
    }),
    dsvHeader(["id", "name", "kind", "artifact", "coordinate", "confidence", "reason", "source"]),
    ...payload.recommendations.map((item) => formatRecommendationRow(item)),
  ];
  if (fullUri) {
    lines.push(`@full ${escapeCell(fullUri)}`);
  }
  return lines.join("\n");
}

export function formatLoaderVersionsCompact(
  payload: LoaderVersionResult,
  fullUri?: string,
): string {
  const ecosystemRows = payload.versions.flatMap((value) => {
    const row = isRecord(value) ? value : {};
    const minecraft = String(row.minecraft ?? "");
    const recommendations = Array.isArray(row.ecosystemRecommendations)
      ? row.ecosystemRecommendations
      : [];
    return recommendations.map((item) => ({ minecraft, item }));
  });
  const lines = [
    `!summary ${payload.loader}: ${payload.versions.length} loader version rows.`,
    compactHeader("mcmap.loader_versions.v1", {
      loader: payload.loader,
      count: payload.versions.length,
      view: payload.view,
      source: payload.source,
    }),
    dsvHeader(["mc", "loader", "api", "mappings", "extra"]),
    ...payload.versions.map(formatLoaderVersionRow),
  ];
  if (ecosystemRows.length > 0) {
    lines.push(
      `@section ecosystem n=${ecosystemRows.length}`,
      dsvHeader(["mc", "id", "name", "coordinate", "confidence", "reason"]),
      ...ecosystemRows.map(({ minecraft, item }) => formatLoaderEcosystemRow(minecraft, item)),
    );
  }
  if (fullUri) {
    lines.push(`@full ${escapeCell(fullUri)}`);
  }
  return lines.join("\n");
}

function asStructuredContent(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function toToolErrorPayload(
  error: unknown,
  context: { namespace?: string; version?: string },
): ToolErrorPayload {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  let code: ToolErrorPayload["error"]["code"] = "INTERNAL_ERROR";
  let suggestions: string[] | undefined;

  if (lower.startsWith("unsupported namespace:")) {
    code = "UNSUPPORTED_NAMESPACE";
    suggestions = ["Use list_namespaces to inspect supported namespaces."];
  } else if (
    lower.includes("not available for") ||
    lower.startsWith("unknown mojang version:")
  ) {
    code = "UNSUPPORTED_VERSION";
    suggestions = ["Use get_namespace_versions to inspect supported versions."];
  } else if (lower.startsWith("no mcp/srg mappings found for")) {
    code = "MAPPINGS_NOT_FOUND";
    suggestions = ["Try a different namespace or version supported by get_namespace_versions."];
  }

  return {
    error: {
      code,
      message,
      namespace: context.namespace,
      version: context.version,
      suggestions,
    },
  };
}

function formatCompactError(payload: ToolErrorPayload): string {
  const parts = [
    `code=${escapeCell(payload.error.code)}`,
    `message=${escapeCell(payload.error.message)}`,
    payload.error.namespace ? `namespace=${escapeCell(payload.error.namespace)}` : undefined,
    payload.error.version ? `version=${escapeCell(payload.error.version)}` : undefined,
    payload.error.suggestions?.[0] ? `suggestion=${escapeCell(payload.error.suggestions[0])}` : undefined,
  ].filter(Boolean);
  return `!error ${parts.join(" ")}`;
}

function compactHeader(schema: string, metadata: Record<string, unknown>): string {
  const values = Object.entries(metadata)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${escapeCell(formatValue(value))}`);
  return [`@S=${schema}`, ...values].join(" ");
}

function dsvHeader(columns: string[]): string {
  return `@cols=${columns.join("|")}`;
}

function dsvRow(values: unknown[]): string {
  return values.map((value) => escapeCell(formatValue(value))).join("|");
}

function formatSearchRow(result: unknown, namespace: string, rank: number): string {
  const record = isRecord(result) ? result : {};
  return dsvRow([
    rank,
    record.kind,
    primaryName(record, namespace),
    formatNames(record.names),
    record.owner,
    descriptorText(record),
    record.score,
    stringArray(record.matchReasons).join(","),
  ]);
}

function formatRecommendationRow(item: EcosystemRecommendation): string {
  return dsvRow([
    item.id,
    item.name,
    item.kind,
    item.artifact,
    item.versioned ? item.coordinate : "",
    item.confidence,
    item.versioned ? "" : item.reason,
    item.source,
  ]);
}

function formatLoaderVersionRow(value: unknown): string {
  const row = isRecord(value) ? value : {};
  const loader = row.loader ?? row.forge ?? row.neoforge;
  const api = row.fabricApi ?? row.legacyFabricApi;
  const mappings = row.yarn ?? row.intermediary;
  const knownKeys = new Set([
    "minecraft",
    "loader",
    "forge",
    "neoforge",
    "fabricApi",
    "legacyFabricApi",
    "yarn",
    "intermediary",
    "ecosystemRecommendations",
  ]);
  const extra = Object.fromEntries(
    Object.entries(row).filter(([key]) => !knownKeys.has(key)),
  );
  return dsvRow([
    row.minecraft,
    loader,
    api,
    mappings,
    Object.keys(extra).length > 0 ? formatRecord(extra) : "",
  ]);
}

function formatLoaderEcosystemRow(minecraft: string, value: unknown): string {
  const row = isRecord(value) ? value : {};
  return dsvRow([
    minecraft,
    row.id,
    row.name,
    row.coordinate,
    row.confidence,
    row.reason,
  ]);
}

function primaryName(record: Record<string, unknown>, namespace: string): string {
  const names = isRecord(record.names) ? record.names : {};
  const candidates = [
    names[namespace],
    namespace === "mojang" || namespace === "mojang_raw" ? names.mojmap : undefined,
    namespace === "mojang_srg" ? names.mcp ?? names.srg : undefined,
    namespace === "yarn" ? names.named : undefined,
    namespace === "mcp" ? names.srg : undefined,
    names.yarn,
    names.named,
    names.mcp,
    names.srg,
    names.mojmap,
    names.official,
    names.intermediary,
    names.obfuscated,
  ];
  return String(candidates.find((candidate) => typeof candidate === "string" && candidate.length > 0) ?? "");
}

function formatNames(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }
  return Object.entries(value)
    .filter(([, item]) => item !== undefined && item !== "")
    .map(([key, item]) => `${key}=${String(item)}`)
    .join(",");
}

function descriptorText(record: Record<string, unknown>): string {
  return String(record.readableDescriptor ?? record.descriptor ?? "");
}

function boundedSample(values: string[], edgeCount = 8): string {
  if (values.length <= edgeCount * 2) {
    return values.join(",");
  }
  return `${values.slice(0, edgeCount).join(",")},...,${values.slice(-edgeCount).join(",")}`;
}

function formatRecord(value: Record<string, unknown>): string {
  return Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => `${key}=${formatValue(item)}`)
    .join(",");
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(formatValue).join(",");
  }
  if (isRecord(value)) {
    return formatRecord(value);
  }
  return String(value);
}

function escapeInline(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function escapeCell(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
