# Project Context (Primary Handoff File)

Use this file as the first read for any new AI session.

## Context Rules

1. Keep this file short and operational.
2. Do not paste large logs, stack traces, or long code blocks.
3. Prefer bullets and concrete next actions.
4. At session end, update only:
   - `Current Snapshot`
   - `Next Actions`
   - one new `Session Log` entry
5. Run `npm run context:compact` after every update.

## Size Budget

- Hard target: under 8,000 characters.
- Keep at most 8 recent session entries.
- Keep each session entry to 6 bullets max.
- Keep each bullet under 20 words.

## Current Snapshot

- Status: foundation cleanup complete; runtime clutter removed.
- Repo structure: backend/frontend runtime folders + docs archive + context compactor.
- Env tracking: `.env` removed from VCS; `.env.example` files added.
- Legacy data stance: local DB/log artifacts intentionally removed.

## Next Actions

- Reinstall dependencies when needed: `npm run setup`.
- Recreate local env files from examples.
- Resume product development from feature priorities, not legacy artifacts.
- Add tests and CI once feature surface is stabilized.

## Decisions

- `PROJECT_CONTEXT.md` is the single continuity source for AI handoff.
- Legacy design files remain under `docs/design_mockups_legacy/` as read-only references.
- Generated files (logs/db/dist/node_modules) must stay out of version control.

<!-- SESSION_LOG_START -->
## Session Log

### 2026-03-23 - Foundation Reset
- Removed tracked runtime clutter: logs, lint dumps, local DB files, ad-hoc scripts.
- Removed local dependency/build folders to reset clean workspace state.
- Moved old root docs into `docs/archive`.
- Moved `design_mockups` into `docs/design_mockups_legacy`.
- Added root `.gitignore`, root `README.md`, and workspace `package.json`.
- Added context compaction workflow with `scripts/compact-context.mjs`.
<!-- SESSION_LOG_END -->
