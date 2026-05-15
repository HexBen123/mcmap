# mcmap 1.3.0 Versioned Ecosystem Recommendations Implementation Plan

## Steps

1. Update ecosystem recommendation types to support versioned and unversioned recommendation entries.
2. Add constants and helpers in `src/sources/loaders.ts` for:
   - Modrinth version lookup by project, Minecraft version, and loader.
   - Maven version verification for a group/artifact.
   - JEI modern and legacy artifact resolution.
3. Make `getEcosystemRecommendations` async and return verified coordinates when possible.
4. Update `src/index.ts` to await the async ecosystem recommendation function.
5. Update `README.md` to document the new output contract.
6. Extend `scripts/smoke.mjs` with assertions for:
   - Versioned Fabric recommendations on `1.21.1`.
   - Versioned Forge JEI on `1.12.2`.
   - Existing assisted search behavior still passes.
7. Run:
   - `npm run check`
   - `npm run build`
   - `npm run smoke`

## Review Points

- Do not let optional ecosystem lookup failures throw the entire tool response.
- Do not emit `coordinate` unless the version was verified against Maven metadata.
- Keep core loader dependency output unchanged.
- Avoid duplicating Maven metadata parsing utilities already available in `src/utils/maven.ts`.
