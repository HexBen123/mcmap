# mcmap 1.4.0 Compact AI Output

## Goal

Ship `mcmap` 1.4.0 as a complete AI-context efficiency release. The release
should keep the existing JSON contract compatible while adding a compact
model-facing output mode, validated structured content, and lazy full-result
resources for high-frequency tool calls.

The core product decision is that JSON remains the canonical machine/debug
format, but AI agents can ask for a compact projection that spends fewer tokens
on repeated keys, pretty-printing, and irrelevant fields. The structured layer
must still be present for clients that want validation and machine parsing.

## Requirements

- Preserve all existing tool names and default behavior.
- Keep `format: "json"` as the default for compatibility.
- Add `format: "compact"` where it reduces model-visible token cost without
  losing the facts an agent needs to act safely.
- Keep the existing `format: "human"` behavior for `search_mapping` unless it
  becomes a direct alias of a documented compact format after compatibility
  review.
- Compact output must be plain text optimized for AI consumption, not a new
  binary or opaque encoding.
- Compact output should use stable schema headers, concise summaries, and
  headered delimiter-separated rows for repeated records.
- Add MCP `outputSchema` to every tool that returns structured data.
- Return `structuredContent` for every successful tool call, including compact
  calls. The structured content must validate against the tool's `outputSchema`.
- Add `resource_link` content blocks for full/debug payloads when the compact
  text only includes a projection or bounded sample.
- Register MCP resources so every emitted `resource_link` can be read through
  `resources/read` in the same server process.
- Resource reads must return full-fidelity JSON text for the referenced payload,
  not compact summaries.
- Compact output must keep raw source facts available when needed:
  - mapping names should not overwrite each other;
  - descriptors and owners should remain source-identifiable;
  - assisted candidates must remain separate from authoritative results;
  - dependency coordinates must keep `verified` versus `unversioned` semantics.
- Compact output must avoid over-compression that harms model accuracy:
  - no single-letter field codes unless the schema is obvious in the same
    output;
  - no uncommon Unicode delimiters;
  - no hidden ordering assumptions without a schema header.
- Large result sets should prefer summary, limits, and resource links over
  dumping full raw data into the model-visible text.
- Tool errors should keep a structured JSON path for compatibility and gain a
  compact, actionable envelope when the caller requests compact output.
- Update README with the new AI-facing compact output guidance.
- Bump package version to `1.4.0`.

## Target Compact Patterns

- Single object: `key=value` facts.
- Repeated records: `@S=<schema> @cols=a|b|c` followed by `|`-delimited rows.
- Result summaries: first line starts with `!summary`.
- Full/debug data: represented by an explicit `@full <resource-uri>` line and
  a matching MCP `resource_link` content block.
- Errors: one-line `!error code=... message=... suggestion=...`.

## Non-Goals

- Do not remove JSON output.
- Do not make compact output the default in 1.4.0.
- Do not invent tokenizer-specific Unicode syntax.
- Do not use process-external persistence for resources in 1.4.0. In-memory
  resource registration is sufficient as long as emitted links are readable in
  the same server process.
- Do not change mapping search ranking, loader resolution, cache layout, or
  upstream source behavior except where necessary to format results.

## Acceptance Criteria

- [ ] Existing smoke coverage for default JSON output still passes.
- [ ] `tools/list` advertises `format: "compact"` for supported tools.
- [ ] `tools/list` advertises `outputSchema` for all five tools.
- [ ] Successful tool calls include `structuredContent`, and smoke tests verify
      representative structured fields for JSON and compact calls.
- [ ] `search_mapping` with `format: "compact"` returns a non-JSON text result
      with `!summary`, `@S=mcmap.search.v1`, and headered rows.
- [ ] Compact `search_mapping` keeps `relatedCandidates` separate in a distinct
      section when `assist: true`.
- [ ] Compact `search_mapping` includes a `resource_link` for the full JSON
      payload, and `resources/read` can read it.
- [ ] `get_ecosystem_recommendations` can return compact text with verified
      coordinates and unversioned reasons preserved.
- [ ] `get_loader_versions` can return compact text without repeating JSON keys
      per version row.
- [ ] `get_namespace_versions` can return compact text with counts and bounded
      version samples rather than dumping every version as pretty JSON.
- [ ] `resources/list` or `resources/templates/list` exposes mcmap full-result
      resources in a discoverable way.
- [ ] Compact error output is actionable and does not include raw stack traces.
- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] `npm run smoke` passes.
- [ ] `npm pack --dry-run` succeeds before publish.

## Notes

- Local `@modelcontextprotocol/sdk@1.29.0` supports the complete target:
  `registerTool` accepts `outputSchema`, tool results accept
  `structuredContent`, content blocks accept `resource_link`, and
  `registerResource` supports readable resources.
- The implementation should be incremental inside this task, but the release is
  not complete until compact output, structured validation, and resource links
  are all implemented and tested.
