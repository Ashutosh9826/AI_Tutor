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

- Status: core classroom flows stabilized after multiple bug fixes.
- CODE blocks now run in-browser notebook mode with multi-cell execution.
- Live lessons allow students to edit and run code instantly.
- INTERACTIVE_SIMULATION blocks include built-in state visualization panels.
- AI prompt updated to generate notebook-ready code and stateful simulations.
- Teachers can refine any single lesson block with AI without touching other blocks.

## Next Actions

- Add backend/frontend tests for notebook cell serialization and simulation state events.
- Verify multi-user live lesson behavior for per-student local code edits.
- Harden sandbox policy and library allowlist decisions.
- Add E2E smoke checks for AI-generated simulation and code blocks.
- Add optional one-click save after per-block AI refinement.

## Decisions

- `PROJECT_CONTEXT.md` is the single continuity source for AI handoff.
- Legacy design files remain under `docs/design_mockups_legacy/` as read-only references.
- Generated files (logs/db/dist/node_modules) must stay out of version control.

<!-- SESSION_LOG_START -->
## Session Log

### 2026-03-23 - Per-Block AI Editing
- Added teacher-only backend endpoint to refine one block via AI.
- Enforced single-block scope and block-type schema normalization.
- Added `lessonService.refineBlockAi` frontend API method.
- Added per-block AI button in lesson editor block controls.
- Added instruction modal to apply AI changes to only selected block.
- Kept existing manual Save flow; no other blocks are modified.

### 2026-03-23 - Notebook and Simulation Upgrade
- Rebuilt CODE block into sandboxed multi-cell browser notebook runtime.
- Added direct library imports via auto-resolved ESM package specifiers.
- Enabled live lesson code editing for students with local state.
- Added simulation state snapshot, timeline, and runtime notes panels.
- Added simulation `Input JSON` editor in lesson authoring UI.
- Updated AI generation prompt for stateful simulations and notebook code sections.

### 2026-03-23 - Foundation Reset
- Removed tracked runtime clutter: logs, lint dumps, local DB files, ad-hoc scripts.
- Removed local dependency/build folders to reset clean workspace state.
- Moved old root docs into `docs/archive`.
- Moved `design_mockups` into `docs/design_mockups_legacy`.
- Added root `.gitignore`, root `README.md`, and workspace `package.json`.
- Added context compaction workflow with `scripts/compact-context.mjs`.
<!-- SESSION_LOG_END -->
