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

export interface SearchOptions {
  query: string;
  namespace: string;
  version: string;
  limit: number;
  allowClasses: boolean;
  allowMethods: boolean;
  allowFields: boolean;
  translateMode: "none" | "ab" | "ba";
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
