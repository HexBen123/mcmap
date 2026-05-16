# mcmap 1.4.0 Compact AI Output Implementation Plan

## Steps

1. Extend output and schema types:
   - update `SearchOptions.format` to include `compact`;
   - add small internal types if needed for text tool responses;
   - add output schemas for all tools;
   - keep public data source types unchanged.
2. Add a full-result resource registry:
   - store `mcmap://result/<tool>/<digest>` resources in memory;
   - provide `registerFullResultResource(tool, payload)` helper;
   - register a `ResourceTemplate` and read callback in `src/index.ts`;
   - return JSON text with `mimeType: application/json`.
3. Add compact formatting helpers in `src/format.ts`:
   - cell escaping for `|`, `\`, newline, and carriage return;
   - key-value rendering;
   - headered DSV rendering;
   - compact error envelope;
   - tool-specific compact formatters.
4. Add structured response builders:
   - create canonical payload once per tool call;
   - return `structuredContent` on every successful tool call;
   - return pretty JSON text for `format=json`;
   - return compact text plus `resource_link` for `format=compact`;
   - preserve `format=human` for `search_mapping` while still returning
     structured content.
5. Update `src/index.ts`:
   - extend `search_mapping` format enum to `json | human | compact`;
   - add `format: json | compact` to `list_namespaces`,
     `get_namespace_versions`, `get_loader_versions`, and
     `get_ecosystem_recommendations`;
   - attach output schemas to all five tools;
   - route compact calls to compact formatters;
   - route compact errors to the compact error envelope.
6. Extend `scripts/smoke.mjs`:
   - keep existing JSON assertions unchanged;
   - add text-call helper for compact results;
   - assert `tools/list` includes output schemas;
   - assert successful JSON and compact calls include `structuredContent`;
   - assert compact markers for `tools/list`, `search_mapping`,
     assisted related candidates, ecosystem recommendations, loader versions,
     namespace versions, and compact errors;
   - assert compact output is not accidentally JSON;
   - assert compact calls include `resource_link` blocks;
   - call `resources/templates/list` or `resources/list` and `resources/read`
     to verify emitted full-result links are readable.
7. Update docs:
   - README documents when to use `format: "compact"` versus JSON;
   - document `structuredContent`, output schemas, and process-local
     `resource_link` full payloads.
8. Bump release metadata:
   - `package.json` to `1.4.0`;
   - `package-lock.json` to `1.4.0`.
9. Validate:
   - `npm run check`;
   - `npm run build`;
   - `npm run smoke`;
   - `git diff --check`;
   - `npm pack --dry-run`.

## Review Points

- Do not change default JSON behavior.
- Do not change search ranking or data loading.
- Do not mix assisted candidates into primary search rows.
- Compact output must preserve verified/unversioned dependency semantics.
- `structuredContent` must validate against output schemas for every successful
  tool call.
- Every emitted `resource_link` must be readable through MCP resources in the
  same process.
- Do not duplicate massive payloads in compact text. Put full data behind the
  resource link.
- Keep escaping centralized. Do not hand-roll delimiter escaping in each
  formatter.
- Prefer bounded summaries for large arrays; point users to JSON for full data.

## Rollback

If one phase introduces compatibility risk, stop before version bump and keep
the previous successful phase intact. Do not ship 1.4.0 until compact output,
structured content, output schemas, and readable resource links are all green.
