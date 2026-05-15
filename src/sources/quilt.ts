import type { MappingRecord, VersionList } from "../types.js";
import { parseTinyV2 } from "../parsers/tiny.js";
import { fetchBufferCached } from "../utils/cache.js";
import { fetchMavenVersions, latestYarnForMinecraft } from "../utils/maven.js";
import { stableMinecraftVersion, uniqueSorted } from "../utils/versions.js";
import { readZipText, unzip } from "../utils/zip.js";
import { QUILT_MAPPINGS_METADATA, QUILT_MAVEN } from "./constants.js";

export async function getQuiltMappingsVersionList(): Promise<VersionList> {
  const versions = await fetchMavenVersions(QUILT_MAPPINGS_METADATA);
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
    namespace: "quilt-mappings",
    stable: uniqueSorted(Object.keys(aliases).filter(stableMinecraftVersion)),
    snapshots: uniqueSorted(Object.keys(aliases).filter((version) => !stableMinecraftVersion(version))),
    aliases,
    source: QUILT_MAPPINGS_METADATA,
  };
}

export async function loadQuiltMappings(version: string): Promise<MappingRecord[]> {
  const artifactVersion = await resolveQuiltMappingsVersion(version);
  const url = quiltArtifactUrl(artifactVersion);
  const entries = unzip(await fetchBufferCached(url, { ttlMs: 30 * 24 * 60 * 60 * 1000 }));
  return parseTinyV2(readZipText(entries, "mappings/mappings.tiny"), version, url);
}

async function resolveQuiltMappingsVersion(version: string): Promise<string> {
  const versions = await fetchMavenVersions(QUILT_MAPPINGS_METADATA);
  if (versions.includes(version)) {
    return version;
  }
  const resolved = latestYarnForMinecraft(versions, version);
  if (!resolved) {
    throw new Error(`Quilt mappings are not available for ${version}`);
  }
  return resolved;
}

function quiltArtifactUrl(version: string): string {
  return `${QUILT_MAVEN}/org/quiltmc/quilt-mappings/${version}/quilt-mappings-${version}-intermediary-v2.jar`;
}
