import type { MappingRecord } from "../types.js";

interface TsrgClassContext {
  obfuscated: string;
  srg: string;
}

export function parseTsrg(content: string, version: string, source: string): MappingRecord[] {
  const records: MappingRecord[] = [];
  const lines = content.split(/\r?\n/);
  let tsrg2 = false;
  let currentClass: TsrgClassContext | undefined;

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      continue;
    }

    if (rawLine.startsWith("tsrg2 ")) {
      tsrg2 = true;
      continue;
    }

    const depth = rawLine.startsWith("\t\t") ? 2 : rawLine.startsWith("\t") ? 1 : 0;
    const parts = rawLine.trim().split(/\s+/);

    if (depth === 0 && parts.length >= 2) {
      currentClass = {
        obfuscated: parts[0] ?? "",
        srg: parts[1] ?? "",
      };
      records.push({
        kind: "class",
        version,
        source,
        names: {
          obfuscated: currentClass.obfuscated,
          srg: currentClass.srg,
        },
      });
      continue;
    }

    if (!currentClass || depth !== 1) {
      continue;
    }

    if (parts.length >= 3 && looksLikeDescriptor(parts[1] ?? "")) {
      records.push({
        kind: "method",
        version,
        source,
        owner: currentClass.srg,
        descriptor: parts[1],
        names: {
          obfuscated: parts[0],
          srg: parts[2],
        },
      });
    } else if (parts.length >= 2 && !tsrg2) {
      records.push({
        kind: "field",
        version,
        source,
        owner: currentClass.srg,
        names: {
          obfuscated: parts[0],
          srg: parts[1],
        },
      });
    } else if (parts.length >= 2 && tsrg2) {
      records.push({
        kind: "field",
        version,
        source,
        owner: currentClass.srg,
        names: {
          obfuscated: parts[0],
          srg: parts[1],
        },
      });
    }
  }

  return records;
}

function looksLikeDescriptor(value: string): boolean {
  return value.startsWith("(");
}
