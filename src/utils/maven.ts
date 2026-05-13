import { XMLParser } from "fast-xml-parser";
import { fetchTextCached } from "./cache.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
});

export async function fetchMavenVersions(metadataUrl: string): Promise<string[]> {
  const xml = await fetchTextCached(metadataUrl, { ttlMs: 60 * 60 * 1000 });
  const parsed = parser.parse(xml) as {
    metadata?: {
      versioning?: {
        versions?: {
          version?: string[] | string;
        };
      };
    };
  };
  const versions = parsed.metadata?.versioning?.versions?.version ?? [];
  return Array.isArray(versions) ? versions : [versions];
}

export function mavenArtifactUrl(
  baseUrl: string,
  groupId: string,
  artifactId: string,
  version: string,
  extension: string,
  classifier?: string,
): string {
  const groupPath = groupId.replaceAll(".", "/");
  const suffix = classifier ? `-${classifier}` : "";
  return `${baseUrl.replace(/\/$/, "")}/${groupPath}/${artifactId}/${encodeURIComponent(version)}/${artifactId}-${encodeURIComponent(version)}${suffix}.${extension}`;
}

export function latestByPrefix(versions: string[], prefix: string): string | undefined {
  const exact = versions.filter((version) => version === prefix);
  if (exact.length > 0) {
    return exact.at(-1);
  }
  const prefixed = versions.filter((version) => version.startsWith(`${prefix}-`));
  return prefixed.at(-1);
}

export function latestYarnForMinecraft(versions: string[], minecraftVersion: string): string | undefined {
  const prefix = `${minecraftVersion}+build.`;
  const matches = versions.filter((version) => version.startsWith(prefix));
  return matches
    .sort((a, b) => {
      const aBuild = Number(a.slice(prefix.length));
      const bBuild = Number(b.slice(prefix.length));
      return aBuild - bBuild;
    })
    .at(-1);
}
