import type { RelatedCandidate, SearchResult, ToolErrorPayload } from "./types.js";

export function asJsonText(value: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
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
): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const payload = toToolErrorPayload(error, context);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    isError: true,
  };
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
