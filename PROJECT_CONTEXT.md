# PROJECT_CONTEXT

Read this first in every new AI session.

## Goal
- Build AI-powered classroom app: classes, lessons, live teaching, assignments, attendance.
- Keep teacher workflows fast; student workflows simple and safe.

## Stack
- Frontend: React 19, Vite, Tailwind v4, React Router, Zustand, Axios, socket.io-client.
- Backend: Node.js, Express, Prisma, SQLite (`backend/dev.db`), JWT auth, Socket.IO.

## Roles / Permissions
- Teacher: create/manage classes, lessons, assignments, attendance; run AI lesson tools.
- Student: join classes, view lessons, submit assignments, view own attendance only.
- Teacher-only gates enforced in backend for admin actions.

## Core Features (Implemented)
- Class creation/join flow with teacher/student separation.
- Assignment lifecycle: create, submit, grade, teacher delete.
- Lesson lifecycle: create, edit, publish/live, teacher delete.
- AI 3-step lesson generation:
  - Step 1 Structure
  - Step 2 Block Strategy
  - Step 3 Full Lesson
- AI per-block refinement: teacher edits one block only; other blocks untouched.
- Live lesson sockets: quiz sync, leaderboard, chat lock/unlock, live attendance count.

## Block UX Rules
- `INTERACTIVE_SIMULATION`:
  - Clean consistent layout.
  - Built-in controls.
  - Clear state-change visualization.
  - Minimal config; AI-friendly generation.
- `CODE`:
  - In-browser notebook-like runtime.
  - Run inside lesson; no manual setup.
  - Library imports allowed.
  - Output shown below code.
  - Multiple runnable cells/sections.
  - Sandboxed execution.

## Attendance (Implemented)
- Data model: `AttendanceRecord` (Prisma + DB synced).
- Teacher manual mode: mark each student `PRESENT` / `ABSENT`.
- Teacher automatic mode: online students `PRESENT`, others `ABSENT`.
- Presence source: Socket.IO class presence (`join_class_presence`, `leave_class_presence`).
- Teacher attendance UI: [PeoplePage](D:/AI_Tutor/frontend/src/pages/PeoplePage.jsx).
- Student attendance UI: same page, read-only own records.
- APIs: [attendance.js](D:/AI_Tutor/backend/routes/attendance.js).

## Important Constraints
- Legacy data not priority; clean foundation preferred.
- Old/legacy assignment data can be discarded; no backward migration required.
- Keep old design references in `docs/design_mockups_legacy/` (read-only).
- Avoid committing generated/runtime clutter.
- Preserve teacher/student permission boundaries.

## Current Gaps / Next
- Add tests for notebook/simulation behavior.
- Add attendance analytics/export.
- Add E2E smoke for AI-generated lessons and attendance flow.
- Resolve local Vite/Tailwind oxide build environment issue if it reappears.

## Context Size Rules
- Keep file under ~3,500 chars preferred (hard max 8,000).
- Use short bullets only; no logs, traces, long prose.
- Keep at most 4 recent "next actions".
- After editing, run: `npm run context:compact`.

<!-- SESSION_LOG_START -->
## Session Log

### 2026-03-23 - Compact Handoff Reset
- Rewrote context into minimal resumable format.
- Preserved required blocks: goal, stack, roles, features, attendance, constraints.
- Kept rules optimized for low token transfer.
<!-- SESSION_LOG_END -->
