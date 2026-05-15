import type {
  MappingKind,
  MappingRecord,
  MatchReason,
  Namespace,
  SearchOptions,
  SearchResult,
} from "./types.js";
import { loadIntermediary, loadYarn } from "./sources/fabric.js";
import { loadLegacyYarn } from "./sources/legacyFabric.js";
import { loadMcp } from "./sources/mcp.js";
import { loadMojmap } from "./sources/mojang.js";
import { loadQuiltMappings } from "./sources/quilt.js";

interface ScoredRecord {
  record: MappingRecord;
  score: number;
  matchReasons: MatchReason[];
  matchedNames: string[];
}

export async function searchMappings(options: SearchOptions): Promise<SearchResult[]> {
  const records = await loadRecordsForNamespace(options.namespace, options.version);
  const query = normalize(options.query);
  const allowed = allowedKinds(options);
  const descriptorNames = buildDescriptorNameMap(records);

  return records
    .map((record) => scoreRecord(record, query, options.namespace, options.translateMode))
    .filter(({ record, score }) => score > 0 && allowed.has(record.kind))
    .sort(compareScoredRecords)
    .slice(0, options.limit)
    .map(({ record, score, matchReasons, matchedNames }) => ({
      ...record,
      score,
      matchReasons,
      matchedNames,
      readableDescriptor: readableDescriptor(record.descriptor, descriptorNames),
    }));
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
    case "legacy-yarn":
      return loadLegacyYarn(version);
    case "mcp":
    case "srg":
      return loadMcp(version);
    case "quilt-mappings":
      return loadQuiltMappings(version);
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

function scoreRecord(
  record: MappingRecord,
  query: string,
  namespace: string,
  translateMode: SearchOptions["translateMode"],
): ScoredRecord {
  const primaryNamespace = primaryNamespaceFor(namespace);
  const primaryName = primaryNamespace ? record.names[primaryNamespace] : undefined;
  const alternateNames = Object.entries(record.names)
    .filter(([name, value]) => name !== primaryNamespace && Boolean(value))
    .map(([, value]) => value as string);
  const candidates = searchableNames(primaryName, alternateNames, translateMode);
  const matchedNames: string[] = [];
  const matchReasons = new Set<MatchReason>();
  let score = 0;

  for (const candidate of candidates) {
    const candidateScore = scoreName(candidate, query, candidate === primaryName);
    if (candidateScore.score > 0) {
      score = Math.max(score, candidateScore.score);
      matchedNames.push(candidate);
      candidateScore.reasons.forEach((reason) => matchReasons.add(reason));
    }
  }

  const ownerLeaf = leafName(record.owner);
  if (ownerLeaf && normalize(ownerLeaf).includes(query)) {
    score = Math.max(score, 420);
    matchReasons.add("owner_leaf_match");
  }

  if (record.descriptor && normalize(record.descriptor).includes(query)) {
    score = Math.max(score, 240);
    matchReasons.add("descriptor_match");
  }

  if (score === 0) {
    const fallbackValues = [record.owner, record.comment].filter(
      (value): value is string => Boolean(value),
    );
    if (fallbackValues.some((value) => normalize(value).includes(query))) {
      score = 120;
      matchReasons.add("path_substring_match");
    }
  }

  return {
    record,
    score,
    matchReasons: [...matchReasons],
    matchedNames: uniqueStrings(matchedNames),
  };
}

function scoreName(
  candidate: string,
  query: string,
  primary: boolean,
): { score: number; reasons: MatchReason[] } {
  const normalized = normalize(candidate);
  const leaf = normalize(leafName(candidate));
  const reasons: MatchReason[] = [];

  if (normalized === query) {
    reasons.push(primary ? "exact_primary_name" : "exact_alternate_name");
    return { score: primary ? 1000 : 940, reasons };
  }

  if (leaf === query) {
    reasons.push("exact_leaf_name");
    return { score: primary ? 920 : 880, reasons };
  }

  if (leaf.startsWith(query) || normalized.startsWith(query)) {
    reasons.push(primary ? "prefix_primary_name" : "prefix_alternate_name");
    return { score: primary ? 760 : 720, reasons };
  }

  if (tokenize(candidate).includes(query)) {
    reasons.push(primary ? "token_primary_name" : "token_alternate_name");
    return { score: primary ? 680 : 640, reasons };
  }

  if (leaf.includes(query)) {
    reasons.push(primary ? "token_primary_name" : "token_alternate_name");
    return { score: primary ? 560 : 520, reasons };
  }

  if (normalized.includes(query)) {
    reasons.push("path_substring_match");
    return { score: 180, reasons };
  }

  return { score: 0, reasons };
}

function compareScoredRecords(a: ScoredRecord, b: ScoredRecord): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }

  const aPrimaryLength = shortestMatchedLength(a);
  const bPrimaryLength = shortestMatchedLength(b);
  if (aPrimaryLength !== bPrimaryLength) {
    return aPrimaryLength - bPrimaryLength;
  }

  const kindOrder = kindRank(a.record.kind) - kindRank(b.record.kind);
  if (kindOrder !== 0) {
    return kindOrder;
  }

  return stableRecordKey(a.record).localeCompare(stableRecordKey(b.record));
}

function shortestMatchedLength(record: ScoredRecord): number {
  return Math.min(...record.matchedNames.map((name) => leafName(name).length), Number.MAX_SAFE_INTEGER);
}

function kindRank(kind: MappingKind): number {
  if (kind === "class") {
    return 0;
  }
  if (kind === "method") {
    return 1;
  }
  if (kind === "field") {
    return 2;
  }
  return 3;
}

function stableRecordKey(record: MappingRecord): string {
  return [
    record.kind,
    record.owner ?? "",
    record.descriptor ?? "",
    ...Object.values(record.names).filter((value): value is string => Boolean(value)),
  ].join("|");
}

function primaryNamespaceFor(namespace: string): Namespace | undefined {
  switch (namespace.toLowerCase()) {
    case "mojmap":
    case "official":
      return "mojmap";
    case "intermediary":
      return "intermediary";
    case "yarn":
    case "named":
    case "legacy-yarn":
    case "quilt-mappings":
      return "yarn";
    case "mcp":
      return "mcp";
    case "srg":
      return "srg";
    default:
      return undefined;
  }
}

function searchableNames(
  primaryName: string | undefined,
  alternateNames: string[],
  translateMode: SearchOptions["translateMode"],
): string[] {
  if (translateMode === "ab") {
    return uniqueStrings([primaryName]);
  }
  if (translateMode === "ba") {
    return uniqueStrings(alternateNames);
  }
  return uniqueStrings([primaryName, ...alternateNames]);
}

function buildDescriptorNameMap(records: MappingRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== "class") {
      continue;
    }
    const preferred =
      record.names.yarn ??
      record.names.named ??
      record.names.mojmap ??
      record.names.official ??
      record.names.mcp ??
      record.names.srg;
    if (!preferred) {
      continue;
    }
    for (const value of Object.values(record.names)) {
      if (value) {
        map.set(value, preferred);
      }
    }
  }
  return map;
}

function readableDescriptor(
  descriptor: string | undefined,
  descriptorNames: Map<string, string>,
): string | undefined {
  if (!descriptor) {
    return undefined;
  }
  return descriptor.replaceAll(/L([^;]+);/g, (_match, internalName: string) => {
    const replacement = descriptorNames.get(internalName);
    return replacement ? `L${replacement};` : `L${internalName};`;
  });
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function leafName(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.split(/[/.]/).at(-1) ?? value;
}

function normalize(value: string | undefined): string {
  return value?.toLowerCase() ?? "";
}

function tokenize(value: string): string[] {
  const leaf = leafName(value);
  return leaf
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[_$./-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}
