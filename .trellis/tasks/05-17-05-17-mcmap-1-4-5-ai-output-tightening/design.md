# mcmap 1.4.5 Design

## Boundary

This release keeps the `mcmap` 1.4.0 MCP contract intact:

- successful tool calls keep returning `structuredContent`;
- all tools keep their existing `outputSchema`;
- compact calls keep returning compact text plus `resource_link`;
- full JSON payloads remain readable from `mcmap://result/<tool>/<digest>`.

The release changes only the model-facing projection and recommendation
coverage.

## Compact Version Projection

`get_namespace_versions` currently keeps the full alias map in the compact text.
For Yarn this can still exceed 60k characters, defeating the purpose of compact
mode even though the full payload is already available through a resource.

The compact projection should instead expose:

- stable and snapshot counts;
- optional alias key count;
- bounded stable and snapshot samples;
- bounded alias key samples, not alias values;
- `@full <resource>` for complete arrays and alias mappings.

The canonical JSON payload and `structuredContent` must remain unchanged. Only
the text returned by `formatVersionsCompact` changes.

## Ecosystem Coverage

Linkie exposes useful Forge ecosystem suggestions beyond the core loader
coordinate. `mcmap` should learn the useful part while preserving stronger
verification semantics.

Forge recommendations should include:

- Architectury API from Modrinth plus Maven verification;
- Cloth Config from Modrinth plus Maven verification;
- Roughly Enough Items from Modrinth plus Maven verification;
- JEI through the existing Maven artifact resolver.

If Modrinth or Maven does not produce a verifiable coordinate, the item remains
present as `confidence: "unversioned"` with an actionable reason.

## Compatibility

No schema change is needed for the added recommendation entries because the
existing ecosystem output schema already allows multiple recommendation items
with `id`, `artifact`, `coordinate`, `confidence`, `reason`, `repositories`, and
source fields.

The compact version schema id can stay `mcmap.versions.v1`; the structure is a
stricter interpretation of the existing 1.4.0 design, which already required
bounded samples instead of full version dumps.
