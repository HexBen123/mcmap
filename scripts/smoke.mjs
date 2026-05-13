import { spawn } from "node:child_process";
import readline from "node:readline";

const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"],
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

const rl = readline.createInterface({ input: child.stdout });
const pending = new Map();

rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  } else {
    console.log("notification", message);
  }
});

let id = 1;

try {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "local-smoke", version: "0.1.0" },
  });
  assert(init.result?.serverInfo?.name === "mcmap", "initialize should return mcmap serverInfo");
  pass("initialize");

  notify("notifications/initialized");

  const listed = await request("tools/list");
  const toolNames = new Set(listed.result?.tools?.map((tool) => tool.name));
  for (const tool of ["list_namespaces", "get_namespace_versions", "search_mapping", "get_loader_versions"]) {
    assert(toolNames.has(tool), `tools/list should include ${tool}`);
  }
  pass("tools/list");

  for (const namespace of ["mojmap", "intermediary", "yarn", "parchment", "mcp"]) {
    const result = await callJsonTool("get_namespace_versions", { namespace });
    assert(result.namespace === namespace, `${namespace} version list should echo namespace`);
    assert(Array.isArray(result.stable), `${namespace} stable versions should be an array`);
    assert(Array.isArray(result.snapshots), `${namespace} snapshot versions should be an array`);
    pass(`get_namespace_versions ${namespace}`);
  }

  const yarn = await callJsonTool("search_mapping", {
    query: "ServerPlayer",
    namespace: "yarn",
    version: "1.21.1",
    limit: 3,
    allow_classes: true,
    allow_methods: false,
    allow_fields: false,
    translate_mode: "none",
  });
  assertSearchResult(yarn, "yarn", "ServerPlayer");
  pass("search_mapping yarn 1.21.1");

  const intermediary = await callJsonTool("search_mapping", {
    query: "class_3222",
    namespace: "intermediary",
    version: "1.21.1",
    limit: 3,
    allow_classes: true,
    allow_methods: false,
    allow_fields: false,
    translate_mode: "none",
  });
  assertSearchResult(intermediary, "intermediary", "class_3222");
  pass("search_mapping intermediary 1.21.1");

  const mojmap = await callJsonTool("search_mapping", {
    query: "Player",
    namespace: "mojmap",
    version: "1.18.2",
    limit: 3,
    allow_classes: true,
    allow_methods: false,
    allow_fields: false,
    translate_mode: "none",
  });
  assertSearchResult(mojmap, "mojmap", "Player");
  pass("search_mapping mojmap 1.18.2");

  const mcp = await callJsonTool("search_mapping", {
    query: "getEntityWorld",
    namespace: "mcp",
    version: "1.12.2",
    limit: 3,
    allow_classes: false,
    allow_methods: true,
    allow_fields: false,
    translate_mode: "none",
  });
  assertSearchResult(mcp, "mcp", "getEntityWorld");
  assert(
    mcp.results.some((result) => result.names?.srg === "func_130014_f_"),
    "mcp result should include merged SRG name func_130014_f_",
  );
  pass("search_mapping mcp 1.12.2");

  for (const loader of ["fabric", "forge", "neoforge", "legacy-fabric"]) {
    const result = await callJsonTool("get_loader_versions", {
      loader,
      stable_only: true,
      limit: 3,
    });
    assert(result.loader === loader, `${loader} loader result should echo loader`);
    assert(Array.isArray(result.versions), `${loader} versions should be an array`);
    assert(result.versions.length > 0, `${loader} versions should not be empty`);
    pass(`get_loader_versions ${loader}`);
  }
} finally {
  child.kill();
}

function request(method, params = {}) {
  const current = id++;
  const payload = { jsonrpc: "2.0", id: current, method, params };
  child.stdin.write(`${JSON.stringify(payload)}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(current);
      reject(new Error(`Timed out: ${method}`));
    }, 120000);
    pending.set(current, (message) => {
      clearTimeout(timer);
      if (message.error) {
        reject(new Error(`${method} returned JSON-RPC error: ${JSON.stringify(message.error)}`));
      } else {
        resolve(message);
      }
    });
  });
}

function notify(method, params = {}) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

async function callJsonTool(name, args) {
  const message = await request("tools/call", {
    name,
    arguments: args,
  });
  const result = message.result;
  assert(!result?.isError, `${name} returned MCP tool error: ${toolText(result)}`);
  const text = toolText(result);
  assert(text, `${name} should return text content`);
  return JSON.parse(text);
}

function toolText(result) {
  const item = result?.content?.find((entry) => entry.type === "text");
  return item?.text;
}

function assertSearchResult(result, namespace, query) {
  assert(result.namespace === namespace, `${namespace} search should echo namespace`);
  assert(result.query === query, `${namespace} search should echo query`);
  assert(result.count > 0, `${namespace} search should return at least one result`);
  assert(Array.isArray(result.results), `${namespace} search results should be an array`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pass(label) {
  console.log(`ok - ${label}`);
}
