# AI Tutor Workspace

Clean foundation for the AI Tutor platform.

## Structure

- `backend/`: Express + Prisma API + Socket.IO
- `frontend/`: React + Vite web client
- `docs/`: archived notes and legacy design references
- `PROJECT_CONTEXT.md`: compact, AI-friendly project continuity file
- `scripts/compact-context.mjs`: auto-compacts `PROJECT_CONTEXT.md`

## Quick Start

1. Install dependencies:
   - `npm run setup`
2. Create environment files:
   - Copy `backend/.env.example` to `backend/.env`
   - Copy `frontend/.env.example` to `frontend/.env`
3. Run apps:
   - Backend: `npm run dev:backend`
   - Frontend: `npm run dev:frontend`

## Context Continuity

- Update `PROJECT_CONTEXT.md` at the end of each work session.
- Run `npm run context:compact` after edits to keep context small.
- New AI sessions should read `PROJECT_CONTEXT.md` first.
