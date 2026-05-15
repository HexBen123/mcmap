export type MappingKind = "class" | "method" | "field" | "param";

export type Namespace =
  | "obfuscated"
  | "official"
  | "mojmap"
  | "intermediary"
  | "yarn"
  | "named"
  | "srg"
  | "mcp"
  | "parchment";

export interface MappingRecord {
  kind: MappingKind;
  version: string;
  source: string;
  owner?: string;
  descriptor?: string;
  names: Partial<Record<Namespace, string>>;
  comment?: string;
  side?: string;
}

export type MatchReason =
  | "exact_primary_name"
  | "exact_alternate_name"
  | "exact_leaf_name"
  | "prefix_primary_name"
  | "prefix_alternate_name"
  | "token_primary_name"
  | "token_alternate_name"
  | "owner_leaf_match"
  | "descriptor_match"
  | "path_substring_match";

export type AssistedCandidateReason =
  | "split_owner_member"
  | "owner_leaf_match"
  | "member_exact_after_split"
  | "member_related_after_split"
  | "owner_related_member"
  | "legacy_alias_match";

export type AssistedCandidateConfidence = "high" | "medium" | "low";

export interface SearchResult extends MappingRecord {
  score: number;
  matchReasons: MatchReason[];
  matchedNames: string[];
  readableDescriptor?: string;
}

export interface QueryAnalysis {
  tokens: string[];
  ownerLikeTokens: string[];
  memberLikeTokens: string[];
  descriptorLikeTokens: string[];
  mode: "strict" | "assisted";
}

export interface RelatedCandidate {
  confidence: AssistedCandidateConfidence;
  reasons: AssistedCandidateReason[];
  mapping: SearchResult;
}

export interface SearchResponse {
  results: SearchResult[];
  queryAnalysis?: QueryAnalysis;
  relatedCandidates?: RelatedCandidate[];
}

export interface SearchOptions {
  query: string;
  namespace: string;
  version: string;
  limit: number;
  allowClasses: boolean;
  allowMethods: boolean;
  allowFields: boolean;
  translateMode: "none" | "ab" | "ba";
  format: "json" | "human";
  assist?: boolean;
}

export interface VersionList {
  namespace: string;
  stable: string[];
  snapshots: string[];
  aliases?: Record<string, string[]>;
  source: string;
}

export interface LoaderVersionResult {
  loader: string;
  versions: unknown[];
  source: string;
}

export type EcosystemRecommendationKind = "api" | "utility" | "ui";
export type EcosystemRecommendationConfidence = "verified" | "unversioned";

export interface EcosystemRecommendationBase {
  id: string;
  name: string;
  artifact: string;
  kind: EcosystemRecommendationKind;
  source: string;
  repositories: string[];
}

export interface VersionedEcosystemRecommendation extends EcosystemRecommendationBase {
  versioned: true;
  confidence: "verified";
  version: string;
  coordinate: string;
  versionSource: string;
}

export interface UnversionedEcosystemRecommendation extends EcosystemRecommendationBase {
  versioned: false;
  confidence: "unversioned";
  reason: string;
}

export type EcosystemRecommendation =
  | VersionedEcosystemRecommendation
  | UnversionedEcosystemRecommendation;

export interface EcosystemRecommendationResult {
  loader: "fabric" | "forge" | "neoforge" | "legacy-fabric";
  minecraft: string;
  recommendations: EcosystemRecommendation[];
}

export interface ToolErrorPayload {
  error: {
    code:
      | "UNSUPPORTED_NAMESPACE"
      | "UNSUPPORTED_VERSION"
      | "MAPPINGS_NOT_FOUND"
      | "INVALID_REQUEST"
      | "INTERNAL_ERROR";
    message: string;
    namespace?: string;
    version?: string;
    suggestions?: string[];
  };
}
