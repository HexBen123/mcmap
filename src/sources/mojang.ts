import type { MappingRecord, VersionList } from "../types.js";
import { loadIntermediary, loadYarn } from "./fabric.js";
import { fetchTextCached } from "../utils/cache.js";
import { stableMinecraftVersion, uniqueSorted } from "../utils/versions.js";
import { parseMojangMappings } from "../parsers/mojang.js";
import { MOJANG_VERSION_MANIFEST } from "./constants.js";

interface MojangManifest {
  versions: Array<{
    id: string;
    type: string;
    url: string;
  }>;
}

interface MojangVersionInfo {
  downloads?: {
    client_mappings?: { url: string };
    server_mappings?: { url: string };
  };
}

export async function getMojangVersionList(): Promise<VersionList> {
  const manifest = await fetchManifest();
  const versions = manifest.versions.map((version) => version.id);
  return {
    namespace: "mojmap",
    stable: uniqueSorted(versions.filter(stableMinecraftVersion)),
    snapshots: uniqueSorted(versions.filter((version) => !stableMinecraftVersion(version))),
    source: MOJANG_VERSION_MANIFEST,
  };
}

export async function loadMojmap(version: string): Promise<MappingRecord[]> {
  const manifest = await fetchManifest();
  const entry = manifest.versions.find((item) => item.id === version);
  if (!entry) {
    throw new Error(`Unknown Mojang version: ${version}`);
  }

  const versionInfo = JSON.parse(await fetchTextCached(entry.url, { ttlMs: 24 * 60 * 60 * 1000 })) as MojangVersionInfo;
  const mappingUrl = versionInfo.downloads?.client_mappings?.url ?? versionInfo.downloads?.server_mappings?.url;
  if (!mappingUrl) {
    throw new Error(`Mojang mappings are not available for ${version}`);
  }

  const content = await fetchTextCached(mappingUrl, { ttlMs: 30 * 24 * 60 * 60 * 1000 });
  const records = parseMojangMappings(content, version, mappingUrl);
  return enrichMojmapFromFabric(records, version);
}

async function fetchManifest(): Promise<MojangManifest> {
  return JSON.parse(
    await fetchTextCached(MOJANG_VERSION_MANIFEST, { ttlMs: 60 * 60 * 1000 }),
  ) as MojangManifest;
}

async function enrichMojmapFromFabric(records: MappingRecord[], version: string): Promise<MappingRecord[]> {
  const [intermediaryRecords, yarnRecords] = await Promise.all([
    loadIntermediary(version).catch(() => []),
    loadYarn(version).catch(() => []),
  ]);
  if (intermediaryRecords.length === 0 && yarnRecords.length === 0) {
    return records;
  }

  const bridgeByOfficial = new Map<string, Partial<MappingRecord["names"]>>();
  for (const record of [...intermediaryRecords, ...yarnRecords]) {
    if (record.kind !== "class") {
      continue;
    }
    const official = record.names.official ?? record.names.obfuscated;
    if (!official) {
      continue;
    }
    bridgeByOfficial.set(official, {
      ...bridgeByOfficial.get(official),
      ...definedNames({
        intermediary: record.names.intermediary,
        named: record.names.named,
        yarn: record.names.yarn,
      }),
    });
  }

  return records.map((record) => {
    if (record.kind !== "class") {
      return record;
    }
    const official = record.names.mojmap ?? record.names.official;
    const bridge = official ? bridgeByOfficial.get(official) : undefined;
    if (!bridge) {
      return record;
    }
    return {
      ...record,
      names: {
        ...record.names,
        ...bridge,
      },
    };
  });
}

function definedNames(names: Partial<MappingRecord["names"]>): Partial<MappingRecord["names"]> {
  return Object.fromEntries(
    Object.entries(names).filter(([, value]) => value !== undefined && value !== ""),
  ) as Partial<MappingRecord["names"]>;
}
