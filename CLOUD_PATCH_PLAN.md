<context>
Project: Academic Atelier (React/Vite Frontend, Node.js/Express Backend, Prisma ORM).
Goal: Patch a critical security vulnerability in the lessons API, migrate in-memory WebSocket state to Redis for horizontal scaling, and clean up leftover local database artifacts.
</context>

<rules>
- Do not modify frontend code. These are strictly backend infrastructure and security patches.
- When migrating state to Redis, ensure you handle the asynchronous nature of Redis calls (use `await`) compared to the synchronous nature of JavaScript Maps/Sets.
- Maintain all existing Socket.IO event names and API response schemas so the frontend does not break.
</rules>

<execution-plan>

  <step id="1" name="Security Patch: Lesson Authorization">
    <target-file>backend/routes/lessons.js</target-file>
    <instructions>
      - Locate `GET /api/lessons/class/:classId` and `GET /api/lessons/:id`.
      - Currently, they only require authentication. Update both routes to enforce authorization:
        - If the user is a `TEACHER`, verify they own the `classId` (or the class associated with the `lessonId`).
        - If the user is a `STUDENT`, verify they have an active `Enrollment` for the `classId` (or the class associated with the `lessonId`).
      - Return a `403 Forbidden` if the user is not authorized.
    </instructions>
  </step>

  <step id="2" name="Scaling Patch: Redis Presence Store">
    <target-file>backend/services/presenceStore.js</target-file>
    <instructions>
      - Refactor the entire file to use the global Redis client instead of local `Map` and `Set` objects.
      - Update `join_class_presence` and `leave_class_presence` to use Redis sets (e.g., `SADD class:{classId}:online {userId}`).
      - Update `getOnlineStudentIdsForClass` to query the Redis set (e.g., `SMEMBERS class:{classId}:online`).
      - Ensure you include a fallback: if `process.env.REDIS_URL` is not provided, gracefully fall back to the existing in-memory Maps for local development.
    </instructions>
  </step>

  <step id="3" name="Scaling Patch: Redis Quiz State">
    <target-file>backend/realtime/registerRealtimeHandlers.js</target-file>
    <instructions>
      - Locate the `activeQuizSessions` state (currently an in-memory object/map tracking quiz timers).
      - Refactor this to store the active quiz state and expiration times in Redis using keys like `quiz:{lessonId}:{blockId}`.
      - Ensure the quiz scoring logic reads the start time from Redis rather than local memory.
      - Like Step 2, maintain an in-memory fallback for local development if Redis is unavailable.
    </instructions>
  </step>

  <step id="4" name="Repository Cleanup">
    <target-file>backend/prisma/dev.db</target-file>
    <target-file>backend/prisma/init.sql</target-file>
    <instructions>
      - Delete these files permanently. They are legacy SQLite artifacts and should not be deployed or tracked in version control anymore.
    </instructions>
  </step>

</execution-plan>

<output-requirements>
After completing the patches, output a short summary confirming the Redis fallback logic works for local development and that the security gates are firmly in place.
</output-requirements>