# PROJECT_DOCUMENTATION.md

## Section 1 - High Level Description

**Academic Atelier** is a classroom platform for two roles: **TEACHER** and **STUDENT**.

- Teachers create classes, publish assignments, build interactive lessons, run live sessions, grade work, and manage attendance.
- Students join classes by code, complete assignments, participate in live lesson activities, and view grades/attendance.
- The stack is:
  - **Frontend:** React + Vite SPA (`frontend/`)
  - **Backend:** Express + Prisma + Socket.IO (`backend/`)
  - **Database:** PostgreSQL via Prisma datasource (`backend/prisma/schema.prisma`)

### Product Design Language (Required Context for Contributors)

The intended UX direction is explicitly:

- **Fun, adventurous, lighthearted** classroom experience.
- **Colorful cartoon/comic-book visual style**.
- Designed for a **target age demographic of 5-8 years old**.

This design target should guide future UI decisions (layout, imagery, iconography, motion, typography tone, and microcopy), even where current implementation still mixes broader "general productivity" styling.

## Section 2 - Feature List (High Level)

1. Authentication and profile management
2. Class creation, joining, listing, archive/unarchive
3. Class stream (assignments + lessons)
4. Assignment submission and grading workflow
5. Lesson authoring editor with notebook-style blocks
6. AI lesson generation (full draft) and AI per-block refinement
7. Live lesson runtime with realtime quiz and teacher orchestration
8. AI chat tutor and written answer evaluation
9. Attendance tracking (manual and automatic using online presence)
10. Calendar/classwork/grades aggregation pages

## Section 3 - Low Level Description (Per Feature)

### Feature: Authentication and Session Handling

Frontend behavior:

- Auth state is stored in Zustand (`frontend/src/store/useAuthStore.js`), initialized from `localStorage` via `authService.getCurrentUser()`.
- Axios request interceptor adds `Authorization: Bearer <token>` when token exists.
- Axios response interceptor clears session and redirects to `/login` on HTTP 401.

Backend endpoints (`backend/routes/auth.js`):

- `POST /api/auth/register`
  - Body: `{ name, email, password, role }`
  - Role normalization: only `TEACHER` remains teacher, otherwise defaults to `STUDENT`.
  - Response `201`: `{ token, user }` where `user` includes profile + notification fields + `has_password`.
- `POST /api/auth/login`
  - Body: `{ email, password, role? }`
  - If `role` is sent and mismatched with account role, returns 403.
  - Response: `{ token, user }`.
- `POST /api/auth/google`
  - Body: `{ credential, role }`
  - Uses `GOOGLE_CLIENT_ID` and `google-auth-library` verification.
  - New users are auto-created (no password).
- `GET /api/auth/me`
  - Auth required.
  - Response: normalized client user object.
- `PATCH /api/auth/me`
  - Auth required.
  - Accepted fields: `name`, `avatar_url`, `notify_assignments`, `notify_due_soon`, `notify_announcements`.
- `PATCH /api/auth/me/password`
  - Auth required.
  - Body: `{ current_password?, new_password }`.
  - Requires `current_password` only if account already has password.

Auth middleware details (`backend/middleware/authMiddleware.js`):

- JWT payload supports backward compatibility: `payload.userId` or legacy `payload.id`.
- Canonical role is always reloaded from DB on each request (`TEACHER` or `STUDENT`), preventing stale-token role drift.
- `requireTeacher` gate checks `req.user.role === 'TEACHER'`.

### Feature: Classes (Create / Join / List / Archive)

Backend endpoints (`backend/routes/classes.js`):

- `GET /api/classes?archived=false|true|all`
  - Teacher: classes where `teacher_id = req.user.userId`.
  - Student: enrolled classes only.
  - Teacher list includes `_count.enrollments`.
- `GET /api/classes/:id`
  - Teacher must own class.
  - Student must be enrolled.
- `POST /api/classes` (teacher-only)
  - Body: `{ name, section }`
  - Generates uppercase 6-char class code.
- `POST /api/classes/join`
  - Body: `{ class_code }`
  - Student-only; rejects teacher join attempts.
  - Rejects archived classes and duplicate enrollment.
- `PATCH /api/classes/:id/archive` (teacher owner-only)
  - Sets `is_archived = true`, `archived_at = now`.
- `PATCH /api/classes/:id/unarchive` (teacher owner-only)
  - Sets `is_archived = false`, `archived_at = null`.

Frontend pages using this feature:

- `DashboardPage.jsx`
- `ArchivedClassesPage.jsx`
- `ClassStreamPage.jsx` (class info banner/modal)

### Feature: Assignments (Create / Submit / Grade / Delete)

Backend endpoints (`backend/routes/assignments.js`):

- `GET /api/assignments/class/:classId`
  - Teacher owner or enrolled student only.
  - Student responses include computed `completed` boolean.
- `GET /api/assignments/:id`
  - Teacher owner or enrolled student only.
  - Student view includes only own submissions in `submissions` array.
- `POST /api/assignments` (teacher-only)
  - Body: `{ class_id, title, description, due_date, attachment_url }`
  - Archived classes are blocked.
- `POST /api/assignments/:id/submit`
  - Student-only.
  - Body: `{ file_url }` (string required; used for typed text/link payload in current UI).
- `GET /api/assignments/:id/submissions` (teacher-only owner)
  - Response includes `student: { id, name, email }` per submission.
- `PUT /api/assignments/submissions/:submissionId/grade` (teacher-only owner)
  - Body: `{ grade, feedback }`, grade must be numeric 0..100.
- `DELETE /api/assignments/:id` (teacher-only owner)
  - Transactionally deletes all `Submission` rows then the `Assignment`.

Frontend pages using this feature:

- `ClassStreamPage.jsx`
- `AssignmentView.jsx`
- `AssignmentGradingPage.jsx`
- `ClassworkPage.jsx`
- `GradesPage.jsx`
- `CalendarPage.jsx`

### Feature: Lesson Authoring (CRUD + Notebook Blocks)

Backend endpoints (`backend/routes/lessons.js`):

- `GET /api/lessons/class/:classId`
  - Returns lessons for class, sorted by `created_at desc`.
  - Authorization:
    - `TEACHER`: must own the class.
    - `STUDENT`: must be enrolled in the class.
  - Returns `403` when caller is authenticated but not authorized.
- `GET /api/lessons/:id`
  - Returns lesson and ordered blocks.
  - Authorization:
    - `TEACHER`: must own the lesson's class.
    - `STUDENT`: must be enrolled in the lesson's class.
  - Returns `403` when caller is authenticated but not authorized.
- `POST /api/lessons` (teacher-only, class owner, class not archived)
  - Body: `{ class_id, title }`
  - Creates lesson with status `DRAFT`.
- `PUT /api/lessons/:id` (teacher-only, owner, class not archived)
  - Body: `{ title?, status?, blocks? }`
  - Replaces all lesson blocks when `blocks` is provided.
  - Stores object content as JSON string.
- `DELETE /api/lessons/:id` (teacher-only owner)
  - Deletes dependent `QuizResponse`, `QuizSession`, `ChatMessage`, `LessonBlock` records in transaction.

Editor page:

- `frontend/src/pages/LessonEditor.jsx`
- Local state: `title`, `blocks`, `saving`, `aiEdit*` modal state.
- Blocks are re-orderable and persisted by full lesson update.

### Feature: AI Lesson Generation and AI Block Refinement

AI generation endpoint:

- `POST /api/lessons/generate` (teacher-only)
- Body: `{ topic, gradeLevel, targetDuration, referenceContent }`
- Performs 3 OpenRouter stages:
  1. Structure plan
  2. Block strategy
  3. Final lesson content
- Normalizes and enforces block-type coverage (`CODE`, `EXERCISE`, `INTERACTIVE_SIMULATION`, `QUIZ`).
- Response: `{ title, blocks }`.

AI block refinement endpoint:

- `POST /api/lessons/:id/refine-block` (teacher-only owner)
- Body: `{ blockType, blockContent, instructions }`
- Returns: `{ content }` with schema-aware normalization by block type.

Shared AI configuration:

- Uses `OPENROUTER_API_KEY` and optional `OPENROUTER_MODEL`.
- Main default model path in generation: `nvidia/nemotron-3-super-120b-a12b:free`.

### Feature: Live Lesson Runtime and Realtime Orchestration

Primary live page:

- `frontend/src/pages/LiveLessonView.jsx`

Live lesson local state model (no context; no Redux):

- `lesson`, `loading`
- `messages` (AI chat transcript)
- `isChatLocked`
- `activeQuizzes` map by blockId
- `quizResults` map by blockId and option index
- `exerciseStates` map by blockId
- `leaderboard` map by userId
- `quizPhase` (`CONTENT`, `WAITING`, `RANKING`)
- `showLeaderboardSidebar`
- `studentCount`
- `understandingPercent`
- `socketRef` (`useRef`) for shared socket instance

Socket server wiring:

- Backend handler file: `backend/realtime/registerRealtimeHandlers.js`
- Registered from `backend/index.js`

Client emits seen in frontend:

- `join_lesson(lessonId)`
- `start_quiz({ lessonId, blockId, timeLimit })`
- `stop_quiz({ lessonId, blockId })`
- `submit_answer({ lessonId, blockId, optionIndex, userId, userName })`
- `chat_lock({ lessonId })` / `chat_unlock({ lessonId })`
- `start_final_quiz({ lessonId })`
- `show_leaderboard({ lessonId })`
- `join_class_presence({ classId, userId, role })`
- `leave_class_presence({ classId, userId })`

Server emits handled in frontend:

- `quiz_started`
- `quiz_stopped`
- `answer_received`
- `chat_locked`
- `chat_unlocked`
- `attendance_updated`
- `start_final_quiz`
- `show_leaderboard`
- `class_presence_updated` (People page)

Additional server emits currently implemented but not actively consumed by UI:

- `user_joined`
- `receive_message`

Quiz scoring behavior (server-side):

- If `pointsEarned` present in payload, uses it directly.
- Otherwise score = `1000 + round(timeLeft * 50)` based on active session timer.

### Feature: AI Tutor Chat and Written Evaluation

Endpoints (`backend/routes/chat.js`):

- `POST /api/lesson-chat/message`
  - Body: `{ lessonId, messages }`
  - `messages` expected as array like `{ sender, role, text }`.
  - Builds lesson-aware system prompt by loading lesson blocks when `lessonId` is real (not `demo-lesson`).
  - Response: `{ text }`.
- `POST /api/lesson-chat/evaluate-answer`
  - Body: `{ question, idealAnswer, studentAnswer }`
  - Extracts score using regex from model output line `SCORE: X/10`.
  - Response: `{ feedback, score }`.

### Feature: Attendance

Endpoints (`backend/routes/attendance.js`):

- `GET /api/attendance/class/:classId/day?date=YYYY-MM-DD` (teacher owner)
  - Response includes roster, statuses, online flags, summary.
- `POST /api/attendance/class/:classId/day/manual` (teacher owner)
  - Body: `{ date, records: [{ student_id, status }] }`
  - Upserts per student/day with mode `MANUAL`.
- `POST /api/attendance/class/:classId/day/automatic` (teacher owner)
  - Body: `{ date }`
  - Uses online presence set; mode `AUTO`.
- `GET /api/attendance/my?classId=...` (student)
  - Returns own historical records (up to 120) and summary.

Presence service (`backend/services/presenceStore.js`):

- Primary mode uses Redis sets for horizontal scaling:
  - `class:{classId}:online`
  - `class:{classId}:user:{userId}:sockets`
  - `socket:{socketId}:classes`
- If Redis is not configured or unavailable, logic gracefully falls back to in-memory Maps/Sets for local development.
- `getOnlineStudentIdsForClass(classId)` returns student IDs from Redis set (or in-memory fallback).

### Feature: Database Model (Prisma Schema)

Source: `backend/prisma/schema.prisma`

- `User`
  - Fields include identity (`id`, `name`, `email`, `password?`, `role`), profile (`avatar_url`), notification flags, `created_at`.
  - Relations:
    - teaches many `Class` records via relation `TeacherClasses`
    - has many `Enrollment`, `Submission`, `ChatMessage`
    - attendance relations:
      - `attendance_marked` (`AttendanceMarkedBy`)
      - `attendance_records` (`AttendanceStudent`)
- `Class`
  - Fields: `name`, `section?`, unique `class_code`, `teacher_id`, archive fields (`is_archived`, `archived_at`).
  - Relations: `teacher`, `enrollments`, `assignments`, `announcements`, `lessons`, `attendance_records`.
- `Enrollment`
  - Join table between `User` and `Class` (`user_id`, `class_id`).
- `Assignment`
  - Belongs to class (`class_id`), has metadata (`title`, `description?`, `due_date?`, `attachment_url?`).
  - One-to-many with `Submission`.
- `Submission`
  - Belongs to assignment and student (`assignment_id`, `student_id`).
  - Stores `file_url`, optional `grade`, optional `feedback`, `submitted_at`.
- `Announcement`
  - Class announcement text + `created_at`.
- `Lesson`
  - Belongs to class (`class_id`), includes `title`, `created_by`, `status`, `created_at`.
  - Has many `LessonBlock`, `QuizSession`, `ChatMessage`.
- `LessonBlock`
  - Stores ordered lesson content (`lesson_id`, `type`, `content`, `order_index`).
- `QuizSession`
  - Belongs to lesson; has `active` and optional `current_question`.
  - Has many `QuizResponse`.
- `QuizResponse`
  - Belongs to quiz session (`session_id`) and stores `student_id`, `answer`, optional `score`.
- `ChatMessage`
  - Belongs to lesson and user; stores `message`, `role`, `timestamp`.
- `AttendanceRecord`
  - Belongs to class, student, and marker (`marked_by` user).
  - Fields: `attendance_date`, `status`, `mode`, timestamps.
  - Constraints:
    - unique on (`class_id`, `student_id`, `attendance_date`)
    - indexed by (`class_id`, `attendance_date`) and (`student_id`, `attendance_date`)

## Section 4 - UI Blocks (Reusable Blocks)

Lesson block rendering occurs in both `LessonEditor.jsx` (authoring) and `LiveLessonView.jsx` (runtime).

### TEXT block

- Storage type: plain string
- Editor: textarea explanation content
- Live: rendered paragraph-like text

### DISCUSSION block

- Storage type: plain string prompt
- Editor: textarea prompt
- Live: highlighted discussion card

### CODE block (`CodeNotebookBlock`)

- Component: `frontend/src/components/CodeNotebookBlock.jsx`
- Props:
  - `content`
  - `code` (fallback alias)
  - `onChange`
  - `editable` (default `false`)
  - `blockId`
- Content supports:
  - Legacy string code (split by `// %%` markers)
  - Notebook object `{ version, language, runtime, cells[] }`
- Runtime:
  - Sandboxed iframe execution
  - import rewriting to `https://esm.sh/<pkg>?bundle`
  - helper runtime APIs: `display`, `print`, `table`, `html`, `plot`, `fetchJson`, `importLib`

### EXERCISE block

- Storage type: object `{ question, options[] }`
- Option structure: `{ text, isCorrect, feedback }`
- Editor: option CRUD + correct-answer radio
- Live: local answer selection + feedback reveal

### QUIZ block (`InteractiveQuiz`)

- Component props:
  - `block`
  - `userRole`
  - `isActive`
  - `onStart(blockId)`
  - `onStop(blockId)`
  - `onSubmit(blockId, optionIndex)`
  - `results`
- Storage type: object `{ question, options[], timeLimit }`
- Live uses socket-driven active/stop/result states.

### WRITTEN_QUIZ block (`WrittenQuiz`)

- Component props:
  - `block`
  - `userRole`
- Storage type: object `{ question, idealAnswer }`
- Student submits free text for AI evaluation.

### INTERACTIVE_SIMULATION block (`InteractiveSimulationBlock`)

- Component props:
  - `block`
  - `compact` (default `false`)
- Storage type: object including:
  - `title`, `description`, `hint`, `solutionText`
  - `html`, `css`, `js`
  - `libs` (external script URLs)
  - `height`
  - `inputJson`
- Runtime:
  - sandboxed iframe with message channel `simulation-canvas-v3`
  - state timeline + runtime notes panels
  - helper APIs via `context.helpers` (`setState`, `replaceState`, `emitStep`, etc.)

### Other reusable UI components

- `ChatAssistant({ messages, onSendMessage, isLocked, user })`
- `TeacherControlPanel({ lessonId, socket, isChatLocked, onToggleChat, onStartCompetition, onShowPodium, studentCount, understandingPercent })`
- `Sidebar({ onJoinClass })`
- `TopNavBar()`

## Section 5 - Buttons and Controls (Inventory)

### Global navigation

- Top bar links: Stream, Classwork, People, Grades
- App menu links: Stream, Classwork, People, Grades, Settings
- Profile menu actions: Manage account, Sign out
- Sidebar links: Home, Calendar, Enrolled, Archived, Settings, Help, Privacy

### Dashboard

- Create/Join class trigger (card + mobile FAB)
- Class actions menu (teacher): Open class, Copy class code, Archive class
- Archived Classes navigation
- View All Tasks quick action

### Class stream

- Teacher actions:
  - New Assignment
  - Manual Lesson
  - Generate Lesson with AI
  - Delete Assignment
  - Delete Lesson
- Modals:
  - Create assignment
  - Create lesson
  - Generate AI lesson
  - Class info
- Assignment row actions (teacher): Grade, Delete

### Lesson editor

- Top actions: Save, Publish, Present
- Per-block controls: move up/down, AI refine, delete
- Inline add-block row: Text, Code, Exercise, Quiz, Prompt, Written, Simulation
- Floating add menu duplicates block insertion options

### Live lesson

- Top action:
  - Teacher: Stop Presenting (link back to editor)
  - Student: Exit Live Session (link back to class stream)
- Student sidebar tabs: Chat / Podium
- Teacher control panel:
  - COMPETITION
  - PODIUM
  - LOCKED / OPEN chat toggle
  - Student count and understanding percentage indicators
- Fullscreen overlay close action for ranking view

### Attendance (People page)

- Class selector (all roles)
- Date selector (teacher)
- Teacher actions:
  - Auto Mark (Online = Present)
  - Save Manual Attendance
  - Refresh
  - Per-student Present/Absent toggle

### Assignment / grading pages

- Student: Turn in submission
- Teacher: Grade submissions, Return to Student, Save Draft

### Settings

- Save Profile
- Save Notifications
- Change/Set Password

### Utility pages

- Back to Dashboard

### Forgot Password

- Send Reset Link
- Cancel / Back to Login

## Section 6 - User Roles

### TEACHER

Server-enforced permissions:

- Create classes
- Archive/unarchive owned classes
- Create/update/delete lessons in owned classes
- Generate/refine AI lesson content for owned classes
- Create/delete assignments in owned classes
- Grade submissions for owned assignments
- Read and modify attendance for owned classes

UI capabilities:

- Dashboard class management
- Class stream content creation and deletion
- Full lesson editor and present controls
- Live lesson teacher orchestration panel
- Attendance roster control

### STUDENT

Server-enforced permissions:

- Join class by code
- Access enrolled classes
- Submit assignments (teacher submission blocked)
- View own attendance via `/api/attendance/my`

UI capabilities:

- Consume lesson blocks
- Participate in live quiz/exercise/written simulation interactions
- Use AI tutor chat unless locked by teacher
- View own grade status

### Admin note

No standalone `ADMIN` role or admin panel is implemented in scanned code. Administrative operations are teacher-scoped.

## Section 7 - Page Structure

### Frontend routes (`frontend/src/App.jsx`)

- `/`, `/login` -> `LoginPage`
- `/forgot-password` -> `ForgotPasswordPage`
- `/dashboard` -> `DashboardPage`
- `/classwork` -> `ClassworkPage`
- `/people` -> `PeoplePage`
- `/grades` -> `GradesPage`
- `/calendar` -> `CalendarPage`
- `/archived` -> `ArchivedClassesPage`
- `/settings` -> `SettingsPage`
- `/help`, `/privacy`, `/terms` -> `UtilityPage`
- `/class/stream?classId=...` -> `ClassStreamPage`
- `/assignment/:id` -> `AssignmentView`
- `/assignment/:id/grade` -> `AssignmentGradingPage`
- `/lesson/edit?lessonId=...` -> `LessonEditor`
- `/lesson/live?lessonId=...` -> `LiveLessonView`

All page components are lazy-loaded via `React.lazy` + `Suspense`.

### Backend router mounts (`backend/index.js`)

- `/api/auth`
- `/api/classes`
- `/api/assignments`
- `/api/lessons`
- `/api/lesson-chat`
- `/api/attendance`

Additional routes:

- `GET /` health text
- `GET /classes` simple Prisma class dump (non-authenticated utility route)

### State management summary

- Global auth/session: Zustand (`useAuthStore`)
- Everything else: component-local React state
- No React Context for app domain state
- Realtime sockets managed directly in page components (`useRef` + `useEffect`)

## Section 8 - Interaction Flow

### Flow A: Teacher creates class, student joins

1. Teacher logs in and opens Dashboard.
2. Teacher creates class (`POST /api/classes`), receives generated class code.
3. Student logs in and joins with class code (`POST /api/classes/join`).
4. Dashboard refreshes class list for each role.

### Flow B: Teacher assigns work, student submits, teacher grades

1. Teacher opens class stream and creates assignment (`POST /api/assignments`).
2. Student opens assignment and submits turn-in payload (`POST /api/assignments/:id/submit`).
3. Teacher opens grading page, selects submission.
4. Teacher returns grade (`PUT /api/assignments/submissions/:submissionId/grade`).

### Flow C: Teacher builds lesson and presents live

1. Teacher creates lesson manually or by AI generation.
2. Teacher edits blocks in Lesson Editor and saves (`PUT /api/lessons/:id`).
3. Teacher publishes and opens live route.
4. Teacher starts quizzes and controls chat/podium through Socket.IO events.

### Flow D: Student participates in live session

1. Student opens live lesson route.
2. Client fetches lesson blocks via `/api/lessons/:id`.
3. Client joins lesson room and class-presence room.
4. Student submits quiz answers in realtime and can use AI tutor chat if unlocked.

### Flow E: Teacher attendance operations

1. Teacher opens People page and picks class/date.
2. Teacher loads day snapshot (`GET /api/attendance/class/:classId/day`).
3. Teacher either:
   - saves manual statuses (`POST .../manual`), or
   - runs automatic attendance from online presence (`POST .../automatic`).
4. Student can view own history via `GET /api/attendance/my?classId=...`.

## Section 9 - Cloud Migration Status (Current as of 2026-03-24)

### Confirmed migration state

- Prisma datasource is configured for PostgreSQL:
  - `provider = "postgresql"`
  - `url = env("DATABASE_URL")`
- Backend includes PostgreSQL client dependency `pg`.
- Frontend and socket URLs are env-driven from `VITE_API_URL` and derived `SOCKET_BASE_URL`.
- Backend CORS origin uses `FRONTEND_URL` with credentials enabled.
- Optional multi-instance Socket.IO sync via Redis adapter when `REDIS_URL` is present.
- Presence state and quiz-session state support Redis-backed storage, with local in-memory fallback when Redis is not available.
- Backend Dockerfile exists and runs:
  - `npx prisma generate`
  - `npx prisma migrate deploy && node index.js`

### Required environment variables

Backend:

- `DATABASE_URL`
- `FRONTEND_URL`
- `JWT_SECRET`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional)
- `GOOGLE_CLIENT_ID` (if Google login enabled)
- `REDIS_URL` (optional unless horizontal socket scaling is needed)

Frontend:

- `VITE_API_URL`
- `VITE_GOOGLE_CLIENT_ID` (if Google login enabled)

### Repository cleanup status

- Legacy SQLite artifacts have been removed from `backend/prisma/`:
  - `dev.db`
  - `init.sql`

## Section 10 - Discovered Architecture Details

1. **Presence tracking is Redis-backed with local fallback.**
   - `presenceStore.js` writes presence into Redis sets for class online users and socket membership.
   - If Redis is missing/unavailable, the same API falls back to in-memory Maps/Sets for local development.

2. **Quiz session timing state is Redis-backed with local fallback.**
   - Realtime handler stores quiz timing in keys shaped like `quiz:{lessonId}:{blockId}`.
   - Scoring reads start-time/time-limit from Redis when available, otherwise from in-memory fallback state.

3. **Lesson read endpoints now have explicit authorization gates.**
   - `GET /api/lessons/class/:classId` and `GET /api/lessons/:id` both enforce:
     - teacher must own class
     - student must be enrolled
   - Unauthorized access now returns `403`.

4. **Auth role safety remains stronger than typical JWT-only setups.**
   - Middleware re-fetches role from DB for each authenticated request.
   - Prevents stale token role mismatch issues after role updates.

5. **AI generation pipeline has robust fallback normalization.**
   - Three-pass generation and post-normalization improve schema reliability.
   - Required pedagogical block coverage is auto-enforced if provider output is incomplete.

6. **Lesson block storage model is type + serialized content.**
   - `LessonBlock.content` is a string in DB.
   - Object-based block content is serialized/deserialized in backend/frontend normalization layers.

7. **No cron jobs or background schedulers were found in scanned backend source.**
   - Workflows are request-driven and socket-event-driven.

8. **Current backend uses Express 5.x with commonjs modules.**
   - Error handling is explicit per route (try/catch + response JSON), no centralized global error middleware found in scanned files.
