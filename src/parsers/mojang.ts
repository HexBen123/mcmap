import type { MappingRecord } from "../types.js";

export function parseMojangMappings(
  content: string,
  version: string,
  source: string,
): MappingRecord[] {
  const records: MappingRecord[] = [];
  let currentMojmap: string | undefined;
  let currentObfuscated: string | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith("#")) {
      continue;
    }

    if (!rawLine.startsWith(" ")) {
      const match = /^(.+?) -> (.+):$/.exec(rawLine);
      if (!match) {
        continue;
      }
      currentMojmap = match[1]?.replaceAll(".", "/");
      currentObfuscated = match[2];
      records.push({
        kind: "class",
        version,
        source,
        names: {
          mojmap: currentMojmap,
          official: currentMojmap,
          obfuscated: currentObfuscated,
        },
      });
      continue;
    }

    if (!currentMojmap) {
      continue;
    }

    const line = rawLine.trim();
    const methodMatch = /^(?:(\d+):(\d+):)?(.+?) (.+?)\((.*?)\) -> (.+)$/.exec(line);
    if (methodMatch) {
      const returnType = methodMatch[3] ?? "";
      const methodName = methodMatch[4] ?? "";
      const parameters = methodMatch[5] ?? "";
      const obfuscated = methodMatch[6] ?? "";
      records.push({
        kind: "method",
        version,
        source,
        owner: currentMojmap,
        descriptor: `${returnType} (${parameters})`,
        names: {
          mojmap: methodName,
          official: methodName,
          obfuscated,
        },
      });
      continue;
    }

    const fieldMatch = /^(.+?) (.+?) -> (.+)$/.exec(line);
    if (fieldMatch) {
      records.push({
        kind: "field",
        version,
        source,
        owner: currentMojmap,
        descriptor: fieldMatch[1],
        names: {
          mojmap: fieldMatch[2],
          official: fieldMatch[2],
          obfuscated: fieldMatch[3],
        },
      });
    }
  }

  return records;
}
