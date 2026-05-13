export function stableMinecraftVersion(version: string): boolean {
  return /^\d+(?:\.\d+)*$/.test(version);
}

export function normalizeMinecraftVersion(version: string): string {
  return version.trim();
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compareLooseVersions).reverse();
}

export function compareLooseVersions(a: string, b: string): number {
  const aa = tokenize(a);
  const bb = tokenize(b);
  const max = Math.max(aa.length, bb.length);
  for (let index = 0; index < max; index += 1) {
    const av = aa[index] ?? "";
    const bv = bb[index] ?? "";
    if (av === bv) {
      continue;
    }
    const an = Number(av);
    const bn = Number(bv);
    if (Number.isFinite(an) && Number.isFinite(bn)) {
      return an - bn;
    }
    return av.localeCompare(bv);
  }
  return 0;
}

function tokenize(version: string): string[] {
  return version
    .split(/([0-9]+)/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}
