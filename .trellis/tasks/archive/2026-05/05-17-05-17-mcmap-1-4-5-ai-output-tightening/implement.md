# Implementation Plan: mcmap 1.4.5

1. Update compact version formatting in `src/format.ts`:
   - remove full alias map emission from `formatVersionsCompact`;
   - add alias count and bounded alias key sample metadata;
   - keep `@full` resource URI.
2. Extend Forge ecosystem recommendations in `src/sources/loaders.ts`:
   - add Architectury API to `FORGE_ECOSYSTEM`;
   - add Roughly Enough Items to `FORGE_ECOSYSTEM`;
   - preserve existing Cloth Config and JEI behavior.
3. Update smoke tests in `scripts/smoke.mjs`:
   - assert compact Yarn version output is bounded and does not contain the full
     alias map;
   - assert the compact version resource still contains aliases;
   - assert Forge 1.21.1 ecosystem recommendations include Architectury, Cloth
     Config, REI, and JEI IDs.
4. Update README with 1.4.5 compact and ecosystem notes.
5. Bump `package.json` and `package-lock.json` to `1.4.5`.
6. Validate:
   - `npm run check`;
   - `npm run build`;
   - `npm run smoke`;
   - `npm pack --dry-run`.
