import type { MappingRecord, VersionList } from "../types.js";
import { parseTinyV2 } from "../parsers/tiny.js";
import { fetchBufferCached } from "../utils/cache.js";
import { fetchMavenVersions, latestYarnForMinecraft, mavenArtifactUrl } from "../utils/maven.js";
import { stableMinecraftVersion, uniqueSorted } from "../utils/versions.js";
import { readZipText, unzip } from "../utils/zip.js";
import {
  FABRIC_MAVEN,
  INTERMEDIARY_METADATA,
  YARN_METADATA,
} from "./constants.js";

export async function getIntermediaryVersionList(): Promise<VersionList> {
  const versions = await fetchMavenVersions(INTERMEDIARY_METADATA);
  return {
    namespace: "intermediary",
    stable: uniqueSorted(versions.filter(stableMinecraftVersion)),
    snapshots: uniqueSorted(versions.filter((version) => !stableMinecraftVersion(version))),
    source: INTERMEDIARY_METADATA,
  };
}

export async function getYarnVersionList(): Promise<VersionList> {
  const versions = await fetchMavenVersions(YARN_METADATA);
  const aliases: Record<string, string[]> = {};
  for (const version of versions) {
    const [minecraftVersion] = version.split("+build.");
    if (!minecraftVersion) {
      continue;
    }
    aliases[minecraftVersion] ??= [];
    aliases[minecraftVersion].push(version);
  }

  return {
    namespace: "yarn",
    stable: uniqueSorted(Object.keys(aliases).filter(stableMinecraftVersion)),
    snapshots: uniqueSorted(Object.keys(aliases).filter((version) => !stableMinecraftVersion(version))),
    aliases,
    source: YARN_METADATA,
  };
}

export async function loadIntermediary(version: string): Promise<MappingRecord[]> {
  const intermediaryRecords = await loadIntermediaryRaw(version);
  const yarnRecords = await loadYarnRaw(version).catch(() => []);
  return yarnRecords.length > 0
    ? enrichIntermediaryFromYarn(intermediaryRecords, yarnRecords)
    : intermediaryRecords;
}

export async function loadYarn(version: string): Promise<MappingRecord[]> {
  const yarnRecords = await loadYarnRaw(version);
  const intermediaryRecords = await loadIntermediaryRaw(version).catch(() => []);
  return intermediaryRecords.length > 0
    ? enrichYarnFromIntermediary(yarnRecords, intermediaryRecords)
    : yarnRecords;
}

async function loadIntermediaryRaw(version: string): Promise<MappingRecord[]> {
  const artifactVersion = await resolveIntermediaryVersion(version);
  const url = mavenArtifactUrl(
    FABRIC_MAVEN,
    "net.fabricmc",
    "intermediary",
    artifactVersion,
    "jar",
    "v2",
  );
  const entries = unzip(await fetchBufferCached(url, { ttlMs: 30 * 24 * 60 * 60 * 1000 }));
  return parseTinyV2(readZipText(entries, "mappings/mappings.tiny"), version, url);
}

async function loadYarnRaw(version: string): Promise<MappingRecord[]> {
  const artifactVersion = await resolveYarnVersion(version);
  const url = mavenArtifactUrl(FABRIC_MAVEN, "net.fabricmc", "yarn", artifactVersion, "jar", "v2");
  const entries = unzip(await fetchBufferCached(url, { ttlMs: 30 * 24 * 60 * 60 * 1000 }));
  return parseTinyV2(readZipText(entries, "mappings/mappings.tiny"), version, url);
}

async function resolveIntermediaryVersion(version: string): Promise<string> {
  const versions = await fetchMavenVersions(INTERMEDIARY_METADATA);
  if (!versions.includes(version)) {
    throw new Error(`Intermediary mappings are not available for ${version}`);
  }
  return version;
}

async function resolveYarnVersion(version: string): Promise<string> {
  const versions = await fetchMavenVersions(YARN_METADATA);
  if (versions.includes(version)) {
    return version;
  }
  const resolved = latestYarnForMinecraft(versions, version);
  if (!resolved) {
    throw new Error(`Yarn mappings are not available for ${version}`);
  }
  return resolved;
}

function enrichYarnFromIntermediary(
  yarnRecords: MappingRecord[],
  intermediaryRecords: MappingRecord[],
): MappingRecord[] {
  const officialByKey = buildTinyJoinIndex(intermediaryRecords, "intermediary");
  const intermediaryOwnerByYarnOwner = buildClassTranslationIndex(yarnRecords, "yarn", "intermediary");

  return yarnRecords.map((record) => {
    const key = tinyJoinKey(record, "intermediary", intermediaryOwnerByYarnOwner);
    const match = key ? officialByKey.get(key) : undefined;
    if (!match?.names.official) {
      return record;
    }
    return {
      ...record,
      names: {
        ...record.names,
        official: match.names.official,
        obfuscated: match.names.obfuscated ?? match.names.official,
      },
    };
  });
}

function enrichIntermediaryFromYarn(
  intermediaryRecords: MappingRecord[],
  yarnRecords: MappingRecord[],
): MappingRecord[] {
  const yarnByKey = buildTinyJoinIndex(yarnRecords, "intermediary");
  return intermediaryRecords.map((record) => {
    const key = tinyJoinKey(record, "intermediary");
    const match = key ? yarnByKey.get(key) : undefined;
    if (!match?.names.yarn) {
      return record;
    }
    return {
      ...record,
      names: {
        ...record.names,
        named: match.names.named,
        yarn: match.names.yarn,
      },
    };
  });
}

function buildTinyJoinIndex(
  records: MappingRecord[],
  namespace: "intermediary",
): Map<string, MappingRecord> {
  const result = new Map<string, MappingRecord>();
  const ownerMap = buildClassTranslationIndex(records, "yarn", namespace);
  for (const record of records) {
    const key = tinyJoinKey(record, namespace, ownerMap);
    if (key) {
      result.set(key, record);
    }
  }
  return result;
}

function buildClassTranslationIndex(
  records: MappingRecord[],
  from: "yarn" | "intermediary",
  to: "intermediary" | "yarn",
): Map<string, string> {
  const result = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== "class") {
      continue;
    }
    const source = record.names[from];
    const target = record.names[to];
    if (source && target) {
      result.set(source, target);
    }
  }
  return result;
}

function tinyJoinKey(
  record: MappingRecord,
  namespace: "intermediary",
  ownerTranslations = new Map<string, string>(),
): string | undefined {
  const name = record.names[namespace];
  if (!name) {
    return undefined;
  }
  if (record.kind === "class") {
    return `${record.kind}:${name}`;
  }
  const owner = ownerTranslations.get(record.owner ?? "") ?? record.owner;
  if (!owner) {
    return undefined;
  }
  return `${record.kind}:${owner}:${record.descriptor ?? ""}:${name}`;
}
