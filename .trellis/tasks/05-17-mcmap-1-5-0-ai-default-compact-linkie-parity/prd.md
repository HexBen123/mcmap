# PRD: mcmap 1.5.0 AI Default Compact and Linkie Parity

## Problem

`mcmap` 1.4.5 added compact model-facing output, but JSON is still the default
format. That preserves old behavior, but it means an AI caller that omits
`format` still receives verbose JSON text. In large responses such as Yarn
version aliases, this wastes context even though the compact text plus
`resource_link` path is already available.

Recent comparison against `linkie` also identified useful behavior that should
be carried into `mcmap` without losing `mcmap`'s stronger structured contract.

## Goals

- Make compact output the default for AI-facing tools while keeping explicit
  `format: "json"` available for scripts and debugging.
- Preserve `structuredContent`, `outputSchema`, and `resource_link` behavior for
  compact calls.
- Improve Legacy Yarn search ranking so class-name queries prioritize exact
  class leaf matches over exact field-name matches.
- Add version-count summaries to `list_namespaces`, similar to linkie's
  namespace overview, while keeping the full version lists in existing tools.
- Add support for selected cold/linkie-style namespace aliases where they can be
  represented safely without pretending to support more than the underlying
  data can provide.
- Improve Mojmap and Intermediary bridge behavior so cross-namespace names are
  easier for an AI to use when migrating between Mojmap and Fabric/Yarn.
- Add a loader `view` option that can return core loader rows together with
  versioned ecosystem recommendations when explicitly requested.

## Non-Goals

- Do not remove JSON mode.
- Do not drop `structuredContent` from compact calls.
- Do not claim full support for cold namespaces if only version metadata or
  aliasing is available.
- Do not make optional ecosystem lookup failures fail the whole loader result.
- Do not change the MCP tool names in this release.

## Acceptance Criteria

- Tool schemas advertise compact as the default for:
  `list_namespaces`, `get_namespace_versions`, `search_mapping`,
  `get_loader_versions`, and `get_ecosystem_recommendations`.
- A default `search_mapping` call without `format` returns non-JSON compact text
  and still includes canonical `structuredContent`.
- A default `get_namespace_versions` call without `format` returns bounded
  compact text and a `resource_link`; explicit `format: "json"` still returns
  full JSON text.
- Legacy Yarn searches for `EntityRenderer` on `1.8.9` and `WorldRenderer` on
  `1.7.10` rank the exact class result before exact field-name results.
- `list_namespaces` structured output includes per-namespace version summary
  counts when available, and compact text includes those counts.
- Namespace aliases for selected linkie-style names are recognized in
  `list_namespaces`, `get_namespace_versions`, and `search_mapping` when they
  map to an existing safe source.
- Mojmap search results expose Intermediary/Yarn names when a safe bridge exists
  for the same version.
- `get_loader_versions` supports `view: "core"` and
  `view: "with_ecosystem"`; the latter includes ecosystem recommendations for
  each returned Minecraft version where lookup succeeds.
- Smoke tests cover the new defaults and all compatibility paths above.
- `npm run check`, `npm run build`, `npm run smoke`, and `git diff --check`
  pass.
