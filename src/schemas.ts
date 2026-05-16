import { z } from "zod";

const stringArraySchema = z.array(z.string());

const mappingResultSchema = z.object({
  kind: z.enum(["class", "method", "field", "param"]),
  version: z.string(),
  owner: z.string().optional(),
  descriptor: z.string().optional(),
  readableDescriptor: z.string().optional(),
  names: z.record(z.string(), z.string()),
  comment: z.string().optional(),
  side: z.string().optional(),
  source: z.string(),
  score: z.number(),
  matchReasons: stringArraySchema,
  matchedNames: stringArraySchema,
});

const queryAnalysisSchema = z.object({
  tokens: stringArraySchema,
  ownerLikeTokens: stringArraySchema,
  memberLikeTokens: stringArraySchema,
  descriptorLikeTokens: stringArraySchema,
  mode: z.enum(["strict", "assisted"]),
});

const relatedCandidateSchema = z.object({
  confidence: z.enum(["high", "medium", "low"]),
  reasons: stringArraySchema,
  mapping: mappingResultSchema,
});

const namespaceInfoSchema = z.object({
  id: z.string(),
  aliases: stringArraySchema,
  description: z.string(),
  supports: stringArraySchema,
});

export const namespaceListOutputSchema = z.object({
  cacheRoot: z.string(),
  namespaces: z.array(namespaceInfoSchema),
});

export const versionListOutputSchema = z.object({
  namespace: z.string(),
  stable: stringArraySchema,
  snapshots: stringArraySchema,
  aliases: z.record(z.string(), stringArraySchema).optional(),
  source: z.string(),
});

export const searchMappingOutputSchema = z.object({
  query: z.string(),
  namespace: z.string(),
  version: z.string(),
  count: z.number(),
  results: z.array(mappingResultSchema),
  queryAnalysis: queryAnalysisSchema.optional(),
  relatedCandidates: z.array(relatedCandidateSchema).optional(),
});

export const loaderVersionsOutputSchema = z.object({
  loader: z.string(),
  versions: z.array(z.record(z.string(), z.unknown())),
  source: z.string(),
});

const ecosystemRecommendationBaseSchema = z.object({
    id: z.string(),
    name: z.string(),
    artifact: z.string(),
    kind: z.enum(["api", "utility", "ui"]),
    source: z.string(),
    repositories: stringArraySchema,
});

const versionedEcosystemRecommendationSchema = ecosystemRecommendationBaseSchema.extend({
    versioned: z.literal(true),
    confidence: z.literal("verified"),
    version: z.string().optional(),
    coordinate: z.string(),
    versionSource: z.string().optional(),
});

const unversionedEcosystemRecommendationSchema = ecosystemRecommendationBaseSchema.extend({
    versioned: z.literal(false),
    confidence: z.literal("unversioned"),
    reason: z.string(),
});

export const ecosystemRecommendationOutputSchema = z.object({
  loader: z.enum(["fabric", "forge", "neoforge", "legacy-fabric"]),
  minecraft: z.string(),
  recommendations: z.array(z.union([
    versionedEcosystemRecommendationSchema,
    unversionedEcosystemRecommendationSchema,
  ])),
});
