import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function resolveCacheRoot(): string {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      return path.join(localAppData, "mcmap");
    }
    return path.join(os.homedir(), "AppData", "Local", "mcmap");
  }

  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  if (xdgCacheHome) {
    return path.join(xdgCacheHome, "mcmap");
  }

  return path.join(os.homedir(), ".cache", "mcmap");
}

const CACHE_ROOT = resolveCacheRoot();
const HTTP_CACHE_DIR = path.join(CACHE_ROOT, "http");

export interface FetchTextOptions {
  ttlMs?: number;
  headers?: Record<string, string>;
}

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function bodyPath(url: string): string {
  return path.join(HTTP_CACHE_DIR, `${hashUrl(url)}.body`);
}

function metaPath(url: string): string {
  return path.join(HTTP_CACHE_DIR, `${hashUrl(url)}.json`);
}

async function isFresh(file: string, ttlMs?: number): Promise<boolean> {
  if (!ttlMs) {
    return true;
  }
  try {
    const info = await stat(file);
    return Date.now() - info.mtimeMs < ttlMs;
  } catch {
    return false;
  }
}

export async function fetchBufferCached(
  url: string,
  options: FetchTextOptions = {},
): Promise<Buffer> {
  await mkdir(HTTP_CACHE_DIR, { recursive: true });

  const body = bodyPath(url);
  if (await isFresh(body, options.ttlMs)) {
    try {
      return await readFile(body);
    } catch {
      // Cache miss, fetch below.
    }
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "mcmap/1.0.0",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(body, buffer);
  await writeFile(
    metaPath(url),
    JSON.stringify(
      {
        url,
        fetchedAt: new Date().toISOString(),
        status: response.status,
        contentType: response.headers.get("content-type"),
      },
      null,
      2,
    ),
    "utf8",
  );
  return buffer;
}

export async function fetchTextCached(
  url: string,
  options: FetchTextOptions = {},
): Promise<string> {
  return (await fetchBufferCached(url, options)).toString("utf8");
}

export function getCacheRoot(): string {
  return CACHE_ROOT;
}
