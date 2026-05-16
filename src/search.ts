import type {
  AssistedCandidateReason,
  MappingKind,
  MappingRecord,
  MatchReason,
  QueryAnalysis,
  RelatedCandidate,
  Namespace,
  SearchOptions,
  SearchResponse,
  SearchResult,
} from "./types.js";
import { canonicalSearchNamespace, loadRecordsForNamespace } from "./namespaces.js";

interface ScoredRecord {
  record: MappingRecord;
  score: number;
  matchReasons: MatchReason[];
  matchedNames: string[];
}

export async function searchMappings(options: SearchOptions): Promise<SearchResult[]> {
  return (await searchMappingsWithAssistance(options)).results;
}

export async function searchMappingsWithAssistance(options: SearchOptions): Promise<SearchResponse> {
  const namespace = canonicalSearchNamespace(options.namespace);
  const records = await loadRecordsForNamespace(namespace, options.version);
  const canonicalOptions = { ...options, namespace };
  const results = searchLoadedRecords(records, canonicalOptions);

  if (!options.assist) {
    return { results };
  }

  const queryAnalysis = analyzeQuery(canonicalOptions.query, "assisted");
  const relatedCandidates = buildRelatedCandidates(records, canonicalOptions, results, queryAnalysis);

  return {
    results,
    queryAnalysis,
    relatedCandidates,
  };
}

function searchLoadedRecords(records: MappingRecord[], options: SearchOptions): SearchResult[] {
  const query = normalize(options.query);
  const allowed = allowedKinds(options);
  const descriptorNames = buildDescriptorNameMap(records);

  return records
    .map((record) => scoreRecord(record, query, options.query, options.namespace, options.translateMode))
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

function analyzeQuery(query: string, mode: QueryAnalysis["mode"]): QueryAnalysis {
  const tokens = splitQueryTokens(query);
  const descriptorLikeTokens = tokens.filter(looksLikeDescriptorToken);
  const ownerLikeTokens = tokens.filter((token) => !looksLikeDescriptorToken(token) && looksLikeOwnerToken(token));
  const memberLikeTokens = tokens.filter(
    (token) => !looksLikeDescriptorToken(token) && !ownerLikeTokens.includes(token),
  );

  return {
    tokens,
    ownerLikeTokens,
    memberLikeTokens,
    descriptorLikeTokens,
    mode,
  };
}

function buildRelatedCandidates(
  records: MappingRecord[],
  options: SearchOptions,
  primaryResults: SearchResult[],
  queryAnalysis: QueryAnalysis,
): RelatedCandidate[] {
  const allowed = allowedKinds(options);
  const descriptorNames = buildDescriptorNameMap(records);
  const primaryKeys = new Set(primaryResults.map(resultKey));
  const candidates = new Map<string, RelatedCandidate>();
  const ownerTokens = queryAnalysis.ownerLikeTokens;
  const memberTokens =
    queryAnalysis.memberLikeTokens.length > 0
      ? queryAnalysis.memberLikeTokens
      : queryAnalysis.tokens.filter((token) => !ownerTokens.includes(token));

  for (const record of records) {
    if (!allowed.has(record.kind)) {
      continue;
    }

    const ownerMatch = bestOwnerTokenMatch(record, ownerTokens);
    const memberMatch = bestMemberTokenMatch(record, memberTokens, options.namespace, options.translateMode);

    if (ownerMatch && memberMatch) {
      addRelatedCandidate(candidates, record, descriptorNames, primaryKeys, {
        score: memberMatch.exact ? 890 : 760,
        reasons: memberMatch.exact
          ? ["split_owner_member", "owner_leaf_match", "member_exact_after_split"]
          : ["split_owner_member", "owner_leaf_match", "member_related_after_split"],
        confidence: memberMatch.exact ? "high" : "medium",
        matchedNames: memberMatch.matchedNames,
      });
      continue;
    }

    if (ownerMatch && record.kind !== "class") {
      addRelatedCandidate(candidates, record, descriptorNames, primaryKeys, {
        score: 520,
        reasons: ["owner_related_member"],
        confidence: "medium",
        matchedNames: [],
      });
      continue;
    }

    if (memberMatch && ownerTokens.length > 0) {
      addRelatedCandidate(candidates, record, descriptorNames, primaryKeys, {
        score: memberMatch.exact ? 640 : 480,
        reasons: memberMatch.exact ? ["member_exact_after_split"] : ["member_related_after_split"],
        confidence: "low",
        matchedNames: memberMatch.matchedNames,
      });
    }
  }

  return [...candidates.values()]
    .sort(compareRelatedCandidates)
    .slice(0, options.limit);
}

function addRelatedCandidate(
  candidates: Map<string, RelatedCandidate>,
  record: MappingRecord,
  descriptorNames: Map<string, string>,
  primaryKeys: Set<string>,
  candidate: {
    score: number;
    reasons: AssistedCandidateReason[];
    confidence: RelatedCandidate["confidence"];
    matchedNames: string[];
  },
): void {
  const key = resultKey(record);
  if (primaryKeys.has(key)) {
    return;
  }

  const mapping: SearchResult = {
    ...record,
    score: candidate.score,
    matchReasons: [],
    matchedNames: uniqueStrings(candidate.matchedNames),
    readableDescriptor: readableDescriptor(record.descriptor, descriptorNames),
  };
  const existing = candidates.get(key);
  if (!existing || compareRelatedCandidates({ confidence: candidate.confidence, reasons: candidate.reasons, mapping }, existing) < 0) {
    candidates.set(key, {
      confidence: candidate.confidence,
      reasons: uniqueReasons(candidate.reasons),
      mapping,
    });
  }
}

function compareRelatedCandidates(a: RelatedCandidate, b: RelatedCandidate): number {
  const confidenceOrder = confidenceRank(a.confidence) - confidenceRank(b.confidence);
  if (confidenceOrder !== 0) {
    return confidenceOrder;
  }
  if (a.mapping.score !== b.mapping.score) {
    return b.mapping.score - a.mapping.score;
  }
  return stableRecordKey(a.mapping).localeCompare(stableRecordKey(b.mapping));
}

function confidenceRank(confidence: RelatedCandidate["confidence"]): number {
  if (confidence === "high") {
    return 0;
  }
  if (confidence === "medium") {
    return 1;
  }
  return 2;
}

function bestOwnerTokenMatch(record: MappingRecord, ownerTokens: string[]): string | undefined {
  if (ownerTokens.length === 0) {
    return undefined;
  }
  const values = uniqueStrings([
    record.owner,
    ...Object.values(record.names).filter((value): value is string => Boolean(value)),
  ]);
  return ownerTokens.find((token) => values.some((value) => ownerTokenMatches(value, token)));
}

function ownerTokenMatches(value: string, token: string): boolean {
  const normalizedToken = normalize(token);
  const normalizedValue = normalize(value);
  const normalizedLeaf = normalize(leafName(value));
  return (
    normalizedValue === normalizedToken ||
    normalizedLeaf === normalizedToken ||
    normalizedValue.endsWith(`/${normalizedToken}`) ||
    normalizedValue.endsWith(`.${normalizedToken}`)
  );
}

function bestMemberTokenMatch(
  record: MappingRecord,
  memberTokens: string[],
  namespace: string,
  translateMode: SearchOptions["translateMode"],
): { exact: boolean; matchedNames: string[] } | undefined {
  if (memberTokens.length === 0 || record.kind === "class") {
    return undefined;
  }

  const primaryNamespace = primaryNamespaceFor(namespace);
  const primaryName = primaryNamespace ? record.names[primaryNamespace] : undefined;
  const alternateNames = Object.entries(record.names)
    .filter(([name, value]) => name !== primaryNamespace && Boolean(value))
    .map(([, value]) => value as string);
  const candidates = searchableNames(primaryName, alternateNames, translateMode);
  const matchedNames: string[] = [];
  let exact = false;

  for (const token of memberTokens) {
    const normalizedToken = normalize(token);
    for (const candidate of candidates) {
      const normalizedCandidate = normalize(candidate);
      const normalizedLeaf = normalize(leafName(candidate));
      if (normalizedCandidate === normalizedToken || normalizedLeaf === normalizedToken) {
        exact = true;
        matchedNames.push(candidate);
      } else if (normalizedLeaf.includes(normalizedToken) || normalizedCandidate.includes(normalizedToken)) {
        matchedNames.push(candidate);
      }
    }
  }

  if (matchedNames.length === 0) {
    return undefined;
  }
  return { exact, matchedNames: uniqueStrings(matchedNames) };
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
  rawQuery: string,
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
    score: adjustedScore(record, score, rawQuery, query),
    matchReasons: [...matchReasons],
    matchedNames: uniqueStrings(matchedNames),
  };
}

function adjustedScore(record: MappingRecord, score: number, rawQuery: string, normalizedQuery: string): number {
  if (score === 0) {
    return score;
  }
  if (!looksLikeClassQuery(rawQuery)) {
    return score;
  }
  if (record.kind === "class") {
    return score + 120;
  }
  if (hasExactMemberLeaf(record, normalizedQuery)) {
    return Math.max(0, score - 160);
  }
  return score;
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

function resultKey(record: MappingRecord): string {
  return stableRecordKey(record);
}

function primaryNamespaceFor(namespace: string): Namespace | undefined {
  switch (namespace.toLowerCase()) {
    case "mojmap":
    case "official":
    case "mojang":
    case "mojang_raw":
      return "mojmap";
    case "intermediary":
      return "intermediary";
    case "yarn":
    case "named":
    case "legacy-yarn":
    case "quilt-mappings":
      return "yarn";
    case "mcp":
    case "mojang_srg":
      return "mcp";
    case "srg":
      return "srg";
    default:
      return undefined;
  }
}

function looksLikeClassQuery(query: string): boolean {
  const trimmed = query.trim();
  return /^[A-Z][A-Za-z0-9_$]*$/.test(trimmed) && !trimmed.includes("_") && !trimmed.includes("(") && !trimmed.includes(";");
}

function hasExactMemberLeaf(record: MappingRecord, query: string): boolean {
  if (record.kind === "class") {
    return false;
  }
  return Object.values(record.names).some((value) => value ? normalize(leafName(value)) === query : false);
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

function uniqueReasons(values: AssistedCandidateReason[]): AssistedCandidateReason[] {
  return [...new Set(values)];
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

function splitQueryTokens(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function looksLikeDescriptorToken(token: string): boolean {
  return token.startsWith("(") || /^L[^;]+;$/.test(token) || /^\[[BCDFIJSZL]/.test(token);
}

function looksLikeOwnerToken(token: string): boolean {
  if (token.includes("/") || token.includes(".")) {
    return true;
  }
  if (/^class_\d+$/.test(token)) {
    return true;
  }
  if (/^(method|field|func|p)_\d/.test(token)) {
    return false;
  }
  if (/^[a-z]{1,4}(?:\$[a-z0-9_]+)?$/.test(token)) {
    return false;
  }
  return /^[A-Z]/.test(token) || token.includes("$");
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
