import type { MappingRecord } from "./types.js";

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

export function formatMappingRecord(record: MappingRecord): unknown {
  return {
    kind: record.kind,
    version: record.version,
    owner: record.owner,
    descriptor: record.descriptor,
    names: record.names,
    comment: record.comment,
    side: record.side,
    source: record.source,
  };
}

export function asError(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    content: [
      {
        type: "text",
        text: error instanceof Error ? error.message : String(error),
      },
    ],
    isError: true,
  };
}
