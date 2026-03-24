<context>
Project: Academic Atelier (React/Vite Frontend, Node.js/Express Backend, Prisma ORM).
Current State: The codebase has been migrated to use PostgreSQL for cloud readiness. The local SQLite database was removed. 
Goal: Create a `docker-compose.yml` file, configure the `.env` variables, update the documentation, and autonomously execute the terminal commands to spin up the local database.
</context>

<execution-plan>
  <step id="1" name="Create Docker Compose">
    <target-file>docker-compose.yml</target-file>
    <instructions>
      - Create this file in the root of the project.
      - Add a `postgres` service using the `postgres:15-alpine` image.
      - Set environment variables: POSTGRES_USER=admin, POSTGRES_PASSWORD=password, POSTGRES_DB=atelier_dev.
      - Map port 5432 to 5432.
      - Add a persistent volume for the database data.
    </instructions>
  </step>

  <step id="2" name="Environment Variables">
    <target-file>backend/.env</target-file>
    <instructions>
      - Create or update this file to include the local database connection string:
        `DATABASE_URL="postgresql://admin:password@localhost:5432/atelier_dev?schema=public"`
      - Leave `REDIS_URL` empty so the system defaults to the local in-memory fallback for Socket.IO.
    </instructions>
  </step>

  <step id="3" name="Documentation">
    <target-file>README.md</target-file>
    <instructions>
      - Write a clear "Local Development" section detailing how to use the new Docker database and start the servers.
    </instructions>
  </step>

  <step id="4" name="Autonomous Terminal Execution">
    <target-terminal>Local Shell</target-terminal>
    <instructions>
      - Execute `docker-compose up -d` in the root directory to start the database in the background.
      - Wait 5 seconds to ensure the database is ready to accept connections.
      - Navigate to the `backend/` directory and execute `npx prisma migrate dev --name init` to apply the database schema.
    </instructions>
  </step>
</execution-plan>

<output-requirements>
After executing the terminal commands, confirm the database is running and the migrations were successful. Then, explicitly tell me to open two terminal windows and run `npm run dev` in both the `frontend` and `backend` directories to start coding.
</output-requirements>