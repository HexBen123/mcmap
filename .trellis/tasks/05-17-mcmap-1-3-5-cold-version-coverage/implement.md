# mcmap 1.3.5 Cold Version Coverage Implementation Plan

## Steps

1. Update `src/sources/loaders.ts`:
   - replace single `jeiArtifactId` lookup with ordered candidate lookup;
   - keep Forge pre-1.13 `jei_<minecraft>`;
   - support Forge middle-era `jei-<minecraft>`;
   - prefer API artifact when present;
   - aggregate candidate failures into one unversioned reason.
2. Extend `scripts/smoke.mjs`:
   - assert cold Legacy Yarn class lookups for `1.3.2` and `15w14a`;
   - assert assisted MCP high-confidence candidates for `1.8`, `1.10.2`, and
     `1.12`;
   - assert MCP `1.15-pre7` returns structured analysis without a tool error;
   - assert Forge `1.16.5` returns verified JEI coordinate.
3. Update README with the JEI Forge artifact coverage note.
4. Bump `package.json` and `package-lock.json` to `1.3.5`.
5. Validate:
   - `npm run check`
   - `npm run build`
   - `npm run smoke`

## Review Points

- Do not emit a JEI `coordinate` from an inferred artifact unless Maven metadata
  was fetched and contained a version.
- Do not change ecosystem recommendation types.
- Keep cold smoke assertions specific enough to catch owner/member regressions
  without depending on unrelated ranking order.
