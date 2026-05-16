import { createHash } from "node:crypto";
import type { Resource, ResourceLink } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

interface StoredFullResultResource {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  size: number;
  text: string;
  annotations: {
    audience: ["assistant"];
    priority: number;
  };
}

const resources = new Map<string, StoredFullResultResource>();

export function registerFullResultResource(
  tool: string,
  schema: string,
  payload: unknown,
): ResourceLink {
  const text = JSON.stringify(payload, null, 2);
  const digest = createHash("sha256")
    .update(`${tool}\n${schema}\n${text}`)
    .digest("hex")
    .slice(0, 20);
  const uri = `mcmap://result/${encodeURIComponent(tool)}/${digest}`;
  const title = `${tool} full JSON result`;
  const resource: StoredFullResultResource = {
    uri,
    name: `${tool}-${digest}`,
    title,
    description: `Full JSON payload for ${tool}.`,
    mimeType: "application/json",
    size: Buffer.byteLength(text, "utf8"),
    text,
    annotations: {
      audience: ["assistant"],
      priority: 0.2,
    },
  };
  resources.set(uri, resource);
  return {
    type: "resource_link",
    uri,
    name: resource.name,
    title,
    description: resource.description,
    mimeType: resource.mimeType,
    size: resource.size,
    annotations: resource.annotations,
  };
}

export function listFullResultResources(): Resource[] {
  return [...resources.values()].map((resource) => ({
    uri: resource.uri,
    name: resource.name,
    title: resource.title,
    description: resource.description,
    mimeType: resource.mimeType,
    size: resource.size,
    annotations: resource.annotations,
  }));
}

export function readFullResultResource(uri: string): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  const resource = resources.get(uri);
  if (!resource) {
    throw new McpError(ErrorCode.InvalidParams, `mcmap result resource not found: ${uri}`);
  }
  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: resource.text,
      },
    ],
  };
}
