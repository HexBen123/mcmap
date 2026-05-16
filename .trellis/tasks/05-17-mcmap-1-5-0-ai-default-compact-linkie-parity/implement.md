# Implementation Plan: mcmap 1.5.0

1. Baseline and metadata:
   - bump package and server versions to `1.5.0`;
   - update README to describe compact as the default and JSON as explicit.

2. Default compact:
   - change shared format schema defaults from `json` to `compact`;
   - change `search_mapping` format default to `compact`;
   - update descriptions and smoke assertions.

3. Namespace registry and counts:
   - add a small registry module for namespace metadata, aliases, resolvers, and
     search targets;
   - enrich `list_namespaces` with version counts and support status;
   - support safe aliases in `get_namespace_versions` and `search_mapping`;
   - update compact namespace formatter and output schema.

4. Search ranking and Mojmap bridge:
   - adjust ranking so class-shaped queries prioritize class leaf matches;
   - add Mojmap enrichment from Intermediary/Yarn when available;
   - keep bridge lookup best-effort.

5. Loader combined view:
   - add `view: "core" | "with_ecosystem"` input;
   - include per-version ecosystem recommendations in structured loader payload
     when requested;
   - update compact loader formatter to include an ecosystem section.

6. Smoke coverage:
   - keep explicit JSON coverage for legacy behavior;
   - add default compact coverage;
   - add Legacy Yarn ranking assertions;
   - add namespace count and alias assertions;
   - add Mojmap bridge assertion;
   - add loader `with_ecosystem` assertion.

7. Validate:
   - `npm run check`;
   - `npm run build`;
   - `npm run smoke`;
   - `git diff --check`;
   - `python .\\.trellis\\scripts\\task.py validate 05-17-mcmap-1-5-0-ai-default-compact-linkie-parity`.

8. Finish:
   - review diff;
   - commit implementation;
   - archive the Trellis task after validation.
