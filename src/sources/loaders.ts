import type { EcosystemRecommendationResult, LoaderVersionResult } from "../types.js";
import { fetchTextCached } from "../utils/cache.js";
import { fetchMavenVersions, latestYarnForMinecraft } from "../utils/maven.js";
import { compareLooseVersions, stableMinecraftVersion } from "../utils/versions.js";
import {
  FABRIC_API_METADATA,
  FORGE_METADATA,
  MOJANG_VERSION_MANIFEST,
  NEOFORGE_METADATA,
  YARN_METADATA,
} from "./constants.js";

const FABRIC_META = "https://meta.fabricmc.net/v2";
const LEGACY_FABRIC_META = "https://meta.legacyfabric.net/v2";
const LEGACY_FABRIC_API_METADATA =
  "https://maven.legacyfabric.net/net/legacyfabric/legacy-fabric-api/legacy-fabric-api/maven-metadata.xml";
const LEGACY_YARN_METADATA = "https://maven.legacyfabric.net/net/legacyfabric/yarn/maven-metadata.xml";

interface FabricGameVersion {
  version: string;
  stable: boolean;
}

interface FabricLoaderVersion {
  version: string;
  stable: boolean;
  maven: string;
}

interface FabricLoaderForGame {
  loader: FabricLoaderVersion;
  intermediary: {
    version: string;
    maven: string;
    stable: boolean;
  };
}

interface MojangVersionManifest {
  versions: Array<{
    id: string;
    type: string;
  }>;
}

interface ParsedMavenLoaderVersion {
  minecraft: string;
  version: string;
}

export async function getLoaderVersions(
  loader: "fabric" | "forge" | "neoforge" | "legacy-fabric",
  stableOnly: boolean,
  limit: number,
): Promise<LoaderVersionResult> {
  if (loader === "fabric") {
    return getFabricLoaderVersions(stableOnly, limit);
  }
  if (loader === "forge") {
    return getForgeVersions(stableOnly, limit);
  }
  if (loader === "neoforge") {
    return getNeoForgeVersions(stableOnly, limit);
  }
  return getLegacyFabricLoaderVersions(stableOnly, limit);
}

export function getEcosystemRecommendations(
  loader: "fabric" | "forge" | "neoforge" | "legacy-fabric",
  minecraft: string,
): EcosystemRecommendationResult {
  const recommendations: EcosystemRecommendationResult["recommendations"] = [];

  if (loader === "fabric") {
    recommendations.push(
      {
        id: "architectury-api",
        artifact: "dev.architectury:architectury-fabric",
        kind: "api",
        source: "https://maven.architectury.dev/",
        versioned: false,
      },
      {
        id: "cloth-config",
        artifact: "me.shedaniel.cloth:cloth-config-fabric",
        kind: "ui",
        source: "https://maven.shedaniel.me/",
        versioned: false,
      },
      {
        id: "modmenu",
        artifact: "com.terraformersmc:modmenu",
        kind: "ui",
        source: "https://maven.terraformersmc.com/releases/",
        versioned: false,
      },
    );
  } else if (loader === "forge") {
    recommendations.push({
      id: "cloth-config",
      artifact: "me.shedaniel.cloth:cloth-config-forge",
      kind: "ui",
      source: "https://maven.shedaniel.me/",
      versioned: false,
    });
  } else if (loader === "neoforge") {
    recommendations.push(
      {
        id: "architectury-api",
        artifact: "dev.architectury:architectury-neoforge",
        kind: "api",
        source: "https://maven.architectury.dev/",
        versioned: false,
      },
      {
        id: "cloth-config",
        artifact: "me.shedaniel.cloth:cloth-config-neoforge",
        kind: "ui",
        source: "https://maven.shedaniel.me/",
        versioned: false,
      },
    );
  }

  return {
    loader,
    minecraft,
    recommendations,
  };
}

async function getFabricLoaderVersions(stableOnly: boolean, limit: number): Promise<LoaderVersionResult> {
  const [games, fabricApiVersions, yarnVersions] = await Promise.all([
    fetchFabricGames(FABRIC_META),
    fetchMavenVersions(FABRIC_API_METADATA).catch(() => []),
    fetchMavenVersions(YARN_METADATA).catch(() => []),
  ]);
  const selectedGames = games.filter((game) => !stableOnly || game.stable).slice(0, limit);
  const versions = [];

  for (const game of selectedGames) {
    const loaderEntries = await fetchFabricLoaderEntries(FABRIC_META, game.version);
    const loaderEntry = loaderEntries.find((entry) => !stableOnly || entry.loader.stable) ?? loaderEntries[0];
    versions.push({
      minecraft: game.version,
      stable: game.stable,
      yarn: latestYarnCoordinate(yarnVersions, game.version, "net.fabricmc"),
      loader: loaderEntry?.loader.maven,
      intermediary: loaderEntry?.intermediary.maven,
      fabricApi: latestPlusVersionCoordinate(
        fabricApiVersions,
        game.version,
        "net.fabricmc.fabric-api:fabric-api",
      ),
    });
  }

  return {
    loader: "fabric",
    versions,
    source: "https://meta.fabricmc.net/v2 and Fabric Maven metadata",
  };
}

async function getForgeVersions(stableOnly: boolean, limit: number): Promise<LoaderVersionResult> {
  const parsed = (await fetchMavenVersions(FORGE_METADATA))
    .map(parseForgeVersion)
    .filter((version): version is ParsedMavenLoaderVersion => version !== undefined)
    .filter((version) => !stableOnly || stableMinecraftVersion(version.minecraft));
  const filtered = latestPerMinecraft(parsed, limit).map((version) => ({
    minecraft: version.minecraft,
    forge: `net.minecraftforge:forge:${version.version}`,
    version: version.version,
  }));
  return {
    loader: "forge",
    versions: filtered,
    source: FORGE_METADATA,
  };
}

async function getNeoForgeVersions(stableOnly: boolean, limit: number): Promise<LoaderVersionResult> {
  const [versions, releaseVersions] = await Promise.all([
    fetchMavenVersions(NEOFORGE_METADATA),
    fetchMojangReleaseVersions().catch(() => []),
  ]);
  const parsed = versions
    .map((version) => parseNeoForgeVersion(version, releaseVersions))
    .filter((version): version is ParsedMavenLoaderVersion => version !== undefined)
    .filter((version) => !stableOnly || stableMinecraftVersion(version.minecraft))
    .filter((version) => !stableOnly || !/alpha|snapshot/i.test(version.version));
  const filtered = latestPerMinecraft(parsed, limit).map((version) => ({
    minecraft: version.minecraft,
    neoforge: `net.neoforged:neoforge:${version.version}`,
    version: version.version,
  }));
  return {
    loader: "neoforge",
    versions: filtered,
    source: NEOFORGE_METADATA,
  };
}

async function getLegacyFabricLoaderVersions(stableOnly: boolean, limit: number): Promise<LoaderVersionResult> {
  const [games, legacyApiVersions, legacyYarnVersions] = await Promise.all([
    fetchFabricGames(LEGACY_FABRIC_META),
    fetchMavenVersions(LEGACY_FABRIC_API_METADATA).catch(() => []),
    fetchMavenVersions(LEGACY_YARN_METADATA).catch(() => []),
  ]);
  const selectedGames = games.filter((game) => !stableOnly || game.stable).slice(0, limit);
  const versions = [];

  for (const game of selectedGames) {
    const loaderEntries = await fetchFabricLoaderEntries(LEGACY_FABRIC_META, game.version);
    const loaderEntry = loaderEntries.find((entry) => !stableOnly || entry.loader.stable) ?? loaderEntries[0];
    versions.push({
      minecraft: game.version,
      stable: game.stable,
      yarn: latestYarnCoordinate(legacyYarnVersions, game.version, "net.legacyfabric", ":v2"),
      loader: loaderEntry?.loader.maven,
      intermediary: loaderEntry?.intermediary.maven,
      legacyFabricApi: latestPlusVersionCoordinate(
        legacyApiVersions,
        game.version,
        "net.legacyfabric.legacy-fabric-api:legacy-fabric-api",
      ),
    });
  }

  return {
    loader: "legacy-fabric",
    versions,
    source: `${LEGACY_FABRIC_META} and Legacy Fabric Maven metadata`,
  };
}

async function fetchFabricGames(metaBaseUrl: string): Promise<FabricGameVersion[]> {
  return JSON.parse(
    await fetchTextCached(`${metaBaseUrl}/versions/game`, { ttlMs: 60 * 60 * 1000 }),
  ) as FabricGameVersion[];
}

async function fetchFabricLoaderEntries(metaBaseUrl: string, minecraftVersion: string): Promise<FabricLoaderForGame[]> {
  return JSON.parse(
    await fetchTextCached(`${metaBaseUrl}/versions/loader/${encodeURIComponent(minecraftVersion)}`, {
      ttlMs: 60 * 60 * 1000,
    }),
  ) as FabricLoaderForGame[];
}

function parseForgeVersion(version: string): ParsedMavenLoaderVersion | undefined {
  const separator = version.indexOf("-");
  if (separator <= 0) {
    return undefined;
  }
  const minecraft = version.slice(0, separator);
  if (!minecraft) {
    return undefined;
  }
  return { minecraft, version };
}

function parseNeoForgeVersion(
  version: string,
  mojangReleaseVersions: string[],
): ParsedMavenLoaderVersion | undefined {
  const minecraft = inferNeoForgeMinecraftVersion(version, mojangReleaseVersions);
  return minecraft ? { minecraft, version } : undefined;
}

function latestPerMinecraft(versions: ParsedMavenLoaderVersion[], limit: number): ParsedMavenLoaderVersion[] {
  const grouped = new Map<string, ParsedMavenLoaderVersion>();
  for (const version of versions) {
    const existing = grouped.get(version.minecraft);
    if (!existing || compareLooseVersions(existing.version, version.version) < 0) {
      grouped.set(version.minecraft, version);
    }
  }
  return [...grouped.values()]
    .sort((a, b) => compareLooseVersions(a.minecraft, b.minecraft))
    .reverse()
    .slice(0, limit);
}

function latestYarnCoordinate(
  versions: string[],
  minecraftVersion: string,
  groupId: "net.fabricmc" | "net.legacyfabric",
  suffix = "",
): string | undefined {
  const version = latestYarnForMinecraft(versions, minecraftVersion);
  return version ? `${groupId}:yarn:${version}${suffix}` : undefined;
}

function latestPlusVersionCoordinate(
  versions: string[],
  minecraftVersion: string,
  coordinatePrefix: string,
): string | undefined {
  const version = versions
    .filter((version) => version.endsWith(`+${minecraftVersion}`))
    .sort(compareLooseVersions)
    .at(-1);
  return version ? `${coordinatePrefix}:${version}` : undefined;
}

async function fetchMojangReleaseVersions(): Promise<string[]> {
  const manifest = JSON.parse(
    await fetchTextCached(MOJANG_VERSION_MANIFEST, { ttlMs: 60 * 60 * 1000 }),
  ) as MojangVersionManifest;
  return manifest.versions
    .filter((version) => version.type === "release")
    .map((version) => version.id)
    .sort(compareLooseVersions)
    .reverse();
}

function inferNeoForgeMinecraftVersion(version: string, mojangReleaseVersions: string[]): string | undefined {
  const cleanVersion = version.split(/[+-]/)[0] ?? version;
  const releasePrefix = mojangReleaseVersions.find(
    (release) => cleanVersion === release || cleanVersion.startsWith(`${release}.`),
  );
  if (releasePrefix) {
    return releasePrefix;
  }

  const parts = cleanVersion.split(".");
  const major = Number(parts[0]);
  if (!Number.isFinite(major)) {
    return undefined;
  }
  if (major >= 26) {
    const patch = parts[2] && parts[2] !== "0" ? `.${parts[2]}` : "";
    return parts[1] ? `${major}.${parts[1]}${patch}` : `${major}`;
  }
  if (major >= 20) {
    const patch = parts[1] && parts[1] !== "0" ? `.${parts[1]}` : "";
    return `1.${major}${patch}`;
  }
  return undefined;
}
