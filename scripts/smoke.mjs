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
  assert(init.result?.serverInfo?.version === "1.4.5", "initialize should return mcmap 1.4.5 serverInfo");
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
    const definition = listed.result?.tools?.find((item) => item.name === tool);
    assert(definition?.outputSchema, `tools/list should include outputSchema for ${tool}`);
  }
  assertToolFormat(listed, "list_namespaces", ["json", "compact"]);
  assertToolFormat(listed, "get_namespace_versions", ["json", "compact"]);
  assertToolFormat(listed, "search_mapping", ["json", "human", "compact"]);
  assertToolFormat(listed, "get_loader_versions", ["json", "compact"]);
  assertToolFormat(listed, "get_ecosystem_recommendations", ["json", "compact"]);
  pass("tools/list");

  const resourceTemplates = await request("resources/templates/list");
  assert(
    resourceTemplates.result?.resourceTemplates?.some(
      (template) => template.uriTemplate === "mcmap://result/{tool}/{digest}",
    ),
    "resources/templates/list should expose mcmap full-result resource template",
  );
  pass("resources/templates/list");

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
  assert(yarn._result.structuredContent?.query === "ServerPlayer", "json search should include structuredContent");
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

  const strictMixed = await callJsonTool("search_mapping", {
    query: "MinecraftServer getPlayerManager",
    namespace: "yarn",
    version: "1.21.1",
    limit: 5,
    allow_classes: true,
    allow_methods: true,
    allow_fields: true,
    translate_mode: "none",
  });
  assert(strictMixed.count === 0, "strict mixed query should keep default empty result behavior");
  assert(!("relatedCandidates" in strictMixed), "strict mixed query should not include assisted candidates by default");
  pass("search_mapping strict mixed query compatibility");

  const assistedYarn = await callJsonTool("search_mapping", {
    query: "MinecraftServer getPlayerManager",
    namespace: "yarn",
    version: "1.21.1",
    limit: 5,
    allow_classes: true,
    allow_methods: true,
    allow_fields: true,
    translate_mode: "none",
    assist: true,
  });
  assert(assistedYarn.count === 0, "assisted mixed query should not move candidates into primary results");
  assert(
    assistedYarn.queryAnalysis?.ownerLikeTokens?.includes("MinecraftServer"),
    "assisted query should expose owner-like token analysis",
  );
  assertAssistedCandidate(
    assistedYarn,
    (candidate) =>
      candidate.confidence === "high" &&
      candidate.reasons?.includes("split_owner_member") &&
      candidate.mapping?.owner === "net/minecraft/server/MinecraftServer" &&
      candidate.mapping?.names?.yarn === "getPlayerManager",
    "assisted Yarn query should expose MinecraftServer.getPlayerManager as related candidate",
  );
  pass("search_mapping assisted yarn mixed query");

  const compactAssistedYarn = await callTextTool("search_mapping", {
    query: "MinecraftServer getPlayerManager",
    namespace: "yarn",
    version: "1.21.1",
    limit: 5,
    allow_classes: true,
    allow_methods: true,
    allow_fields: true,
    translate_mode: "none",
    assist: true,
    format: "compact",
  });
  assert(!compactAssistedYarn.text.trim().startsWith("{"), "compact search should not be JSON text");
  assert(compactAssistedYarn.text.includes("!summary"), "compact search should include summary");
  assert(compactAssistedYarn.text.includes("@S=mcmap.search.v1"), "compact search should include schema");
  assert(compactAssistedYarn.text.includes("@section related"), "compact assisted search should include related section");
  assert(
    compactAssistedYarn.result.structuredContent?.query === "MinecraftServer getPlayerManager",
    "compact search should include canonical structuredContent",
  );
  const compactSearchLink = resourceLink(compactAssistedYarn.result);
  assert(compactSearchLink?.uri?.startsWith("mcmap://result/search_mapping/"), "compact search should include resource_link");
  const compactSearchResource = await readResource(compactSearchLink.uri);
  assert(
    JSON.parse(compactSearchResource.text).query === "MinecraftServer getPlayerManager",
    "compact search resource should contain full JSON payload",
  );
  pass("search_mapping compact assisted resource");

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

  const assistedMcpMatrix = [
    {
      label: "1.7.10",
      query: "EntityPlayerSP updateEntityActionState",
      expectedOwner: "net/minecraft/client/entity/EntityPlayerSP",
      expectedName: "updateEntityActionState",
    },
    {
      label: "1.8",
      query: "EntityPlayerSP updateEntityActionState",
      expectedOwner: "net/minecraft/client/entity/EntityPlayerSP",
      expectedName: "updateEntityActionState",
    },
    {
      label: "1.8.9",
      query: "EntityPlayerSP getClientBrand",
      expectedOwner: "net/minecraft/client/entity/EntityPlayerSP",
      expectedName: "getClientBrand",
    },
    {
      label: "1.10.2",
      query: "MinecraftServer getPlayerList",
      expectedOwner: "net/minecraft/server/MinecraftServer",
      expectedName: "getPlayerList",
    },
    {
      label: "1.12",
      query: "MinecraftServer getPlayerList",
      expectedOwner: "net/minecraft/server/MinecraftServer",
      expectedName: "getPlayerList",
    },
    {
      label: "1.12.2",
      query: "EntityPlayerSP getHorseJumpPower",
      expectedOwner: "net/minecraft/client/entity/EntityPlayerSP",
      expectedName: "getHorseJumpPower",
    },
    {
      label: "1.16.5",
      query: "ClientPlayerEntity func_110319_bJ",
      expectedOwner: "net/minecraft/client/entity/player/ClientPlayerEntity",
      expectedName: "func_110319_bJ",
    },
  ];

  for (const item of assistedMcpMatrix) {
    const assisted = await callJsonTool("search_mapping", {
      query: item.query,
      namespace: "mcp",
      version: item.label,
      limit: 5,
      allow_classes: true,
      allow_methods: true,
      allow_fields: true,
      translate_mode: "none",
      assist: true,
    });
    assert(assisted.count === 0, `assisted MCP ${item.label} should keep primary results empty for mixed phrase`);
    assert(
      assisted.queryAnalysis?.ownerLikeTokens?.length > 0,
      `assisted MCP ${item.label} should expose owner-like token analysis`,
    );
    assertAssistedCandidate(
      assisted,
      (candidate) =>
        candidate.confidence === "high" &&
        candidate.reasons?.includes("split_owner_member") &&
        candidate.mapping?.owner === item.expectedOwner &&
        Object.values(candidate.mapping?.names ?? {}).includes(item.expectedName),
      `assisted MCP ${item.label} should expose ${item.expectedOwner}.${item.expectedName}`,
    );
    pass(`search_mapping assisted mcp ${item.label}`);
  }

  const mcpPrerelease = await callJsonTool("search_mapping", {
    query: "MinecraftServer getPlayerList",
    namespace: "mcp",
    version: "1.15-pre7",
    limit: 5,
    allow_classes: true,
    allow_methods: true,
    allow_fields: true,
    translate_mode: "none",
    assist: true,
  });
  assert(mcpPrerelease.namespace === "mcp", "mcp prerelease search should echo namespace");
  assert(mcpPrerelease.version === "1.15-pre7", "mcp prerelease search should echo version");
  assert(
    mcpPrerelease.queryAnalysis?.ownerLikeTokens?.includes("MinecraftServer"),
    "mcp prerelease search should return structured owner token analysis",
  );
  assert(Array.isArray(mcpPrerelease.relatedCandidates), "mcp prerelease search should return related candidates");
  pass("search_mapping assisted mcp 1.15-pre7");

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

  const coldLegacyYarnMatrix = [
    {
      version: "1.3.2",
      query: "MinecraftServer",
    },
    {
      version: "15w14a",
      query: "MinecraftServer",
    },
  ];
  for (const item of coldLegacyYarnMatrix) {
    const coldLegacyYarn = await callJsonTool("search_mapping", {
      query: item.query,
      namespace: "legacy-yarn",
      version: item.version,
      limit: 5,
      allow_classes: true,
      allow_methods: false,
      allow_fields: false,
      translate_mode: "none",
    });
    assertSearchResult(coldLegacyYarn, "legacy-yarn", item.query);
    assert(
      coldLegacyYarn.results.some(
        (result) => result.names?.yarn === "net/minecraft/server/MinecraftServer",
      ),
      `legacy-yarn ${item.version} should include MinecraftServer`,
    );
    pass(`search_mapping legacy-yarn ${item.version}`);
  }

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

  const compactLoaderVersions = await callTextTool("get_loader_versions", {
    loader: "fabric",
    stable_only: true,
    limit: 2,
    format: "compact",
  });
  assert(compactLoaderVersions.text.includes("@S=mcmap.loader_versions.v1"), "compact loader versions should include schema");
  assert(
    compactLoaderVersions.result.structuredContent?.loader === "fabric",
    "compact loader versions should include structuredContent",
  );
  assert(resourceLink(compactLoaderVersions.result), "compact loader versions should include resource_link");
  pass("get_loader_versions compact");

  const recommendations = await callJsonTool("get_ecosystem_recommendations", {
    loader: "fabric",
    minecraft: "1.21.1",
  });
  assert(recommendations.loader === "fabric", "recommendations should echo loader");
  assert(
    recommendations.recommendations.some((item) => item.id === "modmenu"),
    "fabric recommendations should include optional modmenu guidance",
  );
  assertVersionedRecommendation(
    recommendations,
    (item) => item.id === "modmenu" && item.coordinate?.startsWith("com.terraformersmc:modmenu:"),
    "fabric recommendations should include a verified Mod Menu coordinate",
  );
  assertVersionedRecommendation(
    recommendations,
    (item) => item.id === "architectury-api" && item.coordinate?.startsWith("dev.architectury:architectury-fabric:"),
    "fabric recommendations should include a verified Architectury Fabric coordinate",
  );
  pass("get_ecosystem_recommendations fabric");

  const compactRecommendations = await callTextTool("get_ecosystem_recommendations", {
    loader: "fabric",
    minecraft: "1.21.1",
    format: "compact",
  });
  assert(compactRecommendations.text.includes("@S=mcmap.ecosystem.v1"), "compact recommendations should include schema");
  assert(compactRecommendations.text.includes("verified"), "compact recommendations should preserve confidence");
  assert(
    compactRecommendations.result.structuredContent?.minecraft === "1.21.1",
    "compact recommendations should include structuredContent",
  );
  assert(resourceLink(compactRecommendations.result), "compact recommendations should include resource_link");
  pass("get_ecosystem_recommendations compact");

  const forgeRecommendations = await callJsonTool("get_ecosystem_recommendations", {
    loader: "forge",
    minecraft: "1.12.2",
  });
  assertVersionedRecommendation(
    forgeRecommendations,
    (item) => item.id === "jei" && item.coordinate?.startsWith("mezz.jei:jei_1.12.2:"),
    "forge 1.12.2 recommendations should include a verified JEI coordinate",
  );
  pass("get_ecosystem_recommendations forge 1.12.2");

  const forgeMiddleEraRecommendations = await callJsonTool("get_ecosystem_recommendations", {
    loader: "forge",
    minecraft: "1.16.5",
  });
  assertVersionedRecommendation(
    forgeMiddleEraRecommendations,
    (item) => item.id === "jei" && item.coordinate?.startsWith("mezz.jei:jei-1.16.5:"),
    "forge 1.16.5 recommendations should include a verified middle-era JEI coordinate",
  );
  pass("get_ecosystem_recommendations forge 1.16.5");

  const forgeModernRecommendations = await callJsonTool("get_ecosystem_recommendations", {
    loader: "forge",
    minecraft: "1.21.1",
  });
  for (const id of ["architectury-api", "cloth-config", "rei", "jei"]) {
    assert(
      forgeModernRecommendations.recommendations.some((item) => item.id === id),
      `forge 1.21.1 recommendations should include ${id}`,
    );
  }
  assertVersionedRecommendation(
    forgeModernRecommendations,
    (item) => item.id === "cloth-config" && item.coordinate?.startsWith("me.shedaniel.cloth:cloth-config-forge:"),
    "forge 1.21.1 recommendations should include a verified Cloth Config coordinate when upstream metadata allows it",
  );
  pass("get_ecosystem_recommendations forge 1.21.1");

  const forgeVerifiedRecommendations = await callJsonTool("get_ecosystem_recommendations", {
    loader: "forge",
    minecraft: "1.20.1",
  });
  assertVersionedRecommendation(
    forgeVerifiedRecommendations,
    (item) => item.id === "architectury-api" && item.coordinate?.startsWith("dev.architectury:architectury-forge:"),
    "forge 1.20.1 recommendations should include a verified Architectury Forge coordinate",
  );
  assertVersionedRecommendation(
    forgeVerifiedRecommendations,
    (item) => item.id === "rei" && item.coordinate?.startsWith("me.shedaniel:RoughlyEnoughItems-forge:"),
    "forge 1.20.1 recommendations should include a verified REI Forge coordinate",
  );
  pass("get_ecosystem_recommendations forge 1.20.1");

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

  const compactUnsupported = await callTool("search_mapping", {
    query: "EntityPlayer",
    namespace: "intermediary",
    version: "1.12.2",
    limit: 3,
    allow_classes: true,
    allow_methods: false,
    allow_fields: false,
    translate_mode: "none",
    format: "compact",
  });
  assert(compactUnsupported.isError, "compact unsupported mapping search should return tool error");
  assert(toolText(compactUnsupported).startsWith("!error"), "compact tool errors should use compact envelope");
  assert(!toolText(compactUnsupported).includes("Traceback"), "compact tool errors should not include stack traces");
  pass("compact tool errors");

  const compactVersions = await callTextTool("get_namespace_versions", {
    namespace: "yarn",
    format: "compact",
  });
  assert(compactVersions.text.includes("@S=mcmap.versions.v1"), "compact namespace versions should include schema");
  assert(compactVersions.text.includes("stable_sample="), "compact namespace versions should include bounded stable sample");
  assert(compactVersions.text.includes("alias_count="), "compact namespace versions should expose alias count");
  assert(compactVersions.text.includes("alias_key_sample="), "compact namespace versions should expose bounded alias keys");
  assert(!compactVersions.text.includes("aliases="), "compact namespace versions should not dump full alias map");
  assert(compactVersions.text.length < 2000, "compact namespace versions should stay bounded");
  const compactVersionsLink = resourceLink(compactVersions.result);
  assert(compactVersionsLink, "compact namespace versions should include resource_link");
  const compactVersionsResource = await readResource(compactVersionsLink.uri);
  const compactVersionsPayload = JSON.parse(compactVersionsResource.text);
  assert(
    compactVersionsPayload.namespace === "yarn",
    "compact namespace versions resource should contain full JSON payload",
  );
  assert(
    compactVersionsPayload.aliases?.["1.21.1"]?.some((item) => item.includes("1.21.1+build.")),
    "compact namespace versions resource should retain full alias payload",
  );
  pass("get_namespace_versions compact resource");

  const compactNamespaces = await callTextTool("list_namespaces", {
    format: "compact",
  });
  assert(compactNamespaces.text.includes("@S=mcmap.namespaces.v1"), "compact namespaces should include schema");
  assert(
    compactNamespaces.result.structuredContent?.namespaces?.some((item) => item.id === "yarn"),
    "compact namespaces should include structuredContent",
  );
  assert(resourceLink(compactNamespaces.result), "compact namespaces should include resource_link");
  pass("list_namespaces compact");
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
  const parsed = JSON.parse(text);
  Object.defineProperty(parsed, "_result", {
    value: result,
    enumerable: false,
  });
  return parsed;
}

async function callTextTool(name, args) {
  const result = await callTool(name, args);
  assert(!result?.isError, `${name} returned MCP tool error: ${toolText(result)}`);
  const text = toolText(result);
  assert(text, `${name} should return text content`);
  return { result, text };
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

function resourceLink(result) {
  return result?.content?.find((entry) => entry.type === "resource_link");
}

async function readResource(uri) {
  const message = await request("resources/read", { uri });
  const content = message.result?.contents?.[0];
  assert(content?.text, `resources/read should return text for ${uri}`);
  return content;
}

function assertToolFormat(listed, name, expectedValues) {
  const tool = listed.result?.tools?.find((item) => item.name === name);
  const formatProperty = tool?.inputSchema?.properties?.format;
  assert(formatProperty, `${name} should expose format input`);
  for (const value of expectedValues) {
    assert(formatProperty.enum?.includes(value), `${name} format should include ${value}`);
  }
}

function assertSearchResult(result, namespace, query) {
  assert(result.namespace === namespace, `${namespace} search should echo namespace`);
  assert(result.query === query, `${namespace} search should echo query`);
  assert(result.count > 0, `${namespace} search should return at least one result`);
  assert(Array.isArray(result.results), `${namespace} search results should be an array`);
}

function assertAssistedCandidate(result, predicate, message) {
  assert(Array.isArray(result.relatedCandidates), `${message}: relatedCandidates should be present`);
  assert(result.relatedCandidates.some(predicate), message);
}

function assertVersionedRecommendation(result, predicate, message) {
  assert(Array.isArray(result.recommendations), `${message}: recommendations should be present`);
  assert(
    result.recommendations.some(
      (item) =>
        item.versioned === true &&
        item.confidence === "verified" &&
        typeof item.version === "string" &&
        typeof item.coordinate === "string" &&
        predicate(item),
    ),
    message,
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pass(label) {
  console.log(`ok - ${label}`);
}
