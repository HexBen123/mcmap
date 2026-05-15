import type { MappingRecord, VersionList } from "../types.js";
import { parseTinyV2 } from "../parsers/tiny.js";
import { fetchBufferCached } from "../utils/cache.js";
import { fetchMavenVersions, latestYarnForMinecraft, mavenArtifactUrl } from "../utils/maven.js";
import { stableMinecraftVersion, uniqueSorted } from "../utils/versions.js";
import { readZipText, unzip } from "../utils/zip.js";
import { LEGACY_FABRIC_MAVEN, LEGACY_YARN_METADATA } from "./constants.js";

export async function getLegacyYarnVersionList(): Promise<VersionList> {
  const versions = await fetchMavenVersions(LEGACY_YARN_METADATA);
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
    namespace: "legacy-yarn",
    stable: uniqueSorted(Object.keys(aliases).filter(stableMinecraftVersion)),
    snapshots: uniqueSorted(Object.keys(aliases).filter((version) => !stableMinecraftVersion(version))),
    aliases,
    source: LEGACY_YARN_METADATA,
  };
}

export async function loadLegacyYarn(version: string): Promise<MappingRecord[]> {
  const artifactVersion = await resolveLegacyYarnVersion(version);
  const url = mavenArtifactUrl(
    LEGACY_FABRIC_MAVEN,
    "net.legacyfabric",
    "yarn",
    artifactVersion,
    "jar",
    "v2",
  );
  const entries = unzip(await fetchBufferCached(url, { ttlMs: 30 * 24 * 60 * 60 * 1000 }));
  return parseTinyV2(readZipText(entries, "mappings/mappings.tiny"), version, url);
}

async function resolveLegacyYarnVersion(version: string): Promise<string> {
  const versions = await fetchMavenVersions(LEGACY_YARN_METADATA);
  if (versions.includes(version)) {
    return version;
  }
  const resolved = latestYarnForMinecraft(versions, version);
  if (!resolved) {
    throw new Error(`Legacy Yarn mappings are not available for ${version}`);
  }
  return resolved;
}
