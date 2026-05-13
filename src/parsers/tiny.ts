import type { MappingRecord, Namespace } from "../types.js";

interface TinyClassContext {
  official?: string;
  intermediary?: string;
  named?: string;
  yarn?: string;
}

export function parseTinyV2(content: string, version: string, source: string): MappingRecord[] {
  const lines = content.split(/\r?\n/);
  const header = lines.shift();
  if (!header?.startsWith("tiny\t2\t")) {
    throw new Error("Unsupported Tiny mapping format");
  }

  const namespaces = header.split("\t").slice(3);
  const records: MappingRecord[] = [];
  let currentClass: TinyClassContext | undefined;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const depth = leadingTabs(line);
    const parts = line.trimStart().split("\t");
    const kind = parts[0];

    if (depth === 0 && kind === "c") {
      const names = mapNames(namespaces, parts.slice(1));
      currentClass = {
        official: names.official,
        intermediary: names.intermediary,
        named: names.named,
        yarn: names.yarn ?? names.named,
      };
      records.push({
        kind: "class",
        version,
        source,
        names: normalizeTinyNames(names),
      });
    } else if (depth === 1 && currentClass && kind === "m") {
      const descriptor = parts[1];
      const names = mapNames(namespaces, parts.slice(2));
      records.push({
        kind: "method",
        version,
        source,
        owner: bestOwner(currentClass),
        descriptor,
        names: normalizeTinyNames(names),
      });
    } else if (depth === 1 && currentClass && kind === "f") {
      const descriptor = parts[1];
      const names = mapNames(namespaces, parts.slice(2));
      records.push({
        kind: "field",
        version,
        source,
        owner: bestOwner(currentClass),
        descriptor,
        names: normalizeTinyNames(names),
      });
    } else if (depth === 2 && currentClass && kind === "p") {
      const names = mapNames(namespaces.slice(-1), parts.slice(2));
      if (Object.keys(names).length > 0) {
        records.push({
          kind: "param",
          version,
          source,
          owner: bestOwner(currentClass),
          names: normalizeTinyNames(names),
        });
      }
    }
  }

  return records;
}

function leadingTabs(line: string): number {
  let count = 0;
  while (line[count] === "\t") {
    count += 1;
  }
  return count;
}

function mapNames(namespaces: string[], values: string[]): Partial<Record<Namespace, string>> {
  const result: Partial<Record<Namespace, string>> = {};
  namespaces.forEach((namespace, index) => {
    const mapped = normalizeNamespace(namespace);
    const value = values[index];
    if (mapped && value) {
      result[mapped] = value;
    }
  });
  return result;
}

function normalizeNamespace(namespace: string): Namespace | undefined {
  if (namespace === "official") {
    return "official";
  }
  if (namespace === "intermediary") {
    return "intermediary";
  }
  if (namespace === "named") {
    return "named";
  }
  return undefined;
}

function normalizeTinyNames(
  names: Partial<Record<Namespace, string>>,
): Partial<Record<Namespace, string>> {
  const normalized = { ...names };
  if (normalized.named && !normalized.yarn) {
    normalized.yarn = normalized.named;
  }
  if (normalized.official && !normalized.obfuscated) {
    normalized.obfuscated = normalized.official;
  }
  return normalized;
}

function bestOwner(context: TinyClassContext): string | undefined {
  return context.yarn ?? context.named ?? context.intermediary ?? context.official;
}
