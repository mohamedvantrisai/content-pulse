# Content Pulse

**Cross-Platform Content Analytics Aggregator**

Content Pulse aggregates analytics from Instagram and LinkedIn into a unified REST + GraphQL API, paired with a React dashboard. It turns scattered platform metrics into consolidated insights and deterministic, data-driven content recommendations.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 LTS / TypeScript 5.6+ |
| API | Express 4 (REST) + Apollo Server 4 (GraphQL) |
| Database | MongoDB 7 (via Mongoose 8) |
| Cache & Queue | Redis 7 (via ioredis) + BullMQ 5 |
| Frontend | React 18 + Vite 5 + Recharts |
| Testing | Jest + supertest + mongodb-memory-server |
| Infrastructure | Docker Compose (local dev) |

---

## Prerequisites

- **Node.js** ≥ 20.0.0
- **Docker** & **Docker Compose** (for local MongoDB + Redis)
- **npm** ≥ 9

---

## Quick Start

### 1. Start Infrastructure

Spin up MongoDB and Redis with a single command:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Verify both services are healthy:

```bash
docker compose -f infra/docker-compose.yml ps
```

You should see both `contentpulse-mongodb` and `contentpulse-redis` with status **healthy**.

### 2. Configure Environment

```bash
cp .env.example .env
```

Default values in `.env.example` are pre-configured for the Docker Compose setup. Update `JWT_SECRET` and `ENCRYPTION_KEY` with real values:

```bash
# Generate a random JWT secret (min 32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate a 64-char hex encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development

```bash
# API server (http://localhost:4000)
npm run dev

# Dashboard (http://localhost:5173)
npm run dev:dashboard

# Both simultaneously
npm run dev:all
```

### 5. Verify Everything Works

```bash
# Health check
curl http://localhost:4000/health

# REST API (requires Bearer token)
curl http://localhost:4000/api/v1/status -H "Authorization: Bearer any-token"

# GraphQL (requires Bearer token)
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"query": "{ health { status timestamp } }"}'
```

### 6. Open GraphQL Playground

Open **http://localhost:4000/graphql** in your browser. Apollo Sandbox loads automatically in development mode.

> **Note:** Apollo Sandbox requires internet access to load its UI from `studio.apollographql.com`. If offline, use Postman, Insomnia, or curl instead.

---

## Configuration

Environment variables are validated at startup using [Zod](https://zod.dev). Missing required variables produce immediate, descriptive errors.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `4000` | API server port |
| `NODE_ENV` | No | `development` | `development` · `production` · `test` |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `REDIS_URL` | No | `''` (disabled) | Redis URL. Empty = Redis features disabled gracefully |
| `JWT_SECRET` | **Yes** | — | JWT signing secret (min 32 chars) |
| `ENCRYPTION_KEY` | **Yes** | — | AES-256 key for token encryption (64-char hex) |
| `LOG_LEVEL` | No | `info` | `fatal` · `error` · `warn` · `info` · `debug` · `trace` |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Allowed CORS origins |

> **Note:** Redis is optional. If `REDIS_URL` is empty or Redis is unreachable, the API starts normally with caching/rate-limiting features disabled.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API server in development mode |
| `npm run dev:dashboard` | Start React dashboard dev server |
| `npm run dev:all` | Start API + Dashboard concurrently |
| `npm run build` | Build all workspaces |
| `npm run test` | Run tests across all workspaces |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run seed` | Seed the database with demo data |

---

## Infrastructure

### Services

| Service | Image | Port | Persistence |
|---------|-------|------|-------------|
| MongoDB | `mongo:7` | `localhost:27017` | Named volume (`contentpulse-mongo-data`) |
| Redis | `redis:7-alpine` | `localhost:6379` | Ephemeral (cache only) |

### Commands

```bash
# Start services
docker compose -f infra/docker-compose.yml up -d

# Check health status
docker compose -f infra/docker-compose.yml ps

# Stop services (data persists)
docker compose -f infra/docker-compose.yml down

# Stop services and wipe all data (fresh start)
docker compose -f infra/docker-compose.yml down --volumes
```

---

## Project Structure

```
content-pulse/
├── apps/
│   ├── api/                    # Express + Apollo backend
│   │   └── src/
│   │       ├── config/         # Env validation, database, redis
│   │       ├── graphql/        # GraphQL layer
│   │       │   ├── schema.ts   # Entry point — merges typeDefs + resolvers
│   │       │   ├── context.ts  # Request context (correlationId + user)
│   │       │   ├── format-error.ts  # REST-compatible error formatting
│   │       │   ├── typeDefs/   # Modular SDL by domain
│   │       │   │   ├── analytics.typeDefs.ts
│   │       │   │   ├── channel.typeDefs.ts
│   │       │   │   └── strategist.typeDefs.ts
│   │       │   └── resolvers/  # Domain resolvers (zero business logic)
│   │       │       ├── analytics.resolver.ts
│   │       │       ├── channel.resolver.ts
│   │       │       └── strategist.resolver.ts
│   │       ├── lib/            # Logger, AsyncLocalStorage context
│   │       ├── middleware/     # correlationId, auth, validation, error handler
│   │       ├── models/         # Mongoose schemas + TypeScript interfaces
│   │       ├── rest/           # REST layer
│   │       │   └── routes/v1/  # Versioned routes by domain
│   │       ├── services/       # Shared service layer (used by REST + GraphQL)
│   │       ├── utils/          # Encryption, response envelopes
│   │       ├── app.ts          # Express app + Apollo Server wiring
│   │       └── server.ts       # Entry point
│   └── dashboard/              # React + Vite frontend
├── docs/
│   ├── business-requirement-spec.md
│   └── technical-design-document.md
├── infra/
│   └── docker-compose.yml      # MongoDB + Redis containers
├── .env.example                # Template for environment variables
├── package.json                # Root workspace config
└── tsconfig.base.json          # Shared TypeScript config
```

---

## Data Models

5 Mongoose models with TypeScript interfaces, validation, indexes, and encryption:

| Model | Collection | Key Features |
|-------|-----------|--------------|
| **User** | `users` | Unique email, bcrypt password hashing, plan enum, embedded report preferences |
| **Channel** | `channels` | AES-256-GCM encrypted OAuth tokens, compound unique index, sync status tracking |
| **Post** | `posts` | Embedded metrics + history array, computed engagement rate, 4 query-optimised indexes |
| **AnalyticsSnapshot** | `analyticssnapshots` | Daily/weekly/monthly rollups, idempotent upsert via compound unique index |
| **ApiKey** | `apikeys` | bcrypt-hashed keys, prefix-based O(1) lookup, scope-based access control |

All models export TypeScript interfaces from `@contentpulse/api/src/models/index.ts`.

---

## API Endpoints

### REST API (`/api/v1`)

All REST routes require `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (no auth required) |
| GET | `/api/v1/status` | API status |
| GET | `/api/v1/analytics/overview` | Analytics overview |
| GET | `/api/v1/channels` | List channels |
| GET | `/api/v1/strategist/brief` | Content strategy brief |
| GET | `/api/v1/apikeys` | List API keys |

### GraphQL (`/graphql`)

Requires `Authorization: Bearer <token>` header (same as REST). Available queries:

| Query | Description |
|-------|-------------|
| `health` | Health status + timestamp |
| `analyticsOverview` | Aggregated analytics |
| `channelAnalytics(channelId, period)` | Per-channel analytics |
| `channels` | List all channels |
| `channel(id)` | Single channel by ID |
| `posts(channelId)` | Posts for a channel |
| `contentBrief` | Content strategy brief |
| `platformBreakdown` | Per-platform metrics |
| `timeSeries(metric, from, to)` | Time series data |

**GraphQL Playground:** Open http://localhost:4000/graphql in your browser (development only).

**Example query:**

```graphql
{
  analyticsOverview {
    totalViews
    totalEngagement
    topChannel
  }
  channels {
    id
    name
    platform
  }
}
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run API tests only
npm test --workspace=@contentpulse/api

# Run with verbose output
npm test --workspace=@contentpulse/api -- --verbose

# Run a specific test file
npm test --workspace=@contentpulse/api -- --testPathPattern=graphql
```

---

## Documentation
- [Wiki](https://github.com/mohamedvantrisai/content-pulse/wiki)

---

## License

[MIT](./LICENSE)
