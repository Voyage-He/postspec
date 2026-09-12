---
name: postspec
description: Automatically create and update project specs from code, tests, and user feedback. Use when documenting existing capabilities, synchronizing specs after code changes, or revising a spec.
---

# PostSpec

Maintain durable capability specs directly in `openspec/specs/<capability>/spec.md` in the target project using short lowercase kebab-case names. Create directories when needed; no initialization command or runtime is required. Existing `openspec/config.yaml` files remain unchanged, and this skill does not require one.

Read relevant code, tests, existing specs, and the user's feedback before writing. Keep affected specs synchronized with the current code. A spec request authorizes documentation edits; application code edits follow the user's requested scope.

- Decide which affected capabilities need durable documentation. Create a spec for a new capability or semantically update the existing spec for that capability; keep one coherent description of each capability.
- Capture observable behavior, important constraints and invariants, and decisions or lessons that will guide future changes. Skip incidental details that add no durable value. An explicit request to document a capability is sufficient reason to create its spec.
- Use [assets/spec-template.md](assets/spec-template.md), relative to this skill directory, for new specs. Adapt the structure and remove unused sections and placeholders. Existing specs may keep their own structure.
- Describe current behavior supported by code and tests. Distinguish verified results from untested assumptions and intended behavior. If user feedback conflicts with the code, make the discrepancy clear and ask only when resolving it requires a product decision.
- Before modifying any spec, read its current on-disk content. Apply focused semantic edits, reconcile outdated statements, and preserve unrelated human edits. Do not regenerate an entire document when a local update is sufficient.
- Keep specs focused on current capabilities. Preserve useful rationale when updating outdated behavior.

Finish with a brief report of specs created or updated and any unresolved discrepancies. If no update is warranted, explain why briefly. Do not stop at recommending edits when you can make them.
