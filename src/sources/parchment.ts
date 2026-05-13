import type { VersionList } from "../types.js";
import { fetchMavenVersions } from "../utils/maven.js";
import { stableMinecraftVersion, uniqueSorted } from "../utils/versions.js";
import { PARCHMENT_MAVEN } from "./constants.js";

const COMMON_PARCHMENT_VERSIONS = [
  "1.16.5",
  "1.17.1",
  "1.18.2",
  "1.19.2",
  "1.19.3",
  "1.19.4",
  "1.20.1",
  "1.20.2",
  "1.20.4",
  "1.20.6",
  "1.21",
  "1.21.1",
  "1.21.4",
];

export async function getParchmentVersionList(): Promise<VersionList> {
  const aliases: Record<string, string[]> = {};
  await Promise.all(
    COMMON_PARCHMENT_VERSIONS.map(async (minecraftVersion) => {
      try {
        aliases[minecraftVersion] = await fetchParchmentMappingVersions(minecraftVersion);
      } catch {
        // Parchment is sparse by Minecraft version.
      }
    }),
  );
  const versions = Object.keys(aliases);
  return {
    namespace: "parchment",
    stable: uniqueSorted(versions.filter(stableMinecraftVersion)),
    snapshots: uniqueSorted(versions.filter((version) => !stableMinecraftVersion(version))),
    aliases,
    source: `${PARCHMENT_MAVEN}/org/parchmentmc/data/parchment-<mcVersion>/maven-metadata.xml`,
  };
}

export async function fetchParchmentMappingVersions(minecraftVersion: string): Promise<string[]> {
  return fetchMavenVersions(parchmentMetadataUrl(minecraftVersion));
}

function parchmentMetadataUrl(minecraftVersion: string): string {
  return `${PARCHMENT_MAVEN}/org/parchmentmc/data/parchment-${minecraftVersion}/maven-metadata.xml`;
}
