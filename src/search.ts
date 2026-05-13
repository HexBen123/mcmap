import type { MappingKind, MappingRecord, SearchOptions } from "./types.js";
import { loadIntermediary, loadYarn } from "./sources/fabric.js";
import { loadMcp } from "./sources/mcp.js";
import { loadMojmap } from "./sources/mojang.js";

export async function searchMappings(options: SearchOptions): Promise<MappingRecord[]> {
  const records = await loadRecordsForNamespace(options.namespace, options.version);
  const query = options.query.toLowerCase();
  const allowed = allowedKinds(options);

  return records
    .map((record) => ({ record, score: scoreRecord(record, query) }))
    .filter(({ record, score }) => score > 0 && allowed.has(record.kind))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit)
    .map(({ record }) => record);
}

async function loadRecordsForNamespace(namespace: string, version: string): Promise<MappingRecord[]> {
  switch (namespace.toLowerCase()) {
    case "mojmap":
    case "official":
      return loadMojmap(version);
    case "intermediary":
      return loadIntermediary(version);
    case "yarn":
    case "named":
      return loadYarn(version);
    case "mcp":
    case "srg":
      return loadMcp(version);
    default:
      throw new Error(`Unsupported namespace: ${namespace}`);
  }
}

function allowedKinds(options: SearchOptions): Set<MappingKind> {
  const kinds = new Set<MappingKind>();
  if (options.allowClasses) {
    kinds.add("class");
  }
  if (options.allowMethods) {
    kinds.add("method");
  }
  if (options.allowFields) {
    kinds.add("field");
  }
  kinds.add("param");
  return kinds;
}

function scoreRecord(record: MappingRecord, query: string): number {
  const values = [
    record.owner,
    record.descriptor,
    record.comment,
    ...Object.values(record.names),
  ].filter((value): value is string => Boolean(value));

  let best = 0;
  for (const value of values) {
    const lower = value.toLowerCase();
    if (lower === query) {
      best = Math.max(best, 100);
    } else if (lower.endsWith(`/${query}`) || lower.endsWith(`.${query}`)) {
      best = Math.max(best, 90);
    } else if (lower.includes(query)) {
      best = Math.max(best, 50);
    }
  }
  return best;
}
