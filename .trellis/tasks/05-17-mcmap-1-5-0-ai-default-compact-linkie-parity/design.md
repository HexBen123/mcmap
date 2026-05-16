# Design: mcmap 1.5.0

## Default Output

All tools that currently support `format: "compact"` should default to compact.
Explicit `format: "json"` remains the compatibility path. `search_mapping` keeps
`format: "human"` as an optional display format, but compact becomes default.

The service should continue to return three layers for compact responses:

- compact text in `content`;
- canonical JSON object in `structuredContent`;
- a `resource_link` pointing at the full JSON payload.

This keeps MCP's machine-readable contract while reducing model-visible text for
clients that consume the text projection.

## Namespace Registry and Counts

Move namespace metadata out of inline tool registration into a reusable registry.
Each entry can expose:

- canonical id;
- aliases;
- description;
- supported symbol kinds;
- support status such as `search`, `alias`, or `metadata`;
- optional version-list resolver;
- optional search namespace target.

`list_namespaces` can then enrich the registry with lightweight version counts
by calling each resolver. Failures should not fail the whole tool; a namespace
summary can include `status: "unavailable"` and a reason.

Cold/linkie-style namespaces should be added conservatively:

- `mojang` and `mojang_raw` map to `mojmap` behavior.
- `mojang_srg` maps to the existing MCP/SRG-backed behavior where possible.
- `mojang_hashed`, `feather`, `barn`, `plasma`, and `yarrn` are listed as known
  linkie namespaces only when their support status clearly says that full search
  support is not implemented.

## Legacy Yarn Ranking

The ranking bug is caused by field names such as `worldRenderer` receiving an
exact primary-name score higher than the exact class leaf `WorldRenderer`.

The fix should be generic rather than hard-coded:

- when the query looks like a class token, class leaf exact/prefix matches get a
  tie-break boost over non-class exact member-name matches;
- existing fuzzy field ranking, such as the direct `network` field, must remain
  intact for lower-case member queries.

## Mojmap and Intermediary Bridge

`loadIntermediary` already enriches Intermediary records with Yarn names.
`loadYarn` already enriches Yarn records with official names. Mojmap currently
uses only Mojang mapping files.

For modern versions where Fabric Intermediary is available, Mojmap search can
optionally enrich Mojmap records by joining against Intermediary/Yarn records.
The join must use stable keys:

- class: class name mapping;
- method/field: owner, descriptor, and obfuscated or official member name.

If bridge data cannot be loaded, Mojmap search should continue to work with its
current data.

## Loader Combined View

`get_loader_versions` keeps `view: "core"` as the default. A new
`view: "with_ecosystem"` option attaches ecosystem recommendations per returned
Minecraft version.

Compact output should show the core rows first, then an ecosystem section with
version, id, coordinate, confidence, and reason. Full recommendation details
remain in `structuredContent` and the full-result resource.

Ecosystem lookups are optional. A single version's ecosystem failure should be
represented as an unversioned/error summary for that version, not as a failed
tool call.

## Compatibility

The release intentionally changes default text output. Any caller that needs
the previous JSON text behavior must send `format: "json"`.

Existing successful compact contracts remain valid:

- schema id line starts with `@S=mcmap.*.v1`;
- full JSON resource is still readable via `mcmap://result/<tool>/<digest>`;
- `structuredContent` contains the canonical payload.
