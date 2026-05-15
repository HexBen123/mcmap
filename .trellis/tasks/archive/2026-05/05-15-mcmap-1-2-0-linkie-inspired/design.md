# Design: mcmap 1.2.0 Linkie-Inspired Assistance

## Current Baseline

`mcmap 1.1.0` is stronger than Linkie for AI-driven use because it returns structured JSON, carries source provenance, separates raw and derived facts, and fails cleanly with empty results or structured errors.

The main weakness compared with Linkie is discovery ergonomics. Linkie is more willing to interpret messy input and return approximate candidates. This is useful when the caller only has a partial memory of a Minecraft class or method name, but it is risky when treated as authoritative.

## Design Principle

Keep the authoritative path strict and add an assistance path beside it.

Primary `results` remain the canonical mapping answers. Any fuzzy, owner-derived, split-token, historical alias, or "maybe you meant" output must be additive and separated under a dedicated field such as `suggestions` or `relatedCandidates`.

## Proposed Surface

### 1. Query Analysis Metadata

Extend `search_mapping` responses additively with an optional `queryAnalysis` object when assistance is used or when it helps explain a zero-result search.

Example shape:

```json
{
  "queryAnalysis": {
    "tokens": ["MinecraftServer", "getPlayerManager"],
    "ownerLikeTokens": ["MinecraftServer"],
    "memberLikeTokens": ["getPlayerManager"],
    "descriptorLikeTokens": [],
    "mode": "strict"
  }
}
```

This field is derived metadata. It must not replace the original `query`.

### 2. Assisted Discovery Mode

Add an opt-in input such as:

```ts
assist?: boolean
```

Default remains `false`. When `assist` is `true`, `search_mapping` can perform secondary searches after the normal primary search.

Secondary searches may include:

- owner/member split matching for phrases like `EntityPlayerSP updateEntityActionState`
- owner-only related member listing when a class is confidently identified
- member-only search if the query contains a likely method or field token
- class leaf-name search for Java-style names without package paths
- legacy MCP aliases and common owner leaf forms

### 3. Related Candidates Separation

Do not mix assisted output into `results`. Add a separate field:

```json
{
  "results": [],
  "relatedCandidates": [
    {
      "kind": "method",
      "confidence": "medium",
      "reason": "owner_leaf_match_and_member_exact",
      "mapping": { "...": "same mapping result shape" }
    }
  ]
}
```

The inner mapping object can reuse the existing result shape. The wrapper explains why the candidate is non-authoritative.

### 4. Old-Version MCP Workflow

For old Forge versions, assistance should be validated as a version matrix rather than a single-version special case. `1.7.10` remains the lowest-version stress case, but it must not drive hard-coded behavior.

Representative validation targets:

- `1.7.10`: early Forge/MCP, dense obfuscation, old SRG artifacts.
- `1.8.9`: common legacy client/modding line with many class-owner lookups.
- `1.12.2`: large classic Forge ecosystem baseline.
- `1.16.5`: late MCP/Forge transition-era baseline.
- `1.21.1`: modern regression guard for Yarn behavior.

Across these versions, assistance should help with these cases:

- Find a class by MCP/SRG path leaf, such as `EntityPlayerSP`.
- List methods owned by the matched class when only the owner is known.
- Combine owner and member tokens when both are present.
- Preserve repeated MCP names across different owners instead of collapsing them.

This keeps the useful part of Linkie's broad recall while making ambiguity explicit.

### 5. Scoring and Reasons

Keep the existing numeric `score` on primary results. Add assistance-specific reason strings such as:

- `split_owner_member`
- `owner_leaf_match`
- `member_exact_after_split`
- `owner_exact_member_fuzzy`
- `related_owner_member`
- `legacy_alias_match`

If an assisted candidate is only weakly related, it should not claim a high primary score. Use wrapper-level confidence to avoid confusing it with authoritative matches.

### 6. Human Format

`format: "human"` can include a compact assisted section, but it must still be wrapped in JSON as the tool currently does. Human output should be scan-friendly, but JSON remains the default and the canonical integration format.

## Non-Goals

- Do not change the public package name, binary name, or MCP tool names.
- Do not replace `results` with fuzzy results.
- Do not add external runtime dependency on Linkie.
- Do not mention Linkie as an upstream dependency in README.
- Do not make versioned ecosystem recommendations look like verified coordinates unless the tool really verifies the exact coordinate.

## Compatibility

This is a minor release because it adds optional output fields and optional input behavior. Existing callers that ignore unknown fields should continue to work. Existing exact searches should not change semantics.

## Risks

- Assisted matching can create false confidence if the output is not clearly separated.
- Old MCP data can contain duplicates from multiple source artifacts, and the shape differs across version eras, so deduplication must not erase meaningful owner/source distinctions.
- A fix that works only for `1.7.10` may overfit one artifact format. The implementation should prefer generic owner/member and alias handling over version-specific branches.
- Query splitting can misclassify tokens. This is acceptable only if the resulting candidates are marked as assistance.

## Rollback

Because the default path remains strict, rollback should be simple:

- disable `assist` behavior,
- keep `queryAnalysis` additive if harmless,
- or revert the 1.2.0 commit without changing 1.1.0 data-source code.
