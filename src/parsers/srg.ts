import type { MappingRecord } from "../types.js";

export function parseSrg(content: string, version: string, source: string): MappingRecord[] {
  const records: MappingRecord[] = [];

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const parts = line.trim().split(/\s+/);
    const type = parts[0];

    if (type === "CL:" && parts.length >= 3) {
      records.push({
        kind: "class",
        version,
        source,
        names: {
          obfuscated: parts[1],
          srg: parts[2],
        },
      });
    } else if (type === "FD:" && parts.length >= 3) {
      records.push({
        kind: "field",
        version,
        source,
        owner: ownerOf(parts[2]),
        names: {
          obfuscated: leafOf(parts[1]),
          srg: leafOf(parts[2]),
        },
      });
    } else if (type === "MD:" && parts.length >= 5) {
      records.push({
        kind: "method",
        version,
        source,
        owner: ownerOf(parts[3]),
        descriptor: parts[4],
        names: {
          obfuscated: leafOf(parts[1]),
          srg: leafOf(parts[3]),
        },
      });
    }
  }

  return records;
}

export function parseCsrg(content: string, version: string, source: string): MappingRecord[] {
  const records: MappingRecord[] = [];

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) {
      continue;
    }
    const parts = line.trim().split(/\s+/);
    if (parts.length === 2) {
      records.push({
        kind: "class",
        version,
        source,
        names: {
          obfuscated: parts[0],
          srg: parts[1],
        },
      });
    } else if (parts.length === 3) {
      records.push({
        kind: "field",
        version,
        source,
        owner: parts[0],
        names: {
          obfuscated: parts[1],
          srg: parts[2],
        },
      });
    } else if (parts.length >= 4) {
      records.push({
        kind: "method",
        version,
        source,
        owner: parts[0],
        descriptor: parts[2],
        names: {
          obfuscated: parts[1],
          srg: parts[3],
        },
      });
    }
  }

  return records;
}

function leafOf(name: string | undefined): string | undefined {
  return name?.split("/").at(-1);
}

function ownerOf(name: string | undefined): string | undefined {
  const parts = name?.split("/");
  if (!parts || parts.length < 2) {
    return undefined;
  }
  return parts.slice(0, -1).join("/");
}
