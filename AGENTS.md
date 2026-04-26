# Codex Agent Memory (Project-Level)

## First Principles

1. Before applying any code change to local files, always compare current diffs first (for example via `git status` and `git diff`) to avoid overwriting edits made by the user during the same work session.
2. Never make modifications inside `_site/`. All edits must be applied only to source files, not generated build artifacts.

