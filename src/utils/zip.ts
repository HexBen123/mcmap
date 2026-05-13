import { unzipSync } from "fflate";

export interface ZipEntries {
  [path: string]: Uint8Array;
}

export function unzip(buffer: Buffer): ZipEntries {
  return unzipSync(new Uint8Array(buffer));
}

export function readZipText(entries: ZipEntries, entryName: string): string {
  const entry = entries[entryName];
  if (!entry) {
    throw new Error(`Missing zip entry: ${entryName}`);
  }
  return Buffer.from(entry).toString("utf8");
}

export function findZipEntry(entries: ZipEntries, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (entries[candidate]) {
      return candidate;
    }
  }
  return undefined;
}

export function listZipEntries(entries: ZipEntries): string[] {
  return Object.keys(entries).sort();
}
