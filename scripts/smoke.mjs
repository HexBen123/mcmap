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
  for (const tool of [
    "list_namespaces",
    "get_namespace_versions",
    "search_mapping",
    "get_loader_versions",
    "get_ecosystem_recommendations",
  ]) {
    assert(toolNames.has(tool), `tools/list should include ${tool}`);
  }
  pass("tools/list");

  for (const namespace of [
    "mojmap",
    "intermediary",
    "yarn",
    "legacy-yarn",
    "quilt-mappings",
    "parchment",
    "mcp",
  ]) {
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
  assert(yarn.results[0]?.score > 0, "yarn result should include a score");
  assert(Array.isArray(yarn.results[0]?.matchReasons), "yarn result should include match reasons");
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
  assert(
    intermediary.results.some((result) => result.names?.yarn === "net/minecraft/server/network/ServerPlayerEntity"),
    "intermediary results should be enriched with yarn names when safe",
  );
  pass("search_mapping intermediary 1.21.1");

  const reverseYarn = await callJsonTool("search_mapping", {
    query: "method_45729",
    namespace: "yarn",
    version: "1.21.1",
    limit: 3,
    allow_classes: false,
    allow_methods: true,
    allow_fields: false,
    translate_mode: "ba",
  });
  assertSearchResult(reverseYarn, "yarn", "method_45729");
  assert(
    reverseYarn.results[0]?.names?.yarn === "sendChatMessage",
    "translate_mode ba should resolve alternate names back to yarn names",
  );
  pass("search_mapping translate_mode ba");

  const fuzzy = await callJsonTool("search_mapping", {
    query: "network",
    namespace: "yarn",
    version: "1.21.1",
    limit: 3,
    allow_classes: true,
    allow_methods: true,
    allow_fields: true,
    translate_mode: "none",
  });
  assertSearchResult(fuzzy, "yarn", "network");
  assert(
    fuzzy.results[0]?.names?.yarn === "network",
    "fuzzy ranking should prioritize the direct network field",
  );
  pass("search_mapping fuzzy ranking");

  const readableDescriptor = await callJsonTool("search_mapping", {
    query: "sendChatMessage",
    namespace: "yarn",
    version: "1.21.1",
    limit: 10,
    allow_classes: false,
    allow_methods: true,
    allow_fields: false,
    translate_mode: "none",
  });
  assertSearchResult(readableDescriptor, "yarn", "sendChatMessage");
  assert(
    readableDescriptor.results.some(
      (result) =>
        result.readableDescriptor?.includes("net/minecraft/network/message/SignedMessage"),
    ),
    "yarn result should include readable descriptor translations",
  );
  pass("search_mapping readable descriptor");

  const humanSearch = await callJsonTool("search_mapping", {
    query: "ClientPlayNetworkHandler",
    namespace: "yarn",
    version: "1.21.1",
    limit: 1,
    allow_classes: true,
    allow_methods: false,
    allow_fields: false,
    translate_mode: "none",
    format: "human",
  });
  assertSearchResult(humanSearch, "yarn", "ClientPlayNetworkHandler");
  assert(typeof humanSearch.results[0] === "string", "human output should contain strings");
  pass("search_mapping human format");

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

  const legacyYarn = await callJsonTool("search_mapping", {
    query: "PlayerEntity",
    namespace: "legacy-yarn",
    version: "1.12.2",
    limit: 3,
    allow_classes: true,
    allow_methods: false,
    allow_fields: false,
    translate_mode: "none",
  });
  assertSearchResult(legacyYarn, "legacy-yarn", "PlayerEntity");
  pass("search_mapping legacy-yarn 1.12.2");

  const quilt = await callJsonTool("search_mapping", {
    query: "ServerPlayerEntity",
    namespace: "quilt-mappings",
    version: "1.21.1",
    limit: 3,
    allow_classes: true,
    allow_methods: false,
    allow_fields: false,
    translate_mode: "none",
  });
  assertSearchResult(quilt, "quilt-mappings", "ServerPlayerEntity");
  pass("search_mapping quilt-mappings 1.21.1");

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

  const recommendations = await callJsonTool("get_ecosystem_recommendations", {
    loader: "fabric",
    minecraft: "1.21.1",
  });
  assert(recommendations.loader === "fabric", "recommendations should echo loader");
  assert(
    recommendations.recommendations.some((item) => item.id === "modmenu"),
    "fabric recommendations should include optional modmenu guidance",
  );
  pass("get_ecosystem_recommendations fabric");

  const unsupported = await callTool("search_mapping", {
    query: "EntityPlayer",
    namespace: "intermediary",
    version: "1.12.2",
    limit: 3,
    allow_classes: true,
    allow_methods: false,
    allow_fields: false,
    translate_mode: "none",
  });
  assert(unsupported.isError, "unsupported mapping search should return tool error");
  const unsupportedPayload = JSON.parse(toolText(unsupported));
  assert(
    unsupportedPayload.error?.code === "UNSUPPORTED_VERSION",
    "unsupported mapping search should return structured UNSUPPORTED_VERSION",
  );
  pass("structured tool errors");
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
  const result = await callTool(name, args);
  assert(!result?.isError, `${name} returned MCP tool error: ${toolText(result)}`);
  const text = toolText(result);
  assert(text, `${name} should return text content`);
  return JSON.parse(text);
}

async function callTool(name, args) {
  const message = await request("tools/call", {
    name,
    arguments: args,
  });
  return message.result;
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
