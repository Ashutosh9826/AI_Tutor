# PROJECT_DOCUMENTATION.md

## Section 1 — High Level Description

**Academic Atelier** is a classroom-style learning platform with **Teacher** and **Student** roles. Teachers create/manage classes, author interactive lessons (notebook-style “blocks”), assign work, grade submissions, and take attendance. Students join classes, view lessons (including live sessions), submit assignments, and view their grades and attendance.

- **Frontend**: Single Page App (React + React Router + Vite) in `frontend/`.
- **Backend**: Express REST API + Prisma (SQLite) + Socket.IO realtime events in `backend/`.
- **Core loop**:
  - Teacher creates a class → posts assignments/lessons → presents lessons live.
  - Student joins class → completes work → participates in quizzes/simulations/chat → attendance is recorded.
  - AI is used for lesson generation/refinement and as an in-lesson tutoring assistant.

## Section 2 — Feature List (High Level)

- **Authentication & Profiles**
  - Email/password login + register
  - Google OAuth login
  - Profile settings (name, avatar) and notification preferences
  - Password change / set password
- **Classes**
  - Teacher creates classes (with generated class code)
  - Students join by class code
  - Archive/unarchive classes
  - Class dashboard (active + archived)
- **Class Stream (per class)**
  - Assignments feed
  - Lessons feed
  - Teacher modals for creating assignments/lessons and generating AI lessons
- **Assignments**
  - Teacher creates assignments (title, description, optional due date, optional attachment)
  - Student “turn in” submission
  - Teacher views all submissions and returns grades + feedback
  - Classwork aggregation view (“All Tasks”)
  - Grades summary (“My Grades” / “Grading Queue”)
- **Lesson System (Notebook Blocks)**
  - Teacher lesson editor with block insertion, ordering, deletion, save/publish/present
  - Lesson status (`DRAFT`, `PUBLISHED`, `LIVE`) stored in DB
  - Lesson blocks stored as ordered `LessonBlock` records
- **Interactive Blocks**
  - **TEXT** explanation blocks
  - **DISCUSSION** prompt blocks
  - **CODE** notebook blocks with runnable JavaScript cells (sandboxed iframe runtime)
  - **EXERCISE** multiple-choice “check for understanding”
  - **QUIZ** realtime “live pulse quiz” (teacher start/stop; student submit; live results/leaderboard)
  - **WRITTEN_QUIZ** written response evaluated by AI (score + feedback)
  - **INTERACTIVE_SIMULATION** sandboxed simulation canvas with state/step timeline + hint/solution panels
- **AI Tutor**
  - Lesson-context chat assistant sidebar during live lessons
  - Written answer evaluation endpoint for written exercises
  - AI lesson generation (multi-step plan → content) and per-block AI refinement (teacher only)
- **Attendance System**
  - Teacher roster day view with manual present/absent toggles
  - Automatic attendance based on live online presence (“online = present”)
  - Student attendance history view (“my attendance”)
  - Live online presence tracking via Socket.IO presence channels
- **Realtime Classroom Orchestration (Teacher Live Controls)**
  - Lock/unlock chat during live session
  - Trigger “competition” phase and “podium/leaderboard” overlay

## Section 3 — Low Level Description (Per Feature)

### Feature: Authentication & Session Handling

- **Purpose**
  - Authenticate users and persist session for API calls and role-based UI.
- **Who can access**
  - Teacher and Student.
- **UI elements**
  - Role toggle: **Student / Teacher** (login/register and first-time Google sign-in role selection).
  - Inputs: email, password, (register: full name).
  - Buttons/controls: Google Sign-In, Sign in / Create account, Forgot?, Help/Privacy/Terms links.
- **Behavior**
  - Stores JWT token in `localStorage` and injects `Authorization: Bearer <token>` for API calls.
  - 401 responses clear token + user and redirect to `/login`.
  - Tokens carry `userId` and `role`; middleware normalizes older tokens (supports `payload.id`).
- **Data flow**
  - Frontend → `frontend/src/services/api.js` → backend endpoints:
    - `POST /api/auth/register`
    - `POST /api/auth/login`
    - `POST /api/auth/google`
    - `GET /api/auth/me`
    - `PATCH /api/auth/me`
    - `PATCH /api/auth/me/password`
- **Interactions with other features**
  - Role (`TEACHER`/`STUDENT`) gates actions across classes, lessons, attendance, assignments.

### Feature: Classes (Create/Join/List/Archive)

- **Purpose**
  - Organize students into teacher-owned classes and provide a class stream.
- **Who can access**
  - Teacher: create, view own, archive/unarchive.
  - Student: view enrolled, join by code.
- **UI elements**
  - Dashboard card grid of classes.
  - Teacher: “Create class” modal (name, section).
  - Student: “Join class” modal (class code).
  - Class card actions menu (teacher): open, copy code, archive.
  - Archived classes page: restore button (teacher).
- **Behavior**
  - Teacher creates class with generated 6-char `class_code`.
  - Student join validates role, ensures not archived, and prevents duplicate enrollment.
  - Archive marks class as archived; archived class disables new lessons/assignments creation in stream UI and backend checks.
- **Data flow**
  - Frontend: `classService` in `frontend/src/services/api.js`.
  - Backend endpoints in `backend/routes/classes.js`:
    - `GET /api/classes?archived=(false|true|all)`
    - `GET /api/classes/:id`
    - `POST /api/classes` (Teacher-only)
    - `POST /api/classes/join` (Student-only)
    - `PATCH /api/classes/:id/archive` (Teacher-only, owner-only)
    - `PATCH /api/classes/:id/unarchive` (Teacher-only, owner-only)
- **Interactions with other features**
  - Class ownership (`teacher_id`) gates lessons, assignments, and attendance actions.
  - Class archived state prevents lesson/assignment creation and lesson editing.

### Feature: Class Stream (Assignments + Lessons feed)

- **Purpose**
  - Central per-class page to browse lessons and assignments and start teacher workflows.
- **Who can access**
  - Teacher and Student (different actions shown).
- **UI elements**
  - Lessons list with status chip (Draft/Published/Live).
  - Assignments list; teacher actions include create + grade + delete.
  - Teacher modals:
    - Create Assignment (title, description, due date)
    - Manual Lesson (lesson title)
    - Generate Lesson with AI (topic, optional reference content, target audience, duration)
  - “Class details” info modal.
  - Teacher “New Assignment” FAB.
- **Behavior**
  - Fetches assignments, lessons, and class info concurrently.
  - Prevents create/generate actions if class is archived (UI guard + backend guard).
- **Data flow**
  - Uses `assignmentService.getByClass`, `lessonService.getByClass`, `classService.getById`.
  - Presence join/leave emitted via Socket.IO for attendance auto-marking support.
- **Interactions with other features**
  - Navigates teacher to lesson editor (`/lesson/edit`) or student to live lesson (`/lesson/live`) when selecting a lesson.

### Feature: Assignments (Create/Submit/Grade/Delete)

- **Purpose**
  - Distribute tasks and collect submissions; enable teacher grading and student progress.
- **Who can access**
  - Teacher: create, view submissions, grade, delete.
  - Student: view, submit.
- **UI elements**
  - Class stream: “New Assignment”, “Grade Submissions” / “Grade”, “Delete”.
  - Assignment view:
    - Student: submission textarea + “Turn in”.
    - Teacher: “Grade submissions”, “Back to class stream”.
  - Grading dashboard:
    - Search students input.
    - Score input (/100), feedback textarea.
    - Buttons: “Return to Student”, “Save Draft”.
    - “Open Link” for submission.
- **Behavior**
  - Student submission is created as a `Submission` record (stores `file_url`).
  - Teacher grading updates `grade` and `feedback` on submission.
  - Grading drafts are stored in `localStorage` until returned.
- **Data flow**
  - Frontend: `assignmentService` in `frontend/src/services/api.js`.
  - Backend endpoints in `backend/routes/assignments.js`:
    - `GET /api/assignments/class/:classId`
    - `GET /api/assignments/:id`
    - `POST /api/assignments` (Teacher-only; owner-only; archived guard)
    - `POST /api/assignments/:id/submit` (Student-only)
    - `GET /api/assignments/:id/submissions` (Teacher-only; owner-only)
    - `PUT /api/assignments/submissions/:submissionId/grade` (Teacher-only)
    - `DELETE /api/assignments/:id` (Teacher-only; owner-only)
- **Interactions with other features**
  - Calendar, Classwork, Grades pages aggregate and display assignments across classes.

### Feature: Classwork Aggregation (“All Tasks”)

- **Purpose**
  - A unified list of assignments across all classes.
- **Who can access**
  - Teacher and Student.
- **UI elements**
  - Assignment list cards linking to assignment detail page.
- **Behavior**
  - Fetch classes → fetch assignments for each → flatten and sort by due date.
- **Data flow**
  - Uses `classService.getClasses()` and `assignmentService.getByClass()`.
- **Interactions with other features**
  - Uses student `completed` flag computed server-side on `GET /assignments/class/:classId` (student role only).

### Feature: Grades

- **Purpose**
  - Teacher: a quick “grading queue” linking to grading pages.
  - Student: view grade status per assignment.
- **Who can access**
  - Teacher and Student.
- **UI elements**
  - Teacher: “Open Grading” links.
  - Student: grade display or “Not graded”.
- **Behavior**
  - Teacher: lists assignments across classes.
  - Student: for each assignment, fetches assignment detail to read submission grade (can be expensive; it makes per-assignment detail calls).
- **Data flow**
  - Uses `classService.getClasses()`, `assignmentService.getByClass()`, and (student) `assignmentService.getById()`.
- **Interactions with other features**
  - Driven by grading actions in the assignment grading dashboard.

### Feature: Calendar (“Classroom Planner”)

- **Purpose**
  - Visualize assignment due dates in month/week views and browse upcoming tasks.
- **Who can access**
  - Teacher and Student.
- **UI elements**
  - View mode toggle: Month / Week.
  - Class filter select: All classes or specific class.
  - Buttons: Today, previous/next period chevrons.
  - Clickable day cells that select a date.
  - Task cards linking to assignment details.
- **Behavior**
  - Aggregates assignments across classes; groups by due date and renders chips/cards.
  - Student task status includes Completed/Overdue/Due today/Upcoming (uses `completed` flag from list endpoint).
- **Data flow**
  - Uses `classService.getClasses()` and `assignmentService.getByClass()`.
- **Interactions with other features**
  - Navigates into assignment detail, which drives submission and grading.

### Feature: Lesson System (Lesson CRUD + Editor + Publishing)

- **Purpose**
  - Create, edit, publish, and present interactive notebook lessons composed of blocks.
- **Who can access**
  - Teacher: create/update/delete, AI generation/refinement, present live.
  - Student: view live lesson content and interact with interactive blocks.
- **UI elements**
  - Lesson list in class stream.
  - Lesson editor:
    - Title input
    - Top actions: Save, Publish, Present
    - Block insertion buttons (Text/Code/Exercise/Quiz/Prompt/Written/Simulation)
    - Per-block controls: move up/down, AI refine, delete
    - AI refine modal: instructions textarea + Cancel / Apply AI Refinement
  - Live lesson view:
    - Notebook content stream
    - Chat/Podium sidebar toggle (students)
    - TeacherControlPanel (teachers only)
- **Behavior**
  - Blocks are stored ordered; updating a lesson replaces all blocks in DB with new ordering.
  - Publish sets status to `PUBLISHED`; Present navigates to live view and uses realtime events.
- **Data flow**
  - Frontend: `lessonService` in `frontend/src/services/api.js`.
  - Backend: `backend/routes/lessons.js`:
    - `GET /api/lessons/class/:classId`
    - `GET /api/lessons/:id` (includes ordered blocks)
    - `POST /api/lessons` (Teacher-only, owner-only, archived guard)
    - `PUT /api/lessons/:id` (Teacher-only, owner-only, archived guard; replaces blocks)
    - `DELETE /api/lessons/:id` (Teacher-only, owner-only; cascades quiz sessions/responses, chat messages, blocks)
- **Interactions with other features**
  - Live sessions integrate quiz events, AI tutor chat, and presence/attendance tracking.

### Feature: AI Lesson Generation

- **Purpose**
  - Generate a full lesson draft with required block coverage using OpenRouter.
- **Who can access**
  - Teacher only.
- **UI elements**
  - Class stream: “Generate Lesson with AI” button and modal:
    - Topic (required)
    - Reference content (optional)
    - Target audience select
    - Duration input
    - Buttons: Cancel, Generate
- **Behavior**
  - 3-step generation strategy:
    - Structure plan (sections/objectives)
    - Block strategy (types per section)
    - Full content generation
  - Enforces block coverage (ensures at least one CODE, EXERCISE, INTERACTIVE_SIMULATION, QUIZ).
  - Teacher flow: generate JSON → create empty lesson record → update lesson with generated blocks → open editor.
- **Data flow**
  - Frontend: `lessonService.generateAi(...)` → `POST /api/lessons/generate`.
  - Backend calls OpenRouter and returns `{ title, blocks }`.
- **Interactions with other features**
  - Generated blocks are the same block types used in editor and live view.

### Feature: AI Block Refinement (Teacher-only)

- **Purpose**
  - Improve a single block’s content without changing other blocks.
- **Who can access**
  - Teacher only; owner-only.
- **UI elements**
  - Lesson editor: per-block “Refine with AI” icon button.
  - Modal: instruction textarea; Cancel; Apply AI Refinement.
- **Behavior**
  - Teacher provides instructions; backend validates block type and ownership and returns refined content.
  - Refinement preserves schema based on block type (TEXT string, QUIZ object, CODE string or notebook object, etc.).
- **Data flow**
  - Frontend: `lessonService.refineBlockAi(lessonId, payload)` → `POST /api/lessons/:id/refine-block`.
- **Interactions with other features**
  - Helps iteratively improve lesson blocks used in live sessions.

### Feature: Live Lesson Session (Realtime + Sidebar)

- **Purpose**
  - Deliver lesson content in a live format with realtime quizzes and teacher orchestration.
- **Who can access**
  - Teacher and Student.
- **UI elements**
  - Top nav: Stop Presenting (teacher) / Exit Live Session (student)
  - Sidebar tabs: Chat / Podium
  - Fullscreen ranking overlay with close button
  - TeacherControlPanel (teacher-only): COMPETITION, PODIUM, LOCKED/OPEN chat, live analytics (student count, understanding percent)
- **Behavior**
  - Loads lesson blocks and normalizes content types (JSON blocks, simulation legacy formats, code notebook).
  - Socket.IO room join: `join_lesson` updates per-lesson “attendance_updated” count.
  - Maintains quiz active state, quiz results, and competitive leaderboard on `answer_received`.
  - Chat can be locked/unlocked by teacher; student can’t send when locked.
  - Presence join/leave to class presence room for attendance auto-marking.
- **Data flow**
  - REST: `GET /api/lessons/:id` for lesson content.
  - Socket.IO events (backend `backend/index.js`):
    - Join: `join_lesson` → server emits `attendance_updated`
    - Quiz: `start_quiz` → `quiz_started`; `stop_quiz` → `quiz_stopped`; `submit_answer` → `answer_received`
    - Chat: `chat_lock` → `chat_locked`; `chat_unlock` → `chat_unlocked`
    - Competition/podium: `start_final_quiz`; `show_leaderboard`
    - Presence: `join_class_presence`/`leave_class_presence` → `class_presence_updated`
- **Interactions with other features**
  - Attendance feature reads presence to auto-mark students present.
  - AI Tutor uses lesson context to help students during live sessions.

### Feature: Interactive Quiz (Realtime “Live Pulse Quiz”)

- **Purpose**
  - Teacher-controlled timed multiple-choice quiz with realtime participation and results.
- **Who can access**
  - Teacher: starts/stops quiz; sees results.
  - Student: answers when active; sees results after submit; auto-submits when timer hits 0 if selected.
- **UI elements**
  - Teacher: Start Quiz / Finish Quiz
  - Student: answer option buttons + Submit Answer
  - Timer chip with countdown
  - Results bars with percentages (teacher or after submission)
- **Behavior**
  - Uses Socket.IO events to synchronize start/stop and answer submissions.
  - Server awards score based on time left (or accepts `pointsEarned` if provided).
- **Data flow**
  - Socket.IO: `start_quiz`, `stop_quiz`, `submit_answer`, `answer_received`.
- **Interactions with other features**
  - Leaderboard and “understanding percent” computed from quiz results to display in teacher panel.

### Feature: Exercise (MCQ “Check for Understanding”)

- **Purpose**
  - Self-contained multiple choice check with feedback (local-only; not realtime).
- **Who can access**
  - Teacher authors in editor; Students interact in live view.
- **UI elements**
  - Option buttons
  - “CHECK ANSWER” button
  - Feedback text displayed after submit
- **Behavior**
  - Tracks selected option and “submitted” state locally in live view.
  - After submission, highlights correct/incorrect and shows option feedback.
- **Data flow**
  - No backend write; content comes from lesson block JSON.
- **Interactions with other features**
  - Complements quizzes; does not affect leaderboard.

### Feature: Written Quiz (AI-evaluated short answer)

- **Purpose**
  - Collect a written response and get AI scoring/feedback against an “ideal answer”.
- **Who can access**
  - Student: submits answer.
  - Teacher: sees ideal answer hint in UI (does not submit).
- **UI elements**
  - Student: answer textarea + “Submit Answer”
  - After evaluation: score out of 10 + feedback + “Re-evaluate” button
  - Teacher view: ideal answer panel
- **Behavior**
  - Calls AI evaluation endpoint and parses `SCORE: X/10` from model output.
  - “Re-evaluate” resets local state (it does not store a durable grade).
- **Data flow**
  - `POST /api/lesson-chat/evaluate-answer` with question, idealAnswer, studentAnswer.
- **Interactions with other features**
  - Pairs with lesson authoring; “idealAnswer” is authored in editor.

### Feature: Code Notebook Block (Sandboxed JS cells)

- **Purpose**
  - Provide a notebook-like block with runnable JavaScript in the browser.
- **Who can access**
  - Teacher authors in editor; Students can edit/run in live session (current implementation passes `editable` in live view).
- **UI elements**
  - Per-cell: title input (editable), code textarea, “Run”, move up/down, delete
  - Notebook: “Clear Output”, “Add Cell” (editable), “Run All”
  - Output iframe panel
- **Behavior**
  - Runs in sandboxed iframe; captures console output and exposes helper runtime:
    - `display/print/info/warn/error/html/table/plot/fetchJson/importLib`
  - Auto-resolves imports via `https://esm.sh/<specifier>?bundle`.
  - Shift+Enter runs current cell; “Run All” runs through last cell.
- **Data flow**
  - Purely client-side execution; lesson block content is saved/loaded via lesson CRUD.
- **Interactions with other features**
  - Used as a learning block inside lessons; can support simulation-like interactive coding.

### Feature: Interactive Simulation Block (Sandboxed canvas + state timeline)

- **Purpose**
  - Run an interactive simulation in a sandbox with built-in state visualization tools.
- **Who can access**
  - Teacher authors (HTML/CSS/JS, libs, input JSON, hint/solution) in editor; Students interact in live view.
- **UI elements**
  - Runtime controls: Reset, Hint/Hide Hint, Solution/Hide Solution, Show/Hide State, Clear State View
  - Panels: Runtime status (Running/Loading/Error), runtime error box, input JSON error box
  - State view: Current State + Timeline + Runtime Notes
- **Behavior**
  - Simulation runs in sandboxed iframe; uses `postMessage` to report:
    - `ready`, `error`, `state`, `step`, `log`
  - Simulation JS receives `context` with:
    - `context.app`, `context.input`, and `context.helpers` (setState/replaceState/getState/emitStep/log and small helper utilities).
  - External libraries are injected via `<script src="...">` from allowed URL list.
- **Data flow**
  - Purely client-side runtime; authored content stored in lesson blocks as JSON.
- **Interactions with other features**
  - AI lesson generation ensures a simulation block exists; editor allows simulation preview.

### Feature: AI Tutor Chat Assistant (Lesson-context)

- **Purpose**
  - Provide in-session tutoring using lesson content as context.
- **Who can access**
  - Teacher and Student during live session (chat may be locked by teacher).
- **UI elements**
  - Chat message list
  - Quick prompts: “Explain Formula”, “Summarize”
  - Input field + send button
  - Locked state placeholder text when teacher locks chat
- **Behavior**
  - Sends full message history plus lessonId to backend, which fetches lesson blocks and builds a context prompt.
  - Backend instructs AI to be helpful and guide rather than directly answering.
- **Data flow**
  - `POST /api/lesson-chat/message` with `{ lessonId, messages }`.
  - Backend: loads lesson and blocks and forwards to OpenRouter chat completions.
- **Interactions with other features**
  - TeacherControlPanel can lock/unlock chat for classroom management.

### Feature: Attendance (Manual + Automatic + Student History)

- **Purpose**
  - Record daily attendance per class, supporting manual marking and automatic marking based on online presence.
- **Who can access**
  - Teacher: view roster snapshot per day; manual and automatic marking.
  - Student: view own attendance records summary/history.
- **UI elements**
  - Filters: class select; (teacher only) date input
  - Teacher buttons:
    - Auto Mark (Online = Present)
    - Save Manual Attendance
    - Refresh
  - Per-student present/absent toggle buttons; online status chip (Online/Offline)
  - Student: summary counters + records table
- **Behavior**
  - Teacher day snapshot merges enrollment roster with any existing attendance records; defaults missing records to ABSENT.
  - Manual save uses upserts per student/day with mode `MANUAL`.
  - Automatic marks PRESENT for online students (from presence store), ABSENT otherwise; mode `AUTO`.
  - Student endpoint forbids teachers and requires enrollment in class.
- **Data flow**
  - Backend: `backend/routes/attendance.js`
    - `GET /api/attendance/class/:classId/day` (Teacher-only)
    - `POST /api/attendance/class/:classId/day/manual` (Teacher-only)
    - `POST /api/attendance/class/:classId/day/automatic` (Teacher-only)
    - `GET /api/attendance/my?classId=...` (Student-only)
  - Presence input: `backend/services/presenceStore.js` + Socket.IO presence events in `backend/index.js`.
- **Interactions with other features**
  - Presence is updated when users enter class stream and live lesson pages (they emit join/leave presence).

### Feature: Teacher Live Orchestration (Competition / Podium / Chat Lock)

- **Purpose**
  - Give teachers session-level controls during live lessons.
- **Who can access**
  - Teacher only.
- **UI elements**
  - Floating TeacherControlPanel:
    - COMPETITION button
    - PODIUM button
    - LOCKED/OPEN chat toggle
    - student count indicator
    - “understanding %” indicator
- **Behavior**
  - Emits Socket.IO events to broadcast session phase/overlays and chat lock state.
- **Data flow**
  - Socket.IO emits: `start_final_quiz`, `show_leaderboard`, `chat_lock`, `chat_unlock`.
- **Interactions with other features**
  - Affects AI chat availability (locked state) and triggers leaderboard overlays driven by quiz submissions.

### Feature: “Admin capabilities”

**Important note (implemented vs implied):**

- The codebase implements **Teacher vs Student** role checks (`requireTeacher` middleware and explicit student-only checks), but it does **not** implement a distinct `ADMIN` role or a dedicated admin panel in routes/components that were found.
- Most “admin-like” capabilities are **teacher capabilities**:
  - Class creation/archival
  - Lesson creation/editing/publishing/presenting/AI generation/refinement
  - Assignment creation/deletion/grading
  - Attendance management

## Section 4 — UI Blocks (Reusable Blocks)

This project uses “lesson blocks” (stored as `LessonBlock.type` + `LessonBlock.content`) and renders them in both the editor and live view. Below, “Props” refer to React component props, and “content schema” refers to stored block content.

### Block: LessonBlock (Orchestrator / Renderer)

- **Where**
  - Editor: `frontend/src/pages/LessonEditor.jsx` (`renderBlock`)
  - Live view: `frontend/src/pages/LiveLessonView.jsx` (block loop)
- **Props**
  - Editor passes block objects with `localId`, `type`, `content`.
  - Live view uses blocks from API (`id`, `type`, `content`) normalized in `normalizeLessonBlock`.
- **Buttons**
  - Editor per-block: move up, refine with AI, delete, move down.
- **Behavior**
  - Switches rendering by `block.type`.
  - Ensures object content is parsed for JSON block types and special handling for simulation and code notebook formats.

### Block: ExplanationBlock (TEXT)

- **Content schema**
  - `content`: string
- **Editor UI**
  - Textarea for explanation content.
  - Label: “Explanation”.
- **Live UI**
  - Read-only text (whitespace preserved).
- **Placement**
  - Within lesson content stream.

### Block: DiscussionBlock (DISCUSSION)

- **Content schema**
  - `content`: string prompt
- **Editor UI**
  - Textarea: “What should students discuss?”
- **Live UI**
  - Prompt card with quoted prompt.

### Block: CodeNotebookBlock (CODE)

- **Component**
  - `frontend/src/components/CodeNotebookBlock.jsx`
- **Content schema**
  - Either:
    - legacy string JavaScript (split into cells by `// %%`)
    - notebook object: `{ version, language, runtime, cells: [{ id, title, code }] }`
- **Props**
  - `content` (or `code`), `onChange`, `editable`, `blockId`
- **Buttons/controls**
  - Per-cell: Run, Move up, Move down, Delete cell
  - Notebook: Clear Output, Add Cell, Run All
- **Behavior**
  - Sandboxed iframe execution; output captured to an output iframe; import rewriting to esm.sh.

### Block: ExerciseBlock (EXERCISE)

- **Content schema**
  - `{ question: string, options: [{ text, isCorrect, feedback? }...] }`
- **Editor UI**
  - Question input
  - Options list with:
    - radio to set correct option
    - option text input
    - feedback input (exercise only)
    - delete option button
  - “Add Option” button
- **Live UI**
  - Option buttons; “CHECK ANSWER” button; feedback on submit.
- **Behavior**
  - Local state per block in live view (selectedIndex/submitted).

### Block: QuizBlock (QUIZ)

- **Component**
  - `frontend/src/components/InteractiveQuiz.jsx`
- **Content schema**
  - `{ question: string, options: [...], timeLimit: number }`
- **Props**
  - `block`, `userRole`, `isActive`, `onStart`, `onStop`, `onSubmit`, `results`
- **Buttons/controls**
  - Teacher: Start Quiz / Finish Quiz
  - Student: answer selection; Submit Answer
- **Behavior**
  - Controlled by Socket.IO start/stop; timer countdown; results visualization.

### Block: WrittenQuizBlock (WRITTEN_QUIZ)

- **Component**
  - `frontend/src/components/WrittenQuiz.jsx`
- **Content schema**
  - `{ question: string, idealAnswer: string }`
- **Props**
  - `block`, `userRole`
- **Buttons/controls**
  - Student: Submit Answer; Re-evaluate
- **Behavior**
  - Calls AI evaluation endpoint and displays feedback + score.

### Block: SimulationBlock (INTERACTIVE_SIMULATION)

- **Component**
  - `frontend/src/components/InteractiveSimulationBlock.jsx`
- **Content schema**
  - `{ title, description, hint, solutionText, html, css, js, libs, height, inputJson }`
- **Props**
  - `block`, optional `compact` (editor preview uses `compact`)
- **Buttons/controls**
  - Reset
  - Hint / Hide Hint (if hint present)
  - Solution / Hide Solution (if solutionText present)
  - Show State / Hide State
  - Clear State View
- **Behavior**
  - Sandboxed iframe; postMessage protocol for ready/error/state/step/log.

### Block: AttendanceBlock (Page-level)

- **Where**
  - `frontend/src/pages/PeoplePage.jsx` (attendance module is page-level rather than a reusable lesson block).
- **Props**
  - N/A (page component).
- **Buttons/controls**
  - Teacher: Auto Mark, Save Manual Attendance, Refresh, per-student Present/Absent toggles.
- **Behavior**
  - Pulls roster + records and merges with presence updates.

## Section 5 — Buttons & Controls (Inventory)

Below is a practical inventory of the user-facing controls by area. Labels are taken from the UI text; some icon-only controls include their `title`/intent.

### Global / Navigation

- **TopNavBar**
  - **Home (menu icon)**: navigate to `/dashboard`.
  - **Quick links (apps icon)**: toggle menu with Stream/Classwork/People/Grades/Settings.
  - **Profile avatar**: toggle profile menu.
  - **Manage your account**: navigate to `/settings`.
  - **Sign out**: clears session and routes to `/login`.
  - **Nav links**: Stream, Classwork, People, Grades.
- **Sidebar**
  - **Home**, **Calendar**, **Enrolled**, **Archived**, **Settings** links.
  - **Create Class / Join Class** (if `onJoinClass` provided): opens modal based on role.
  - **Help**, **Privacy** links.

### Authentication

- **Student / Teacher** role toggle
- **Google Sign-In** (OAuth)
- **Forgot?**: routes to password reset page
- **Sign in to Atelier / Create Account** (submit)
- **Create account / Sign in** (toggle auth mode)
- Footer links: Help Center, Privacy Policy, Terms of Service

### Dashboard (Classes)

- **View All Tasks**: navigate to `/classwork`.
- **Archived Classes**: navigate to `/archived`.
- Class card actions (teacher):
  - **more_vert**: open actions menu
  - **Open class**
  - **Copy class code**
  - **Archive class**
- **folder_open** (icon button): open class stream
- **Add New Class card**: open Create/Join modal
- Mobile FAB: **add**: open Create/Join modal
- Teacher Create Class modal:
  - **Cancel**
  - **Create**
- Student Join Class modal:
  - **Cancel**
  - **Join**

### Archived Classes

- **Back to Active Classes**
- Per class:
  - **Open class**
  - **Restore** (teacher)

### Class Stream (per class)

- **Class details (info icon)**: open class info modal
- Assignments section (teacher):
  - **New Assignment**
  - Per assignment: **Grade**, **Delete**
  - Upcoming sidebar: **Grade Submissions**
- Lessons section (teacher):
  - **Generate Lesson with AI**
  - **Manual Lesson**
  - Per lesson: **Delete**
- Teacher FAB:
  - **add**: opens Create Assignment modal
- Modals:
  - Create Assignment: **Cancel**, **Create**
  - Create Lesson: **Cancel**, **Create**
  - Generate Lesson: **Cancel**, **Generate**
  - Class Info: **Close**

### Lesson Editor (Teacher)

- Top bar:
  - **Back to Class**
  - **Save**
  - **Publish / Published**
  - **Present**
- Block controls (per block):
  - **Move up**
  - **Refine this block with AI**
  - **Delete**
  - **Move down**
- Inline add block buttons:
  - **Text**
  - **Code**
  - **Exercise**
  - **Quiz**
  - **Prompt**
  - **Written**
  - **Simulation**
- AI refine modal:
  - **Cancel**
  - **Apply AI Refinement**
- Floating add-block menu:
  - Toggle: **add / close**
  - Items: Explanation, Code Cell, Exercise MCQ, Quick Quiz, Written Quiz, Discussion Prompt, Interactive Simulation

### Live Lesson View

- Top nav:
  - Teacher: **Stop Presenting**
  - Student: **Exit Live Session**
- Sidebar tabs:
  - **Chat**
  - **Podium**
- Ranking overlay:
  - **close** button (returns to content)
- Teacher control panel:
  - **COMPETITION**
  - **PODIUM**
  - **LOCKED / OPEN** (chat lock toggle)
- Mobile bottom nav:
  - **Exit**

### Interactive Quiz (QUIZ)

- Teacher:
  - **Start Quiz**
  - **Finish Quiz**
- Student:
  - Option buttons (A/B/C/D…)
  - **Submit Answer**

### Exercise (EXERCISE)

- Option buttons
- **CHECK ANSWER**

### Written Quiz (WRITTEN_QUIZ)

- Student:
  - **Submit Answer**
  - **Re-evaluate**

### Simulation (INTERACTIVE_SIMULATION)

- **Reset**
- **Hint / Hide Hint** (if hint present)
- **Solution / Hide Solution** (if solutionText present)
- **Show State / Hide State**
- **Clear State View**

### Code Notebook (CODE)

- Notebook:
  - **Clear Output**
  - **Add Cell** (editable)
  - **Run All**
- Per cell:
  - **Run**
  - **Move up**
  - **Move down**
  - **Delete cell**
- Keyboard:
  - **Shift + Enter** runs current cell

### Attendance (People page)

- Filters:
  - Class `<select>`
  - Teacher-only Date `<input type="date">`
- Teacher actions:
  - **Auto Mark (Online = Present)**
  - **Save Manual Attendance**
  - **Refresh**
  - Per student: **Present**, **Absent**
- Student view:
  - No action buttons; table view of records.

### Assignment View

- **Back to Classwork**
- Teacher sidebar:
  - **Grade submissions**
  - **Back to class stream**
- Student sidebar:
  - Submission textarea
  - **Turn in**
- Attachments:
  - **open_in_new** (open attachment link)

### Assignment Grading

- Top:
  - **arrow_back** (back)
- Student list:
  - Search input
  - Click student row to select
- Submission:
  - **Open Link** (if provided)
- Grading actions:
  - **Return to Student**
  - **Save Draft**

### Settings

- Profile:
  - Inputs: Display Name, Avatar URL
  - **Save Profile**
- Notifications:
  - Toggle buttons for:
    - Assignments
    - Due Soon Reminders
    - Announcements
  - **Save Notifications**
- Security:
  - Inputs: Current Password (if applicable), New Password, Confirm Password
  - **Change Password / Set Password**

### Utility Pages (Help/Privacy/Terms)

- **Back to Dashboard**

### Forgot Password

- **Send Reset Link**
- **Cancel**
- (After “sent”): **Back to Login**

## Section 6 — User Roles

### Teacher

- **Permissions (enforced)**
  - Can create classes.
  - Can archive/unarchive classes they own.
  - Can create/update/delete lessons for their classes.
  - Can generate lessons with AI and refine blocks with AI (requires teacher + owner + not archived).
  - Can create/delete assignments for their classes.
  - Can view all submissions and grade.
  - Can take attendance (manual/automatic) for their classes.
  - Can orchestrate live sessions (chat lock, competition, podium) via Socket.IO.
- **Controls**
  - Dashboard: Create Class, Copy class code, Archive class.
  - Class stream: New Assignment, Manual Lesson, Generate Lesson with AI, Delete Lesson/Assignment, Grade.
  - Lesson editor: Save/Publish/Present, block editing tools, AI refine.
  - Live lesson: TeacherControlPanel.
  - People page: attendance tools.
- **Admin features (teacher-as-admin)**
  - This system treats teachers as the “admins” of their own classes and content.

### Student

- **Permissions (enforced)**
  - Can join classes by code (cannot join as teacher).
  - Can view classes where enrolled.
  - Can view lessons and interact with blocks (quiz/exercise/written/simulation/code).
  - Can submit assignments (teachers cannot submit).
  - Can view only their own attendance.
  - Can view grades/status for their submissions.
- **View-only / restricted areas**
  - Cannot create/modify classes, lessons, assignments, attendance.
  - Cannot start/stop quizzes or use teacher orchestration controls.
  - Chat can be locked by teacher.
- **Interactions allowed**
  - Participate in live quiz, complete exercises, run notebook code, use simulations, chat with AI tutor, submit assignments.

## Section 7 — Page Structure

### Routes (Frontend)

Defined in `frontend/src/App.jsx`:

- **`/`**, **`/login`**: Login/Register page (role toggle + OAuth)
- **`/forgot-password`**: Reset password UX (demo behavior)
- **`/dashboard`**: Class dashboard (active classes, create/join, class actions)
- **`/class/stream?classId=...`**: Class stream (assignments + lessons + teacher actions)
- **`/assignment/:id`**: Assignment details + student submission / teacher actions
- **`/assignment/:id/grade`**: Teacher grading dashboard
- **`/lesson/edit?lessonId=...`**: Teacher lesson editor (block authoring)
- **`/lesson/live?lessonId=...`**: Live lesson view (blocks + chat + realtime quiz)
- **`/classwork`**: All assignments across classes (task list)
- **`/people`**: Attendance module (teacher roster/day view; student self view)
- **`/grades`**: Teacher grading queue / Student grades view
- **`/calendar`**: Planner for due dates (month/week)
- **`/archived`**: Archived classes list (teacher restore)
- **`/settings`**: Profile + notifications + password
- **`/help`**, **`/privacy`**, **`/terms`**: Utility pages

### Backend API (High-level)

Mounted in `backend/index.js`:

- `/api/auth` → auth & profile endpoints
- `/api/classes` → class CRUD/join/archive
- `/api/assignments` → assignments/submissions/grading
- `/api/lessons` → lesson CRUD + AI generate + AI refine
- `/api/lesson-chat` → AI tutor chat + written answer evaluation
- `/api/attendance` → attendance snapshots and marking

## Section 8 — Interaction Flow

### Flow: Teacher creates a class and enrolls students

- Teacher signs in as **TEACHER**.
- From `/dashboard`:
  - Click **Create Class** → fill name/section → **Create**.
  - Share generated **class code** with students (copy via **Copy class code**).
- Student signs in as **STUDENT**:
  - Click **Join Class** → enter code → **Join**.

### Flow: Teacher creates an assignment and grades it

- Teacher opens class stream (`/class/stream?classId=...`).
- Click **New Assignment** (or FAB) → fill fields → **Create**.
- Student opens the assignment from Classwork or Class Stream:
  - Paste work into submission textarea → **Turn in**.
- Teacher opens grading:
  - From stream: **Grade** or **Grade Submissions** or from Grades page: **Open Grading**.
  - Select a student submission → enter **Score** and **Private Feedback** → **Return to Student**.

### Flow: Teacher authors a lesson (manual or AI) and presents it

- Teacher opens class stream → under Lessons:
  - Manual: **Manual Lesson** → title → **Create**.
  - AI: **Generate Lesson with AI** → topic/audience/duration/reference → **Generate** (AI drafts lesson, app creates record and opens editor).
- Teacher opens `/lesson/edit?lessonId=...`:
  - Add blocks (Text/Code/Exercise/Quiz/Prompt/Written/Simulation).
  - Reorder blocks; optionally refine any block with AI.
  - **Save** to persist; **Publish** to mark published.
  - **Present** to open `/lesson/live?lessonId=...`.

### Flow: Student opens lesson and interacts with blocks

- Student opens class stream and clicks a lesson (routes to `/lesson/live?...`).
- Live session behavior:
  - Reads lesson blocks; normalizes JSON types.
  - Joins Socket.IO room (`join_lesson`) and class presence room (`join_class_presence`).
- Interactions:
  - **TEXT/DISCUSSION**: read content.
  - **CODE**: run cells (Run / Run All), add cells if editable, view output.
  - **EXERCISE**: choose option → **CHECK ANSWER**.
  - **QUIZ**: wait for teacher start → choose option → **Submit Answer**.
  - **WRITTEN_QUIZ**: write answer → **Submit Answer** → view score/feedback → optionally **Re-evaluate**.
  - **SIMULATION**: interact with embedded UI; use Reset/Hint/Solution/State tools.
  - **AI tutor**: use quick prompts or type → send (unless locked).

### Flow: Teacher locks chat, runs competition, shows podium

- Teacher in live session uses TeacherControlPanel:
  - Toggle **LOCKED/OPEN** to disable/enable student chat sending.
  - Click **COMPETITION** to trigger waiting/competition phase.
  - Click **PODIUM** to show ranking overlay; close overlay returns to content.

### Flow: Teacher takes attendance (manual or automatic)

- Teacher opens `/people` and selects class and date.
- System loads roster snapshot and listens for live presence updates:
  - Students online are marked “Online” (presence is tracked from class stream/live lesson).
- Teacher options:
  - Click **Auto Mark (Online = Present)** → backend marks present/absent for the day based on online presence.
  - Or toggle each student **Present/Absent** and click **Save Manual Attendance**.
- Student opens `/people`:
  - Select class → view attendance records and summary.

