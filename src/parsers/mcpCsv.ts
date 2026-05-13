import type { MappingRecord } from "../types.js";
import { parseCsv } from "../utils/csv.js";

export interface McpCsvBundle {
  fieldsCsv?: string;
  methodsCsv?: string;
  paramsCsv?: string;
}

export function parseMcpCsvBundle(
  bundle: McpCsvBundle,
  version: string,
  source: string,
): MappingRecord[] {
  const records: MappingRecord[] = [];

  if (bundle.fieldsCsv) {
    for (const row of parseCsv(bundle.fieldsCsv)) {
      if (!row.searge || !row.name) {
        continue;
      }
      records.push({
        kind: "field",
        version,
        source,
        names: {
          srg: row.searge,
          mcp: row.name,
        },
        side: row.side,
        comment: row.desc,
      });
    }
  }

  if (bundle.methodsCsv) {
    for (const row of parseCsv(bundle.methodsCsv)) {
      if (!row.searge || !row.name) {
        continue;
      }
      records.push({
        kind: "method",
        version,
        source,
        names: {
          srg: row.searge,
          mcp: row.name,
        },
        side: row.side,
        comment: row.desc,
      });
    }
  }

  if (bundle.paramsCsv) {
    for (const row of parseCsv(bundle.paramsCsv)) {
      if (!row.param || !row.name) {
        continue;
      }
      records.push({
        kind: "param",
        version,
        source,
        names: {
          srg: row.param,
          mcp: row.name,
        },
        side: row.side,
      });
    }
  }

  return records;
}
