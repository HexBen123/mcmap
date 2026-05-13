import type { MappingRecord, VersionList } from "../types.js";
import { parseMcpCsvBundle } from "../parsers/mcpCsv.js";
import { parseCsrg, parseSrg } from "../parsers/srg.js";
import { parseTsrg } from "../parsers/tsrg.js";
import { fetchBufferCached, fetchTextCached } from "../utils/cache.js";
import { fetchMavenVersions, latestByPrefix, mavenArtifactUrl } from "../utils/maven.js";
import { stableMinecraftVersion, uniqueSorted } from "../utils/versions.js";
import { findZipEntry, readZipText, unzip } from "../utils/zip.js";
import {
  FORGE_MAVEN,
  MCP_ARTIFACT_METADATA,
  MCP_CONFIG_METADATA,
  MCP_SNAPSHOT_METADATA,
  MCP_STABLE_METADATA,
} from "./constants.js";

interface McpVersionsJson {
  [minecraftVersion: string]: {
    stable?: number[];
    snapshot?: number[];
  };
}

const MCP_VERSIONS_JSON = `${FORGE_MAVEN}/de/oceanlabs/mcp/versions.json`;

export async function getMcpVersionList(): Promise<VersionList> {
  const [versionsJson, configVersions, artifactVersions] = await Promise.all([
    fetchMcpVersionsJson().catch(() => ({} as McpVersionsJson)),
    fetchMavenVersions(MCP_CONFIG_METADATA).catch(() => []),
    fetchMavenVersions(MCP_ARTIFACT_METADATA).catch(() => []),
  ]);
  const versionSet = new Set<string>();

  for (const key of Object.keys(versionsJson)) {
    versionSet.add(key);
  }
  for (const version of configVersions) {
    versionSet.add(version.split("-20")[0] ?? version);
  }
  for (const version of artifactVersions) {
    versionSet.add(version);
  }

  const versions = [...versionSet];
  return {
    namespace: "mcp",
    stable: uniqueSorted(versions.filter(stableMinecraftVersion)),
    snapshots: uniqueSorted(versions.filter((version) => !stableMinecraftVersion(version))),
    source: `${MCP_VERSIONS_JSON}, ${MCP_CONFIG_METADATA}, ${MCP_ARTIFACT_METADATA}`,
  };
}

export async function loadMcp(version: string): Promise<MappingRecord[]> {
  const structuralRecords: MappingRecord[] = [];

  structuralRecords.push(...(await tryLoadMcpConfig(version)));
  structuralRecords.push(...(await tryLoadHistoricalSrg(version)));
  const csvRecords = await tryLoadMcpCsv(version);
  const records = mergeMcpNames(structuralRecords, csvRecords);

  if (records.length === 0) {
    throw new Error(`No MCP/SRG mappings found for ${version}`);
  }

  return records;
}

async function fetchMcpVersionsJson(): Promise<McpVersionsJson> {
  return JSON.parse(await fetchTextCached(MCP_VERSIONS_JSON, { ttlMs: 60 * 60 * 1000 })) as McpVersionsJson;
}

async function tryLoadMcpConfig(version: string): Promise<MappingRecord[]> {
  try {
    const versions = await fetchMavenVersions(MCP_CONFIG_METADATA);
    const artifactVersion = latestByPrefix(versions, version);
    if (!artifactVersion) {
      return [];
    }
    const url = mavenArtifactUrl(FORGE_MAVEN, "de.oceanlabs.mcp", "mcp_config", artifactVersion, "zip");
    const entries = unzip(await fetchBufferCached(url, { ttlMs: 30 * 24 * 60 * 60 * 1000 }));
    const entry = findZipEntry(entries, [
      "config/joined.tsrg",
      "joined.tsrg",
      "config/joined.srg",
      "joined.srg",
    ]);
    if (!entry) {
      return [];
    }
    return parseTsrg(readZipText(entries, entry), version, url);
  } catch {
    return [];
  }
}

async function tryLoadHistoricalSrg(version: string): Promise<MappingRecord[]> {
  const records: MappingRecord[] = [];
  for (const classifier of ["srg", "csrg"]) {
    try {
      const url = mavenArtifactUrl(
        FORGE_MAVEN,
        "de.oceanlabs.mcp",
        "mcp",
        version,
        "zip",
        classifier,
      );
      const entries = unzip(await fetchBufferCached(url, { ttlMs: 30 * 24 * 60 * 60 * 1000 }));
      const entry = findZipEntry(entries, [
        "joined.srg",
        "joined.csrg",
        "conf/joined.srg",
        "conf/joined.csrg",
        "mcp.srg",
        "mcp.csrg",
      ]) ?? Object.keys(entries).find((name) => name.endsWith(`.${classifier}`));
      if (!entry) {
        continue;
      }
      const content = readZipText(entries, entry);
      records.push(...(classifier === "csrg" ? parseCsrg(content, version, url) : parseSrg(content, version, url)));
    } catch {
      // Some versions have only one classifier or no historical artifact.
    }
  }
  return records;
}

async function tryLoadMcpCsv(version: string): Promise<MappingRecord[]> {
  try {
    const versionsJson = await fetchMcpVersionsJson();
    const csvVersion = resolveMcpCsvVersion(versionsJson, version);
    if (!csvVersion) {
      return [];
    }
    const entry = versionsJson[csvVersion];
    const stable = entry?.stable?.at(-1);
    const snapshot = entry?.snapshot?.at(0);
    const artifact =
      stable !== undefined
        ? { artifactId: "mcp_stable", version: `${stable}-${csvVersion}` }
        : snapshot !== undefined
          ? { artifactId: "mcp_snapshot", version: `${snapshot}-${csvVersion}` }
          : undefined;
    if (!artifact) {
      return [];
    }

    const url = mavenArtifactUrl(
      FORGE_MAVEN,
      "de.oceanlabs.mcp",
      artifact.artifactId,
      artifact.version,
      "zip",
    );
    const entries = unzip(await fetchBufferCached(url, { ttlMs: 30 * 24 * 60 * 60 * 1000 }));
    return parseMcpCsvBundle(
      {
        fieldsCsv: entries["fields.csv"] ? readZipText(entries, "fields.csv") : undefined,
        methodsCsv: entries["methods.csv"] ? readZipText(entries, "methods.csv") : undefined,
        paramsCsv: entries["params.csv"] ? readZipText(entries, "params.csv") : undefined,
      },
      version,
      url,
    );
  } catch {
    return [];
  }
}

function resolveMcpCsvVersion(versionsJson: McpVersionsJson, version: string): string | undefined {
  if (versionsJson[version]) {
    return version;
  }
  const parts = version.split(".");
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join(".");
    if (versionsJson[candidate]) {
      return candidate;
    }
  }
  return undefined;
}

function mergeMcpNames(
  structuralRecords: MappingRecord[],
  csvRecords: MappingRecord[],
): MappingRecord[] {
  if (structuralRecords.length === 0) {
    return csvRecords;
  }

  const csvByKey = new Map<string, MappingRecord>();
  for (const csvRecord of csvRecords) {
    const srg = csvRecord.names.srg;
    if (srg) {
      csvByKey.set(`${csvRecord.kind}:${srg}`, csvRecord);
    }
  }

  const merged: MappingRecord[] = [];
  const usedCsv = new Set<MappingRecord>();
  for (const record of structuralRecords) {
    const srg = record.names.srg;
    const csvRecord = srg ? csvByKey.get(`${record.kind}:${srg}`) : undefined;
    if (!csvRecord) {
      merged.push(record);
      continue;
    }
    usedCsv.add(csvRecord);
    merged.push({
      ...record,
      names: {
        ...record.names,
        mcp: csvRecord.names.mcp,
      },
      comment: record.comment ?? csvRecord.comment,
      side: record.side ?? csvRecord.side,
    });
  }

  for (const csvRecord of csvRecords) {
    if (!usedCsv.has(csvRecord)) {
      merged.push(csvRecord);
    }
  }

  return merged;
}
