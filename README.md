# Academic Atelier

## Local Development

This project uses PostgreSQL locally through Docker Compose.

### 1. Start local database

From the project root:

```bash
docker-compose up -d
```

### 2. Backend environment

`backend/.env` should include:

```env
DATABASE_URL="postgresql://admin:password@localhost:5432/atelier_dev?schema=public"
REDIS_URL=""
```

`REDIS_URL` is intentionally empty for local development so realtime presence/quiz state falls back to in-memory storage.

### 3. Apply Prisma schema

From `backend/`:

```bash
npx prisma migrate dev --name init
```

### 4. Start app servers

Open two terminals:

1. In `backend/` run:

```bash
npm run dev
```

2. In `frontend/` run:

```bash
npm run dev
```
