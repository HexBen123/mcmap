import type {
  EcosystemRecommendation,
  EcosystemRecommendationKind,
  EcosystemRecommendationResult,
  LoaderVersionResult,
} from "../types.js";
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
const ARCHITECTURY_MAVEN = "https://maven.architectury.dev";
const SHEDANIEL_MAVEN = "https://maven.shedaniel.me";
const TERRAFORMERS_MAVEN = "https://maven.terraformersmc.com/releases";
const BLAZE_MAVEN = "https://maven.blamejared.com";
const MODRINTH_API = "https://api.modrinth.com/v2";
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

interface ModrinthVersion {
  version_number: string;
  date_published: string;
  game_versions: string[];
  loaders: string[];
}

interface ModrinthBackedRecommendationDefinition {
  id: string;
  name: string;
  modrinthProject: string;
  groupId: string;
  artifactId: string;
  kind: EcosystemRecommendationKind;
  mavenBaseUrl: string;
  source: string;
  repositories: string[];
}

const FABRIC_ECOSYSTEM: ModrinthBackedRecommendationDefinition[] = [
  {
    id: "architectury-api",
    name: "Architectury API",
    modrinthProject: "architectury-api",
    groupId: "dev.architectury",
    artifactId: "architectury-fabric",
    kind: "api",
    mavenBaseUrl: ARCHITECTURY_MAVEN,
    source: `${MODRINTH_API}/project/architectury-api/version and ${ARCHITECTURY_MAVEN}`,
    repositories: [ARCHITECTURY_MAVEN, SHEDANIEL_MAVEN],
  },
  {
    id: "cloth-config",
    name: "Cloth Config",
    modrinthProject: "cloth-config",
    groupId: "me.shedaniel.cloth",
    artifactId: "cloth-config-fabric",
    kind: "ui",
    mavenBaseUrl: SHEDANIEL_MAVEN,
    source: `${MODRINTH_API}/project/cloth-config/version and ${SHEDANIEL_MAVEN}`,
    repositories: [SHEDANIEL_MAVEN],
  },
  {
    id: "modmenu",
    name: "Mod Menu",
    modrinthProject: "modmenu",
    groupId: "com.terraformersmc",
    artifactId: "modmenu",
    kind: "ui",
    mavenBaseUrl: TERRAFORMERS_MAVEN,
    source: `${MODRINTH_API}/project/modmenu/version and ${TERRAFORMERS_MAVEN}`,
    repositories: [TERRAFORMERS_MAVEN],
  },
  {
    id: "rei",
    name: "Roughly Enough Items",
    modrinthProject: "rei",
    groupId: "me.shedaniel",
    artifactId: "RoughlyEnoughItems-fabric",
    kind: "utility",
    mavenBaseUrl: SHEDANIEL_MAVEN,
    source: `${MODRINTH_API}/project/rei/version and ${SHEDANIEL_MAVEN}`,
    repositories: [SHEDANIEL_MAVEN],
  },
];

const FORGE_ECOSYSTEM: ModrinthBackedRecommendationDefinition[] = [
  {
    id: "cloth-config",
    name: "Cloth Config",
    modrinthProject: "cloth-config",
    groupId: "me.shedaniel.cloth",
    artifactId: "cloth-config-forge",
    kind: "ui",
    mavenBaseUrl: SHEDANIEL_MAVEN,
    source: `${MODRINTH_API}/project/cloth-config/version and ${SHEDANIEL_MAVEN}`,
    repositories: [SHEDANIEL_MAVEN],
  },
];

const NEOFORGE_ECOSYSTEM: ModrinthBackedRecommendationDefinition[] = [
  {
    id: "architectury-api",
    name: "Architectury API",
    modrinthProject: "architectury-api",
    groupId: "dev.architectury",
    artifactId: "architectury-neoforge",
    kind: "api",
    mavenBaseUrl: ARCHITECTURY_MAVEN,
    source: `${MODRINTH_API}/project/architectury-api/version and ${ARCHITECTURY_MAVEN}`,
    repositories: [ARCHITECTURY_MAVEN, SHEDANIEL_MAVEN],
  },
  {
    id: "cloth-config",
    name: "Cloth Config",
    modrinthProject: "cloth-config",
    groupId: "me.shedaniel.cloth",
    artifactId: "cloth-config-neoforge",
    kind: "ui",
    mavenBaseUrl: SHEDANIEL_MAVEN,
    source: `${MODRINTH_API}/project/cloth-config/version and ${SHEDANIEL_MAVEN}`,
    repositories: [SHEDANIEL_MAVEN],
  },
  {
    id: "rei",
    name: "Roughly Enough Items",
    modrinthProject: "rei",
    groupId: "me.shedaniel",
    artifactId: "RoughlyEnoughItems-neoforge",
    kind: "utility",
    mavenBaseUrl: SHEDANIEL_MAVEN,
    source: `${MODRINTH_API}/project/rei/version and ${SHEDANIEL_MAVEN}`,
    repositories: [SHEDANIEL_MAVEN],
  },
];

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

export async function getEcosystemRecommendations(
  loader: "fabric" | "forge" | "neoforge" | "legacy-fabric",
  minecraft: string,
): Promise<EcosystemRecommendationResult> {
  const recommendations = await buildEcosystemRecommendations(loader, minecraft);
  return {
    loader,
    minecraft,
    recommendations,
  };
}

async function buildEcosystemRecommendations(
  loader: "fabric" | "forge" | "neoforge" | "legacy-fabric",
  minecraft: string,
): Promise<EcosystemRecommendation[]> {
  if (loader === "fabric") {
    return resolveModrinthBackedRecommendations(FABRIC_ECOSYSTEM, minecraft, "fabric");
  }
  if (loader === "forge") {
    const recommendations = await resolveModrinthBackedRecommendations(
      FORGE_ECOSYSTEM,
      minecraft,
      "forge",
    );
    const jei = await resolveJeiRecommendation(minecraft, "forge");
    return jei ? [...recommendations, jei] : recommendations;
  }
  if (loader === "neoforge") {
    const recommendations = await resolveModrinthBackedRecommendations(
      NEOFORGE_ECOSYSTEM,
      minecraft,
      "neoforge",
    );
    const jei = await resolveJeiRecommendation(minecraft, "neoforge");
    return jei ? [...recommendations, jei] : recommendations;
  }
  return [
    makeUnversionedRecommendation({
      id: "legacy-fabric-api",
      name: "Legacy Fabric API",
      groupId: "net.legacyfabric.legacy-fabric-api",
      artifactId: "legacy-fabric-api",
      kind: "api",
      source: LEGACY_FABRIC_API_METADATA,
      repositories: ["https://maven.legacyfabric.net"],
      reason: "Legacy Fabric API versions are exposed by get_loader_versions; no extra optional ecosystem coordinate is inferred.",
    }),
  ];
}

async function resolveModrinthBackedRecommendations(
  definitions: ModrinthBackedRecommendationDefinition[],
  minecraft: string,
  loader: "fabric" | "forge" | "neoforge",
): Promise<EcosystemRecommendation[]> {
  return Promise.all(
    definitions.map(async (definition) => {
      try {
        const modrinthVersion = await latestModrinthVersion(
          definition.modrinthProject,
          minecraft,
          loader,
        );
        if (!modrinthVersion) {
          return makeUnversionedRecommendation({
            ...definition,
            reason: `No Modrinth version matched Minecraft ${minecraft} with loader ${loader}.`,
          });
        }

        const candidateVersions = modrinthVersionCandidates(modrinthVersion.version_number);
        const mavenVersions = await fetchMavenVersions(metadataUrl(
          definition.mavenBaseUrl,
          definition.groupId,
          definition.artifactId,
        ));
        const verifiedVersion = candidateVersions.find((candidate) => mavenVersions.includes(candidate));
        if (!verifiedVersion) {
          return makeUnversionedRecommendation({
            ...definition,
            reason: `Modrinth returned ${modrinthVersion.version_number}, but that version was not found in Maven metadata.`,
          });
        }

        return makeVersionedRecommendation({
          ...definition,
          version: verifiedVersion,
          versionSource: `${MODRINTH_API}/project/${definition.modrinthProject}/version`,
        });
      } catch (error) {
        return makeUnversionedRecommendation({
          ...definition,
          reason: `Version lookup failed: ${errorMessage(error)}`,
        });
      }
    }),
  );
}

async function resolveJeiRecommendation(
  minecraft: string,
  loader: "forge" | "neoforge",
): Promise<EcosystemRecommendation | undefined> {
  const artifactId = jeiArtifactId(minecraft, loader);
  const definition = {
    id: "jei",
    name: "Just Enough Items",
    groupId: "mezz.jei",
    artifactId,
    kind: "utility" as const,
    source: `${BLAZE_MAVEN}/mezz/jei/${artifactId}/maven-metadata.xml`,
    repositories: [BLAZE_MAVEN, "https://modmaven.dev", "https://dvs1.progwml6.com/files/maven"],
  };

  try {
    const versions = await fetchMavenVersions(metadataUrl(BLAZE_MAVEN, definition.groupId, artifactId));
    const version = versions.sort(compareLooseVersions).at(-1);
    if (!version) {
      return makeUnversionedRecommendation({
        ...definition,
        reason: `No JEI Maven versions were found for Minecraft ${minecraft} and loader ${loader}.`,
      });
    }
    return makeVersionedRecommendation({
      ...definition,
      version,
      versionSource: definition.source,
    });
  } catch (error) {
    return makeUnversionedRecommendation({
      ...definition,
      reason: `JEI metadata lookup failed: ${errorMessage(error)}`,
    });
  }
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

function makeVersionedRecommendation(input: {
  id: string;
  name: string;
  groupId: string;
  artifactId: string;
  kind: EcosystemRecommendationKind;
  source: string;
  repositories: string[];
  version: string;
  versionSource: string;
}): EcosystemRecommendation {
  return {
    id: input.id,
    name: input.name,
    artifact: `${input.groupId}:${input.artifactId}`,
    kind: input.kind,
    source: input.source,
    repositories: input.repositories,
    versioned: true,
    confidence: "verified",
    version: input.version,
    coordinate: `${input.groupId}:${input.artifactId}:${input.version}`,
    versionSource: input.versionSource,
  };
}

function makeUnversionedRecommendation(input: {
  id: string;
  name: string;
  groupId: string;
  artifactId: string;
  kind: EcosystemRecommendationKind;
  source: string;
  repositories: string[];
  reason: string;
}): EcosystemRecommendation {
  return {
    id: input.id,
    name: input.name,
    artifact: `${input.groupId}:${input.artifactId}`,
    kind: input.kind,
    source: input.source,
    repositories: input.repositories,
    versioned: false,
    confidence: "unversioned",
    reason: input.reason,
  };
}

async function latestModrinthVersion(
  project: string,
  minecraft: string,
  loader: "fabric" | "forge" | "neoforge",
): Promise<ModrinthVersion | undefined> {
  const url =
    `${MODRINTH_API}/project/${encodeURIComponent(project)}/version` +
    `?game_versions=${encodeURIComponent(JSON.stringify([minecraft]))}` +
    `&loaders=${encodeURIComponent(JSON.stringify([loader]))}`;
  const versions = JSON.parse(
    await fetchTextCached(url, { ttlMs: 60 * 60 * 1000 }),
  ) as ModrinthVersion[];
  return versions
    .filter((version) => version.game_versions.includes(minecraft))
    .filter((version) => version.loaders.includes(loader))
    .sort((a, b) => a.date_published.localeCompare(b.date_published))
    .at(-1);
}

function modrinthVersionCandidates(version: string): string[] {
  const withoutLoaderSuffix = version.replace(/\+(fabric|forge|neoforge|quilt)$/i, "");
  return [...new Set([version, withoutLoaderSuffix])];
}

function metadataUrl(baseUrl: string, groupId: string, artifactId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${groupId.replaceAll(".", "/")}/${artifactId}/maven-metadata.xml`;
}

function jeiArtifactId(minecraft: string, loader: "forge" | "neoforge"): string {
  if (compareLooseVersions(minecraft, "1.13") < 0) {
    return `jei_${minecraft}`;
  }
  return `jei-${minecraft}-${loader}-api`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
