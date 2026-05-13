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

export async function loadYarn(version: string): Promise<MappingRecord[]> {
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
