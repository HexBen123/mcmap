# mcmap 1.4.0 Compact AI Output Design

## Boundary

This release introduces a complete AI-facing output contract:

- opt-in compact text projection for the model-visible layer;
- `structuredContent` for machine-readable results;
- `outputSchema` for SDK-level output validation;
- `resource_link` blocks plus readable MCP resources for full/debug payloads.

The existing JSON text response remains the canonical compatibility and debug
path.

The main boundary is:

```
source facts -> normalized records -> canonical structured payload
                                 |-> JSON/debug text
                                 |-> compact AI text
                                 \-> full-result MCP resource
```

Compact formatting must be additive. It must not mutate source records,
ranking, dependency verification, or assisted-search semantics.

## SDK Capabilities

The project currently depends on `@modelcontextprotocol/sdk@1.29.0`, which
supports the required complete contract:

- `server.registerTool(..., { outputSchema }, handler)` lists output schemas and
  validates `structuredContent`.
- `CallToolResult` accepts `structuredContent`.
- Tool result `content` accepts `resource_link` blocks.
- `server.registerResource` and `ResourceTemplate` expose readable resources.

The implementation should use those SDK surfaces directly instead of simulating
them in plain text.

## Output Modes

Supported output modes:

- `json`: default, existing behavior, pretty JSON text.
- `human`: existing `search_mapping` behavior. Keep for compatibility.
- `compact`: new AI-facing text projection.

For tools that currently do not accept `format`, add:

```ts
format: z.enum(["json", "compact"]).default("json")
```

For `search_mapping`, extend the enum to:

```ts
format: z.enum(["json", "human", "compact"]).default("json")
```

`SearchOptions.format` should be updated accordingly so the search layer accepts
the new caller input. The search algorithm should not branch on compact output;
formatting belongs in the MCP boundary layer.

## Structured Content Contract

Each tool should return the same structured payload regardless of text output
mode. This keeps `format` strictly model-visible:

- `format=json`: `content[0].text` is pretty JSON, `structuredContent` is the
  same canonical payload.
- `format=compact`: `content[0].text` is compact text,
  `structuredContent` is the same canonical payload, and `content` also includes
  a `resource_link` for the full JSON resource when useful.
- Errors keep `isError: true`. They do not need output-schema validation.

Canonical payloads:

- `list_namespaces`: `{ cacheRoot, namespaces }`
- `get_namespace_versions`: `{ namespace, stable, snapshots, aliases?, source }`
- `search_mapping`: `{ query, namespace, version, count, results,
  queryAnalysis?, relatedCandidates? }`
- `get_ecosystem_recommendations`: `{ loader, minecraft, recommendations }`
- `get_loader_versions`: `{ loader, versions, source }`

These payloads should be generated once per tool call and then passed to text
formatters and resource registration.

## Output Schemas

Define output schemas in TypeScript near the tool registration layer or in a
small dedicated module. They should be broad enough to match the current
payloads but strict enough to catch accidental omissions:

- arrays and objects should be typed;
- optional fields should be explicitly optional;
- result rows that contain source-dependent fields can use `z.unknown()` only
  inside known containers, not for the whole payload;
- `search_mapping.results` and `relatedCandidates` should include the AI-facing
  safety fields: kind, owner, descriptor/readableDescriptor, names, score,
  matchReasons, matchedNames.

Because the SDK validates `structuredContent` when `outputSchema` is present,
all successful handlers must return `structuredContent`.

## Compact Grammar

The compact grammar is intentionally simple ASCII:

```text
!summary <one-line conclusion>
@S=<schema_id> <metadata key=value pairs>
@cols=<col1>|<col2>|...
<row1-col1>|<row1-col2>|...
<row2-col1>|<row2-col2>|...
@section <name> n=<count>
...
@full <resource-uri>
```

Rules:

- Use `|` as the row delimiter.
- Escape `|`, `\`, `\n`, and `\r` in cell values.
- Use empty cells for absent optional values.
- Keep schema IDs versioned, for example `mcmap.search.v1`.
- Prefer clear field names over cryptic single-letter fields.
- Keep summaries short and factual.

## Resource Contract

Full-result resources are in-memory and process-local in 1.4.0.

URI shape:

```text
mcmap://result/<tool>/<digest>
```

The digest should be derived from the canonical structured payload plus tool
name and compact schema version. The same payload in the same process should
produce the same URI.

Resource content:

- `mimeType: application/json`
- text is pretty JSON of the canonical payload
- resource metadata includes `audience: ["assistant"]` and a priority lower than
  the compact summary so clients can avoid loading it eagerly

Implementation approach:

- Add a small resource registry module that stores URI -> payload text and
  metadata.
- Register a `ResourceTemplate` for `mcmap://result/{tool}/{digest}`.
- The template list callback can enumerate currently known result resources.
- The read callback resolves the URI from the in-memory registry and returns the
  JSON text; unknown URIs return a clear MCP error.

Tool responses in compact mode should include both:

- a compact text line `@full mcmap://result/...`;
- a `resource_link` content block with the same URI.

## Tool-Specific Compact Shapes

### list_namespaces

Schema: `mcmap.namespaces.v1`

Columns:

```text
id|aliases|supports|description
```

The `cacheRoot` should be represented once in metadata, not repeated per row.

### get_namespace_versions

Schema: `mcmap.versions.v1`

The full stable/snapshot arrays can be large. Compact output should show:

- namespace,
- stable count,
- snapshot count,
- a bounded sample from each list,
- source,
- `@full` note explaining that `format=json` returns full arrays.

This avoids pretending a partial compact sample is the full truth. The compact
result must include a resource link to the full version arrays.

### search_mapping

Schema: `mcmap.search.v1`

Primary result columns:

```text
rank|kind|primary|names|owner|desc|score|why
```

Design choices:

- `primary` is the best display name for the requested namespace.
- `names` keeps other available namespace names as `ns=value,ns=value`.
- `owner` and descriptor stay explicit.
- `desc` uses `readableDescriptor` when available, otherwise `descriptor`.
- `why` joins match reasons and is omitted when empty.
- `relatedCandidates` use a separate `@section related` with confidence and
  reasons. They must not be mixed into primary rows.

### get_ecosystem_recommendations

Schema: `mcmap.ecosystem.v1`

Columns:

```text
id|name|kind|artifact|coordinate|confidence|reason|source
```

Verified coordinates remain copyable. Unversioned recommendations keep their
reason. The compact mode must preserve the distinction between
`confidence=verified` and `confidence=unversioned`.

### get_loader_versions

Schema: `mcmap.loader_versions.v1`

The loader version records are upstream-dependent and not strongly typed today.
Compact output should flatten common fields conservatively:

```text
mc|loader|api|mappings|extra
```

Unknown fields can be summarized in `extra` as compact `key=value` pairs. JSON
remains the full-fidelity path for every upstream-specific field.

## Error Contract

`asError` should accept an optional format argument:

- JSON format returns the existing structured JSON error payload.
- Compact format returns:

```text
!error code=<CODE> message=<escaped message> suggestion=<escaped suggestion>
```

No compact error should include a stack trace by default.

## Compatibility

- Existing callers that omit `format` receive the same JSON shape.
- Existing `format: "human"` smoke behavior remains valid.
- Compact smoke tests should inspect text markers rather than parse it as JSON.
- Compact output is not a lossless replacement for JSON; it is a task-oriented
  projection.
- The JSON text and `structuredContent` should describe the same canonical
  payload so older clients and schema-aware clients agree.
- Adding `structuredContent` and `outputSchema` is a protocol-level enhancement.
  Smoke tests must verify old JSON parsing still works from `content[0].text`.

## Risks

- Compact text can become ambiguous if escaping is incomplete. Implement a
  single cell escape helper and test delimiter-containing values.
- Over-compression can reduce model accuracy. Keep meaningful field names and
  avoid single-letter codes.
- Adding `format` to tools changes `tools/list`; smoke should assert the new
  enum without requiring clients to use it.
- Output schemas can reject valid results if they are too narrow. Start from the
  current payload contract and tighten only where fields are stable.
- In-memory resources disappear after server restart. This is acceptable for
  result links returned by live tool calls, but docs must describe that they are
  process-local full-result links.
