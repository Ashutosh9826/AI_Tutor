<context>
Project: Academic Atelier (React/Vite Frontend, Node.js/Express Backend, Prisma ORM).
Goal: Refactor the codebase to decouple the frontend and backend for a split deployment (Google Cloud Run for the API, Firebase Hosting for the UI).
</context>

<rules>
- Do not remove existing logic; only modify what is necessary for the cloud migration.
- Execute steps sequentially.
- Verify each file modification before moving to the next.
</rules>

<execution-plan>

  <step id="1" name="Database Migration">
    <target-file>backend/prisma/schema.prisma</target-file>
    <instructions>
      - Change `datasource db` provider from "sqlite" to "postgresql".
      - Update the url to `env("DATABASE_URL")`.
      - Delete the `backend/prisma/migrations` folder and `backend/dev.db` file.
    </instructions>
  </step>

  <step id="2" name="Backend Network & Realtime Configuration">
    <target-file>backend/index.js</target-file>
    <instructions>
      - Run `npm install redis @socket.io/redis-adapter` in the backend directory.
      - Update Express CORS to use `process.env.FRONTEND_URL` as the origin (fallback to `http://localhost:5173`), allowing credentials.
      - Update Socket.IO CORS to match the Express CORS exactly.
      - Add Redis adapter logic: If `process.env.REDIS_URL` exists, initialize `pubClient` and `subClient` and attach `@socket.io/redis-adapter` to the `io` instance.
      - Change the server listen port to use `process.env.PORT` dynamically.
    </instructions>
  </step>

  <step id="3" name="Backend Containerization">
    <target-file>backend/Dockerfile</target-file>
    <instructions>
      - Create this new file.
      - Base image: `node:18-alpine`.
      - Set WORKDIR to `/app`.
      - Copy package.json files and run `npm install`.
      - Copy remaining backend source code.
      - Run `npx prisma generate`.
      - Expose port `8080`.
      - Set CMD: `CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]`.
    </instructions>
  </step>

  <step id="4" name="Frontend Environment Linking">
    <target-file>frontend/src/services/api.js</target-file>
    <target-file>frontend/src/pages/LiveLessonView.jsx (and any other Socket.IO initializations)</target-file>
    <instructions>
      - Replace hardcoded `http://localhost:3000` strings with dynamic Vite variables: `import.meta.env.VITE_API_URL || 'http://localhost:3000'`.
      - Ensure the Socket.IO client connection uses this same dynamic variable.
    </instructions>
  </step>

</execution-plan>

<output-requirements>
After completing the plan, provide a strict markdown list of the exact Environment Variables I need to provision in Google Cloud and Firebase.
</output-requirements>