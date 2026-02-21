# TECHNICAL DESIGN DOCUMENT

# Content Pulse

### System Architecture & Engineering Specification

<table>
  <thead>
    <tr>
      <th>Field</th>
      <th>Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Document Type</td>
      <td>Technical Design Document (TDD)</td>
    </tr>
    <tr>
      <td>Version</td>
      <td>1.0</td>
    </tr>
    <tr>
      <td>Author</td>
      <td>Mohamed Riyas</td>
    </tr>
    <tr>
      <td>Date</td>
      <td>February 21, 2026</td>
    </tr>
    <tr>
      <td>Status</td>
      <td>Draft</td>
    </tr>
    <tr>
      <td>Runtime</td>
      <td>Node.js 20 LTS / TypeScript 5.6</td>
    </tr>
    <tr>
      <td>Databases</td>
      <td>MongoDB 7 + Redis 7</td>
    </tr>
    <tr>
      <td>Platforms</td>
      <td>Instagram (Graph API) + LinkedIn (API v2)</td>
    </tr>
  </tbody>
</table>

# 1. Introduction

## 1.1 Purpose

This Technical Design Document describes the complete system architecture, data models, API design, frontend architecture, infrastructure, and engineering decisions for ContentPulse — a cross-platform content analytics aggregation platform. It is intended for developers implementing or reviewing the system.

## 1.2 Technology Stack

<table>
  <thead>
    <tr>
      <th>Layer</th>
      <th>Technology</th>
      <th>Version</th>
      <th>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Runtime</td>
      <td>Node.js</td>
      <td>20 LTS</td>
      <td>Server-side JavaScript execution</td>
    </tr>
    <tr>
      <td>Language</td>
      <td>TypeScript</td>
      <td>5.6+</td>
      <td>Type safety across entire codebase</td>
    </tr>
    <tr>
      <td>REST Framework</td>
      <td>Express</td>
      <td>4.x</td>
      <td>HTTP routing, middleware pipeline</td>
    </tr>
    <tr>
      <td>GraphQL</td>
      <td>Apollo Server</td>
      <td>4.x</td>
      <td>Schema-first GraphQL API</td>
    </tr>
    <tr>
      <td>Database</td>
      <td>MongoDB</td>
      <td>7.x</td>
      <td>Document storage (via Mongoose 8)</td>
    </tr>
    <tr>
      <td>Cache / Queue</td>
      <td>Redis</td>
      <td>7.x</td>
      <td>Caching, rate limiting, job queue (via ioredis)</td>
    </tr>
    <tr>
      <td>Job Queue</td>
      <td>BullMQ</td>
      <td>5.x</td>
      <td>Background job scheduling and processing</td>
    </tr>
    <tr>
      <td>Validation</td>
      <td>Zod</td>
      <td>3.x</td>
      <td>Runtime schema validation for inputs and env vars</td>
    </tr>
    <tr>
      <td>Auth</td>
      <td>jsonwebtoken + bcryptjs</td>
      <td>-</td>
      <td>JWT signing/verification + API key hashing</td>
    </tr>
    <tr>
      <td>Logging</td>
      <td>Pino</td>
      <td>8.x</td>
      <td>Structured JSON logging with correlation IDs</td>
    </tr>
    <tr>
      <td>Frontend</td>
      <td>React</td>
      <td>18.x</td>
      <td>Component-based UI</td>
    </tr>
    <tr>
      <td>Charts</td>
      <td>Recharts</td>
      <td>2.12</td>
      <td>Data visualization (Area, Pie, Bar charts)</td>
    </tr>
    <tr>
      <td>Build Tool</td>
      <td>Vite</td>
      <td>5.x</td>
      <td>Fast frontend bundling with HMR</td>
    </tr>
    <tr>
      <td>Testing</td>
      <td>Jest + mongodb-memory-server</td>
      <td>-</td>
      <td>Unit and integration testing</td>
    </tr>
    <tr>
      <td>HTTP Testing</td>
      <td>supertest</td>
      <td>-</td>
      <td>Express route integration testing</td>
    </tr>
    <tr>
      <td>Containers</td>
      <td>Docker + docker-compose</td>
      <td>-</td>
      <td>Local dev environment (MongoDB + Redis)</td>
    </tr>
    <tr>
      <td>CI/CD</td>
      <td>GitHub Actions</td>
      <td>-</td>
      <td>Automated lint, test, build, Docker push</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th>Stack Alignment
Every technology choice matches Buffer&#x27;s documented stack. Node.js/TypeScript/Express/MongoDB is their primary backend. This deliberate alignment demonstrates ability to contribute from day one.</th>
    </tr>
  </thead>
  <tbody>
  </tbody>
</table>

# 2. System Architecture

## 2.1 High-Level Architecture

ContentPulse follows a layered architecture pattern with clear separation of concerns. Each layer communicates only with the layer directly below it. The system exposes two API interfaces (REST and GraphQL) that share a single service layer.

## Architecture Diagram:

![Architecture Overview](./images/high-level-architecture.png)


## 2.2 Layer Responsibilities

<table>
  <thead>
    <tr>
      <th>Layer</th>
      <th>Responsibility</th>
      <th>Key Principle</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>API Gateway</td>
      <td>Cross-cutting concerns: auth, rate limiting, logging, CORS, error handling</td>
      <td>Every request passes through all middleware before reaching routes</td>
    </tr>
    <tr>
      <td>API Interface (REST + GraphQL)</td>
      <td>Request/response transformation, input validation, HTTP status codes</td>
      <td>Thin controllers — no business logic, only call service layer</td>
    </tr>
    <tr>
      <td>Service Layer</td>
      <td>All business logic, data aggregation, computation</td>
      <td>Shared between REST and GraphQL — never duplicate logic</td>
    </tr>
    <tr>
      <td>Connector Layer</td>
      <td>Platform-specific API integrations (Instagram, LinkedIn)</td>
      <td>Abstract interface; each connector normalizes data to internal schema</td>
    </tr>
    <tr>
      <td>Data Layer</td>
      <td>Database operations, caching, persistence</td>
      <td>Mongoose models + Redis clients; all DB access through models</td>
    </tr>
    <tr>
      <td>Infrastructure</td>
      <td>Dev environment, CI/CD, monitoring, background jobs</td>
      <td>Docker for local dev, GitHub Actions for CI</td>
    </tr>
  </tbody>
</table>

## 2.3 Key Architectural Decisions

<table>
  <thead>
    <tr>
      <th>Decision</th>
      <th>Choice</th>
      <th>Rationale</th>
      <th>Alternative Considered</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Dual API</td>
      <td>REST + GraphQL</td>
      <td>REST for simplicity and cURL testing; GraphQL for flexible queries and frontend efficiency</td>
      <td>REST only — rejected because GraphQL significantly reduces over-fetching for dashboard</td>
    </tr>
    <tr>
      <td>Shared Service Layer</td>
      <td>Services called by both REST routes and GraphQL resolvers</td>
      <td>Zero business logic duplication; single source of truth for all computations</td>
      <td>Separate services per API — rejected as it violates DRY</td>
    </tr>
    <tr>
      <td>Pre-aggregated Snapshots</td>
      <td>AnalyticsSnapshot collection for daily/weekly/monthly rollups</td>
      <td>Sub-200ms response for historical queries without recomputing from posts every time</td>
      <td>Real-time aggregation only — rejected for performance at scale</td>
    </tr>
    <tr>
      <td>AI Strategist: No LLM</td>
      <td>Template-based NL from MongoDB aggregation data</td>
      <td>No hallucination, deterministic, testable, zero API cost, fast (&lt; 100ms)</td>
      <td>OpenAI API — rejected for cost, latency, unpredictability, and external dependency</td>
    </tr>
    <tr>
      <td>API Key auth with prefix</td>
      <td>First 12 chars stored unhashed for O(1) lookup, full key bcrypt-hashed</td>
      <td>Allows efficient lookup without exposing the key. Same pattern as Stripe and GitHub.</td>
      <td>Hash-only — rejected because bcrypt comparison on every key in DB is O(n)</td>
    </tr>
    <tr>
      <td>Token bucket rate limiting</td>
      <td>Redis-based token bucket per API key</td>
      <td>Precise control, IETF-standard headers, per-key configurability</td>
      <td>Fixed window — rejected for burst penalty at window boundary</td>
    </tr>
    <tr>
      <td>Connector pattern</td>
      <td>Abstract BaseConnector with per-platform implementations</td>
      <td>Adding a new platform = implementing 4 methods, no changes to service layer</td>
      <td>Direct API calls in services — rejected for coupling and code duplication</td>
    </tr>
    <tr>
      <td>Monorepo with npm workspaces</td>
      <td>Single repo: @contentpulse/api + @contentpulse/dashboard</td>
      <td>Shared types, atomic commits, simpler CI, single git history</td>
      <td>Multi-repo — rejected for overhead on a single-developer project</td>
    </tr>
  </tbody>
</table>

# 3. Data Architecture

## 3.1 Database Design

MongoDB was chosen for schema flexibility, native aggregation pipeline support, and alignment with Buffer's stack. The data model uses 5 primary collections with carefully designed indexes for query performance.

### 3.1.1 User Collection

<table>
  <thead>
    <tr>
      <th>Field</th>
      <th>Type</th>
      <th>Constraints</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>_id</td>
      <td>ObjectId</td>
      <td>Primary key</td>
      <td>Auto-generated</td>
    </tr>
    <tr>
      <td>email</td>
      <td>String</td>
      <td>Required, unique, indexed</td>
      <td>User login email</td>
    </tr>
    <tr>
      <td>name</td>
      <td>String</td>
      <td>Required</td>
      <td>Display name</td>
    </tr>
    <tr>
      <td>passwordHash</td>
      <td>String</td>
      <td>Required</td>
      <td>bcrypt hash of password</td>
    </tr>
    <tr>
      <td>plan</td>
      <td>String</td>
      <td>Enum: free|pro|business, default: free</td>
      <td>Subscription tier</td>
    </tr>
    <tr>
      <td>timezone</td>
      <td>String</td>
      <td>Default: America/New_York</td>
      <td>For time-based computations</td>
    </tr>
    <tr>
      <td>emailReportPreferences</td>
      <td>Object</td>
      <td>Embedded subdocument</td>
      <td>enabled, frequency, dayOfWeek, channelIds</td>
    </tr>
    <tr>
      <td>createdAt / updatedAt</td>
      <td>Date</td>
      <td>timestamps: true</td>
      <td>Mongoose automatic</td>
    </tr>
  </tbody>
</table>

### 3.1.2 Channel Collection

<table>
  <thead>
    <tr>
      <th>Field</th>
      <th>Type</th>
      <th>Constraints</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>_id</td>
      <td>ObjectId</td>
      <td>Primary key</td>
      <td>Auto-generated</td>
    </tr>
    <tr>
      <td>userId</td>
      <td>ObjectId</td>
      <td>Required, indexed, ref: User</td>
      <td>Owner reference</td>
    </tr>
    <tr>
      <td>platform</td>
      <td>String</td>
      <td>Enum: instagram|linkedin, required</td>
      <td>Social platform identifier</td>
    </tr>
    <tr>
      <td>platformAccountId</td>
      <td>String</td>
      <td>Required</td>
      <td>Platform-specific user/account ID</td>
    </tr>
    <tr>
      <td>displayName</td>
      <td>String</td>
      <td>Required</td>
      <td>Account display name</td>
    </tr>
    <tr>
      <td>handle</td>
      <td>String</td>
      <td>Required</td>
      <td>Username/handle on platform</td>
    </tr>
    <tr>
      <td>accessToken</td>
      <td>String</td>
      <td>AES-256 encrypted</td>
      <td>OAuth access token (encrypted at rest)</td>
    </tr>
    <tr>
      <td>refreshToken</td>
      <td>String</td>
      <td>AES-256 encrypted</td>
      <td>OAuth refresh token (encrypted at rest)</td>
    </tr>
    <tr>
      <td>followerCount</td>
      <td>Number</td>
      <td>Default: 0</td>
      <td>Current follower count</td>
    </tr>
    <tr>
      <td>lastSyncedAt</td>
      <td>Date</td>
      <td>Nullable</td>
      <td>Last successful metric sync timestamp</td>
    </tr>
    <tr>
      <td>syncStatus</td>
      <td>String</td>
      <td>Enum: active|paused|error|pending</td>
      <td>Current sync state</td>
    </tr>
    <tr>
      <td>syncErrorMessage</td>
      <td>String</td>
      <td>Nullable</td>
      <td>Last sync error for debugging</td>
    </tr>
    <tr>
      <td>metadata</td>
      <td>Mixed</td>
      <td>Platform-specific</td>
      <td>Extra fields per platform</td>
    </tr>
  </tbody>
</table>

```
Compound index: { userId: 1, platform: 1, platformAccountId: 1 } unique
```

### 3.1.3 Post Collection

<table>
  <thead>
    <tr>
      <th>Field</th>
      <th>Type</th>
      <th>Constraints</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>_id</td>
      <td>ObjectId</td>
      <td>Primary key</td>
      <td>Auto-generated</td>
    </tr>
    <tr>
      <td>channelId</td>
      <td>ObjectId</td>
      <td>Required, indexed, ref: Channel</td>
      <td>Parent channel</td>
    </tr>
    <tr>
      <td>userId</td>
      <td>ObjectId</td>
      <td>Required, indexed, ref: User</td>
      <td>Owner (denormalized for query efficiency)</td>
    </tr>
    <tr>
      <td>platformPostId</td>
      <td>String</td>
      <td>Required</td>
      <td>Platform-specific post identifier</td>
    </tr>
    <tr>
      <td>platform</td>
      <td>String</td>
      <td>Required</td>
      <td>Denormalized from channel</td>
    </tr>
    <tr>
      <td>content</td>
      <td>String</td>
      <td>-</td>
      <td>Post text content</td>
    </tr>
    <tr>
      <td>mediaUrls</td>
      <td>[String]</td>
      <td>-</td>
      <td>Attached media URLs</td>
    </tr>
    <tr>
      <td>postType</td>
      <td>String</td>
      <td>Enum: text|image|video|link|carousel</td>
      <td>Content format</td>
    </tr>
    <tr>
      <td>publishedAt</td>
      <td>Date</td>
      <td>Required, indexed</td>
      <td>When the post was published</td>
    </tr>
    <tr>
      <td>metrics</td>
      <td>Object</td>
      <td>Embedded</td>
      <td>impressions, reach, engagements, likes, comments, shares, clicks, saves</td>
    </tr>
    <tr>
      <td>metricsHistory</td>
      <td>[Object]</td>
      <td>Array of snapshots</td>
      <td>Historical metric values with recordedAt timestamps</td>
    </tr>
    <tr>
      <td>engagementRate</td>
      <td>Number</td>
      <td>Computed</td>
      <td>engagements / impressions (recomputed on sync)</td>
    </tr>
  </tbody>
</table>

Indexes:
```
{ userId: 1, publishedAt: -1 } — Overview queries
```
```
{ channelId: 1, publishedAt: -1 } — Per-channel queries
```
```
{ channelId: 1, platformPostId: 1 } unique — Upsert deduplication
```
### 3.1.4 AnalyticsSnapshot Collection

<table>
  <thead>
    <tr>
      <th>Field</th>
      <th>Type</th>
      <th>Constraints</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>channelId</td>
      <td>ObjectId</td>
      <td>Required, ref: Channel</td>
      <td>Source channel</td>
    </tr>
    <tr>
      <td>userId</td>
      <td>ObjectId</td>
      <td>Required, ref: User</td>
      <td>Owner</td>
    </tr>
    <tr>
      <td>platform</td>
      <td>String</td>
      <td>Required</td>
      <td>Platform identifier</td>
    </tr>
    <tr>
      <td>period</td>
      <td>String</td>
      <td>Enum: daily|weekly|monthly</td>
      <td>Aggregation granularity</td>
    </tr>
    <tr>
      <td>date</td>
      <td>Date</td>
      <td>Required</td>
      <td>Period start date</td>
    </tr>
    <tr>
      <td>metrics</td>
      <td>Object</td>
      <td>Embedded</td>
      <td>totalPosts, totalImpressions, totalEngagements, engagementRate, followerGrowth, bestPostingHour, bestPostingDay, topPostId</td>
    </tr>
  </tbody>
</table>

```
Compound index: { channelId: 1, period: 1, date: 1 } unique
```

### 3.1.5 ApiKey Collection

<table>
  <thead>
    <tr>
      <th>Field</th>
      <th>Type</th>
      <th>Constraints</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>userId</td>
      <td>ObjectId</td>
      <td>Required, ref: User</td>
      <td>Key owner</td>
    </tr>
    <tr>
      <td>name</td>
      <td>String</td>
      <td>Required</td>
      <td>Human-friendly label</td>
    </tr>
    <tr>
      <td>keyHash</td>
      <td>String</td>
      <td>Required</td>
      <td>bcrypt hash of the full API key</td>
    </tr>
    <tr>
      <td>keyPrefix</td>
      <td>String</td>
      <td>Required, indexed</td>
      <td>First 12 characters for O(1) lookup</td>
    </tr>
    <tr>
      <td>scopes</td>
      <td>[String]</td>
      <td>Enum values</td>
      <td>analytics:read, channels:read, channels:write, posts:read, reports:read</td>
    </tr>
    <tr>
      <td>rateLimit</td>
      <td>Number</td>
      <td>Default: 60</td>
      <td>Requests per minute for this key</td>
    </tr>
    <tr>
      <td>lastUsedAt</td>
      <td>Date</td>
      <td>Nullable</td>
      <td>Updated on each authenticated request</td>
    </tr>
    <tr>
      <td>totalRequests</td>
      <td>Number</td>
      <td>Default: 0</td>
      <td>Lifetime request counter</td>
    </tr>
    <tr>
      <td>expiresAt</td>
      <td>Date</td>
      <td>Nullable</td>
      <td>Optional expiration date</td>
    </tr>
    <tr>
      <td>isActive</td>
      <td>Boolean</td>
      <td>Default: true</td>
      <td>Soft revocation flag</td>
    </tr>
  </tbody>
</table>

## 3.2 Data Flow Diagrams

### 3.2.1 Analytics Overview Request Flow

```
Client → GET /api/v1/analytics/overview?start=2026-01-01&end=2026-01-31
  │
  ├─ Auth Middleware: verify API key or JWT → attach userId to req
  ├─ Rate Limiter: check Redis token bucket → set RateLimit-* headers
  ├─ Route Handler: parse & validate query params (Zod)
  │
  ├─ AnalyticsService.getOverview(userId, start, end)
  │   ├─ Pipeline 1: Post.aggregate → current period totals
  │   ├─ Pipeline 2: Post.aggregate → previous period totals
  │   ├─ Pipeline 3: Post.aggregate → group by platform
  │   ├─ Pipeline 4: Post.aggregate → group by date (time series)
  │   ├─ Pipeline 5: Post.find → top 10 by engagementRate
  │   └─ All 5 run in parallel via Promise.all()
  │
  └─ Response: { data: { totalImpressions, ..., timeSeries[], topPosts[] }, meta: { dateRange, generatedAt } }
```
#### Sequence Diagram
![AnalyticsOviewEndPointFlow](./images/analytics-overview-sequence-diagram.png)

### 3.2.2 Metric Sync Job Flow

```
BullMQ Scheduler (every 6 hours)
  │
  ├─ Fetch all channels where syncStatus = 'active'
  ├─ For each channel:
  │   ├─ ConnectorRegistry.getConnector(channel.platform)
  │   ├─ connector.getPosts(since: channel.lastSyncedAt)
  │   ├─ For each post: connector.getPostMetrics(postId)
  │   ├─ Post.findOneAndUpdate({ channelId, platformPostId }, { $set: metrics, $push: metricsHistory })
  │   ├─ Recompute engagementRate = engagements / impressions
  │   ├─ Channel.updateOne({ lastSyncedAt: now, syncStatus: 'active' })
  │   └─ On error: Channel.updateOne({ syncStatus: 'error', syncErrorMessage })
  │
  └─ Log results: { synced: N, errors: M, duration: Xms }
```
#### Sequence Diagram
![MetricSyncJobFlow](./images/metrics-sync-job-flow.png)

### 3.2.3 AI Strategist Brief Flow

```
Client → GET /api/v1/strategist/brief?channel_ids=id1,id2
  │
  ├─ Check Redis cache (key: brief:{userId}:{sorted_channel_ids_hash})
  │   └─ Cache HIT → return cached brief (TTL: 1 hour)
  │
  ├─ Cache MISS → AIStrategistService.generateBrief()
  │   ├─ Gather data (all parallel via Promise.all):
  │   │   ├─ 30-day overview (current period)
  │   │   ├─ 30-day overview (previous period for comparison)
  │   │   ├─ Content type performance breakdown
  │   │   ├─ Posting time analysis (day × hour matrix)
  │   │   ├─ Recent 10 posts for context
  │   │   └─ Channel metadata (followers, platform)
  │   │
  │   ├─ Compute insights (NO LLM):
  │   │   ├─ Performance summary (template: 'Over 30 days, X posts, Y impressions...')
  │   │   ├─ Top insight (priority: underperformance streak > best platform > best type)
  │   │   ├─ Recommendation (winning pattern → concrete next action)
  │   │   ├─ Best posting time (highest avg engagement hour)
  │   │   ├─ Content suggestion (best format + platform)
  │   │   └─ Confidence level (high: 20+ posts, medium: 8-19, low: <8)
  │   │
  │   └─ Store in Redis (TTL: 3600 seconds)
  │
  └─ Response: { summary, topInsight, recommendation, bestNextPostTime, ... }
```
#### Sequence Diagram
![AIStrategistBreifFlow](./images/ai-strategist-brief-flow.png)

# 4. Backend Architecture

## 4.1 Project Structure

```
apps/api/src/
├── server.ts                    # Express + Apollo entry point
├── config/
│   ├── env.ts                   # Zod-validated environment variables
│   ├── database.ts              # MongoDB connection with retry logic
│   ├── redis.ts                 # Redis connection (optional, graceful if unavailable)
│   └── logger.ts                # Pino structured logger
├── models/
│   ├── User.ts                  # User schema + methods
│   ├── Channel.ts               # Channel schema + encryption hooks
│   ├── Post.ts                  # Post schema + computed fields
│   ├── Analytics.ts             # AnalyticsSnapshot schema
│   └── ApiKey.ts                # ApiKey schema + generate/verify methods
├── services/
│   ├── analytics.service.ts     # Aggregation pipelines, overview, per-channel, compare
│   ├── channel.service.ts       # CRUD operations for channels
│   ├── ai-strategist.service.ts # Content brief generation (template-based)
│   ├── apikey.service.ts         # Key generation, verification, revocation
│   └── report.service.ts        # Weekly report compilation
├── rest/
│   ├── middleware/
│   │   ├── auth.ts              # Dual auth: API key + JWT
│   │   ├── rateLimiter.ts       # Redis token bucket + IETF headers
│   │   ├── errorHandler.ts      # Structured error responses
│   │   ├── requestLogger.ts     # Pino request/response logging
│   │   └── correlationId.ts     # X-Request-ID generation + propagation
│   └── routes/v1/
│       ├── analytics.routes.ts  # /api/v1/analytics/*
│       ├── channels.routes.ts   # /api/v1/channels/*
│       ├── strategist.routes.ts # /api/v1/strategist/*
│       └── apikeys.routes.ts    # /api/v1/api-keys/*
├── graphql/
│   ├── schema.ts               # SDL type definitions
│   └── resolvers/
│       ├── analytics.resolver.ts
│       ├── channel.resolver.ts
│       └── strategist.resolver.ts
├── connectors/
│   ├── base.connector.ts        # Abstract class: 4 required methods
│   ├── instagram.connector.ts   # Meta Graph API integration
│   ├── linkedin.connector.ts    # LinkedIn API v2 integration
│   └── registry.ts             # ConnectorRegistry.getConnector(platform)
├── jobs/
│   ├── queue.ts                # BullMQ connection + queue definitions
│   ├── sync-metrics.job.ts     # Periodic metric fetching (every 6hrs)
│   └── generate-snapshots.job.ts # Daily/weekly/monthly rollups
├── scripts/
│   └── seed.ts                 # Demo data generator
└── __tests__/
    ├── unit/                   # Service-level tests
    └── integration/            # Route-level tests with supertest
```

## 4.2 Middleware Pipeline

Every HTTP request passes through the middleware chain in this exact order:

<table>
  <thead>
    <tr>
      <th>Order</th>
      <th>Middleware</th>
      <th>Function</th>
      <th>On Failure</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>correlationId</td>
      <td>Generate UUID, set X-Request-ID header, add to Pino child logger</td>
      <td>Never fails</td>
    </tr>
    <tr>
      <td>2</td>
      <td>requestLogger</td>
      <td>Log method, path, start time. On response: log status, duration</td>
      <td>Never fails</td>
    </tr>
    <tr>
      <td>3</td>
      <td>CORS</td>
      <td>Allow configured origins, methods, headers</td>
      <td>403 Forbidden</td>
    </tr>
    <tr>
      <td>4</td>
      <td>express.json()</td>
      <td>Parse JSON body (limit: 1mb)</td>
      <td>400 Bad Request</td>
    </tr>
    <tr>
      <td>5</td>
      <td>auth</td>
      <td>Check X-API-Key → verify. Else check Bearer JWT → verify. Attach user + key to req</td>
      <td>401 Unauthorized</td>
    </tr>
    <tr>
      <td>6</td>
      <td>scopeValidator</td>
      <td>Compare key.scopes against route.requiredScope</td>
      <td>403 Forbidden (insufficient scope)</td>
    </tr>
    <tr>
      <td>7</td>
      <td>rateLimiter</td>
      <td>Redis token bucket. Consume 1 token. Set RateLimit-* headers</td>
      <td>429 Too Many Requests + Retry-After</td>
    </tr>
    <tr>
      <td>8</td>
      <td>Route Handler</td>
      <td>Validate input (Zod), call service, return response</td>
      <td>400/404/500 per error type</td>
    </tr>
    <tr>
      <td>9</td>
      <td>errorHandler</td>
      <td>Catch unhandled errors, format structured error response</td>
      <td>Returns structured JSON error</td>
    </tr>
  </tbody>
</table>

## 4.3 Authentication Design

### 4.3.1 API Key Authentication

```
Request: GET /api/v1/analytics/overview
Header:  X-API-Key: cp_live_a1b2c3d4e5f6_g7h8i9j0k1l2m3n4o5p6
```

```
Flow:
1. Extract key from X-API-Key header
2. Extract prefix: first 12 chars after 'cp_live_' → 'a1b2c3d4e5f6'
3. ApiKey.findOne({ keyPrefix: 'a1b2c3d4e5f6', isActive: true })  // O(1) indexed lookup
4. bcrypt.compare(fullKey, apiKeyDoc.keyHash)  // Verify full key
5. Check expiresAt if set
6. Update lastUsedAt, increment totalRequests
7. Attach { userId, scopes, rateLimit } to req
```

### 4.3.2 JWT Authentication

```
Request: GET /api/v1/analytics/overview
Header:  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

```
Flow:
1. Extract token from Authorization: Bearer header
2. jwt.verify(token, JWT_SECRET) → { userId, email, plan }
3. Attach decoded payload to req
4. JWT users get all scopes by default
```

### 4.3.3 Rate Limiting — Token Bucket Algorithm

```
Redis Key: ratelimit:{apiKeyId}
Redis Value: { tokens: number, lastRefill: timestamp }
```

```
On each request:
1. MULTI/EXEC atomic Redis operation:
   a. GET ratelimit:{keyId}
   b. Compute elapsed since lastRefill
   c. Add tokens: min(maxTokens, current + elapsed * refillRate)
   d. If tokens >= 1: consume 1, SET new state, return ALLOWED
   e. If tokens < 1: return DENIED + retryAfter seconds
```

```
Response headers (IETF draft-ietf-httpapi-ratelimit-headers):
   RateLimit-Limit: 60
   RateLimit-Remaining: 42
   RateLimit-Reset: 1707782400  (Unix epoch seconds)
```

```
On 429: Retry-After: 8  (seconds until next token available)
```

## 4.4 Error Handling

All errors follow a consistent JSON structure:

```
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date range: start must be before end",
    "details": [
      { "field": "start", "message": "Must be a valid ISO 8601 date" }
    ]
  }
}
```

<table>
  <thead>
    <tr>
      <th>Error Code</th>
      <th>HTTP Status</th>
      <th>When</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>VALIDATION_ERROR</td>
      <td>400</td>
      <td>Zod validation failure, bad query params, invalid ObjectId</td>
    </tr>
    <tr>
      <td>UNAUTHORIZED</td>
      <td>401</td>
      <td>Missing or invalid API key/JWT</td>
    </tr>
    <tr>
      <td>FORBIDDEN</td>
      <td>403</td>
      <td>API key lacks required scope</td>
    </tr>
    <tr>
      <td>NOT_FOUND</td>
      <td>404</td>
      <td>Channel, post, or resource doesn&#x27;t exist</td>
    </tr>
    <tr>
      <td>RATE_LIMITED</td>
      <td>429</td>
      <td>Token bucket exhausted</td>
    </tr>
    <tr>
      <td>INTERNAL_ERROR</td>
      <td>500</td>
      <td>Unexpected server error (logged with correlation ID)</td>
    </tr>
  </tbody>
</table>

# 5. Frontend Architecture

## 5.1 Project Structure

```
apps/dashboard/src/
├── main.tsx                     # React root mount
├── App.tsx                      # Router + layout wrapper
├── api/
│   └── client.ts               # Centralized API client (fetch wrapper)
├── types/
│   └── index.ts                # Shared TypeScript interfaces
├── hooks/
│   ├── useAnalytics.ts          # Overview data hook
│   ├── useChannelAnalytics.ts   # Per-channel data hook
│   └── useContentBrief.ts       # AI Strategist hook
├── components/
│   ├── Layout.tsx               # Header + sidebar + main content area
│   ├── KPICard.tsx              # Metric card with trend arrow
│   ├── EngagementChart.tsx       # Recharts AreaChart (impressions + engagements)
│   ├── PlatformBreakdown.tsx     # Recharts PieChart (donut style)
│   ├── ChannelCard.tsx           # Per-platform summary card
│   ├── TopPostsTable.tsx         # Ranked posts table
│   ├── DateRangeFilter.tsx       # 7d/14d/30d/60d/90d toggle buttons
│   ├── ChannelComparison.tsx     # Side-by-side BarChart
│   ├── ContentBrief.tsx          # AI Strategist brief card
│   ├── LoadingSpinner.tsx        # Loading states
│   └── ErrorBoundary.tsx         # Error display with retry
└── pages/
    ├── Overview.tsx              # Main dashboard page
    ├── ChannelDetail.tsx         # Per-channel deep dive
    └── Strategist.tsx            # Full strategist view
```

## 5.2 Component Architecture

```
App.tsx
├── Layout
│   ├── Header (logo, date filter, navigation)
│   └── Main Content Area
│       ├── Overview Page
│       │   ├── ContentBrief (AI Strategist card)
│       │   ├── KPICard × 4 (impressions, engagements, posts, avg rate)
│       │   ├── EngagementChart (AreaChart)
│       │   ├── PlatformBreakdown (PieChart) + ChannelCard × N
│       │   └── TopPostsTable
│       │
│       ├── ChannelDetail Page
│       │   ├── Channel Header (icon, name, handle, followers, sync status)
│       │   ├── Time Series Chart (with granularity toggle)
│       │   ├── Content Type BarChart
│       │   ├── Best Posting Times (heatmap/ranked list)
│       │   └── ChannelComparison (if 2 channels)
│       │
│       └── Strategist Page
│           └── Full ContentBrief with data points
```
### Component Architecture Diagram
![Diagram](./images/frontend-component-architecture.png)


## 5.3 State Management

ContentPulse uses React's built-in state management (useState + useEffect) with custom hooks. No external state library is needed for this application's complexity level.

<table>
  <thead>
    <tr>
      <th>State Type</th>
      <th>Implementation</th>
      <th>Example</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Server data</td>
      <td>Custom hooks with fetch + loading/error/data state</td>
      <td>useAnalytics(dateRange) returns { data, loading, error, refetch }</td>
    </tr>
    <tr>
      <td>UI state</td>
      <td>useState in components</td>
      <td>selectedDateRange, activeTab, expandedPost</td>
    </tr>
    <tr>
      <td>Page navigation</td>
      <td>Simple state or React Router</td>
      <td>currentPage: &#x27;overview&#x27; | &#x27;channel&#x27; | &#x27;strategist&#x27;</td>
    </tr>
    <tr>
      <td>Date range filter</td>
      <td>Lifted state in App.tsx, passed as prop</td>
      <td>dateRange = { start: Date, end: Date } derived from filter selection</td>
    </tr>
  </tbody>
</table>

## 5.4 API Client Design

```
// api/client.ts
class ApiClient {
  private baseUrl = '/api/v1';  // Vite proxy handles routing to :4000
```

```
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path, window.location.origin);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new ApiError(res.status, await res.json());
    return res.json();
  }
```

```
  // Typed methods:
  getOverview(start: string, end: string) → Promise<AnalyticsOverview>
  getChannelAnalytics(channelId: string, ...) → Promise<ChannelAnalytics>
  getContentBrief(channelIds?: string[]) → Promise<ContentBrief>
  getChannels() → Promise<Channel[]>
}
```

## 5.5 Design System

The dashboard uses a custom design system with no CSS framework (no Tailwind, no Bootstrap) to demonstrate UI engineering skills. All styling uses inline styles or CSS-in-JS.

<table>
  <thead>
    <tr>
      <th>Element</th>
      <th>Specification</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Font</td>
      <td>Inter (system fallback: -apple-system, BlinkMacSystemFont, sans-serif)</td>
    </tr>
    <tr>
      <td>Primary Color</td>
      <td>#1E40AF (blue-800)</td>
    </tr>
    <tr>
      <td>Background</td>
      <td>#F8FAFC (slate-50)</td>
    </tr>
    <tr>
      <td>Card Background</td>
      <td>#FFFFFF with 1px #E2E8F0 border, 8px border-radius, subtle shadow</td>
    </tr>
    <tr>
      <td>Text Primary</td>
      <td>#1E293B (slate-800)</td>
    </tr>
    <tr>
      <td>Text Secondary</td>
      <td>#64748B (slate-500)</td>
    </tr>
    <tr>
      <td>Positive Trend</td>
      <td>#059669 (emerald-600)</td>
    </tr>
    <tr>
      <td>Negative Trend</td>
      <td>#DC2626 (red-600)</td>
    </tr>
    <tr>
      <td>Instagram Color</td>
      <td>#E4405F</td>
    </tr>
    <tr>
      <td>LinkedIn Color</td>
      <td>#0A66C2</td>
    </tr>
    <tr>
      <td>Chart Grid</td>
      <td>#E2E8F0 (slate-200), dashed</td>
    </tr>
    <tr>
      <td>KPI Card</td>
      <td>White card, large number (28px bold), label below (14px), trend badge top-right</td>
    </tr>
    <tr>
      <td>Spacing Scale</td>
      <td>4px base unit: 4, 8, 12, 16, 24, 32, 48, 64</td>
    </tr>
  </tbody>
</table>

# 6. Connector Architecture

## 6.1 Abstract Base Connector

```
abstract class BaseConnector {
  abstract platform: 'instagram' | 'linkedin';
```

```
  abstract getProfile(accessToken: string): Promise<{
    platformAccountId: string;
    displayName: string;
    handle: string;
    followerCount: number;
    followingCount: number;
  }>;
```

```
  abstract getPosts(accessToken: string, since?: Date): Promise<{
    platformPostId: string;
    content: string;
    postType: 'text' | 'image' | 'video' | 'link' | 'carousel';
    publishedAt: Date;
    metrics: NormalizedMetrics;
  }[]>;
```

```
  abstract getPostMetrics(accessToken: string, platformPostId: string): Promise<NormalizedMetrics>;
```

```
  abstract refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }>;
}
```

## 6.2 NormalizedMetrics Interface

Both connectors normalize platform-specific metrics to this shared interface:

```
interface NormalizedMetrics {
  impressions: number;   // Times content was shown
  reach: number;         // Unique accounts that saw content
  engagements: number;   // Total interactions (likes + comments + shares + saves + clicks)
  likes: number;
  comments: number;
  shares: number;        // IG: shares, LI: reposts
  clicks: number;        // Link clicks / profile clicks
  saves: number;         // IG: saves, LI: N/A (0)
}
```

## 6.3 Platform Metric Mapping

<table>
  <thead>
    <tr>
      <th>Normalized Field</th>
      <th>Instagram Graph API</th>
      <th>LinkedIn API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>impressions</td>
      <td>insights.impressions</td>
      <td>analytics.impressionCount</td>
    </tr>
    <tr>
      <td>reach</td>
      <td>insights.reach</td>
      <td>analytics.uniqueImpressionsCount</td>
    </tr>
    <tr>
      <td>engagements</td>
      <td>insights.engagement (total)</td>
      <td>analytics.reactionCount + comments + reposts</td>
    </tr>
    <tr>
      <td>likes</td>
      <td>like_count</td>
      <td>analytics.reactionCount</td>
    </tr>
    <tr>
      <td>comments</td>
      <td>comments_count</td>
      <td>analytics.commentCount</td>
    </tr>
    <tr>
      <td>shares</td>
      <td>insights.shares (if available)</td>
      <td>analytics.shareCount / repostCount</td>
    </tr>
    <tr>
      <td>clicks</td>
      <td>insights.profile_activity_clicks</td>
      <td>analytics.clickCount</td>
    </tr>
    <tr>
      <td>saves</td>
      <td>insights.saved</td>
      <td>0 (not available)</td>
    </tr>
  </tbody>
</table>

## 6.4 Connector Registry

```
class ConnectorRegistry {
  private static connectors = new Map<string, BaseConnector>();
```

```
  static register(connector: BaseConnector) {
    this.connectors.set(connector.platform, connector);
  }
```

```
  static getConnector(platform: string): BaseConnector {
    const connector = this.connectors.get(platform);
    if (!connector) throw new Error(`No connector for platform: ${platform}`);
    return connector;
  }
}
```

```
// Registration at startup:
ConnectorRegistry.register(new InstagramConnector());
ConnectorRegistry.register(new LinkedInConnector());
```

<table>
  <thead>
    <tr>
      <th>Extensibility
Adding a new platform (e.g., TikTok) requires: 1) Implement BaseConnector methods. 2) Register in ConnectorRegistry. 3) Add platform to Channel.platform enum. Zero changes to services, routes, or frontend (auto-detected via Channel.platform).</th>
    </tr>
  </thead>
  <tbody>
  </tbody>
</table>

# 7. Infrastructure

## 7.1 Docker Compose (Local Development)

```
services:
  mongodb:
    image: mongo:7
    ports: ['27017:27017']
    volumes: [mongo-data:/data/db]
    healthcheck: mongosh --eval 'db.runCommand({ping:1})' (interval 10s)
```

```
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    healthcheck: redis-cli ping (interval 10s)
```

## 7.2 CI/CD Pipeline (GitHub Actions)

```
on: push (main), pull_request (main)
```

```
jobs:
  ci:
    steps:
      1. Checkout code
      2. Setup Node.js 20
      3. npm ci (install deps)
      4. npm run lint (ESLint)
      5. npm run test (Jest with mongodb-memory-server)
      6. npm run build (TypeScript compilation)
      7. docker build -t contentpulse-api . (verify Dockerfile)
```

## 7.3 Dockerfile (Multi-Stage)

```
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build
```

```
# Stage 2: Production
FROM node:20-alpine
RUN addgroup -g 1001 app && adduser -u 1001 -G app -s /bin/sh -D app
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER app
EXPOSE 4000
HEALTHCHECK CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/server.js"]
```

## 7.4 Environment Variables

<table>
  <thead>
    <tr>
      <th>Variable</th>
      <th>Required</th>
      <th>Default</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>PORT</td>
      <td>No</td>
      <td>4000</td>
      <td>API server port</td>
    </tr>
    <tr>
      <td>NODE_ENV</td>
      <td>No</td>
      <td>development</td>
      <td>Environment: development | production</td>
    </tr>
    <tr>
      <td>MONGODB_URI</td>
      <td>Yes</td>
      <td>-</td>
      <td>MongoDB connection string</td>
    </tr>
    <tr>
      <td>REDIS_URL</td>
      <td>No</td>
      <td>redis://localhost:6379</td>
      <td>Redis connection URL (optional)</td>
    </tr>
    <tr>
      <td>JWT_SECRET</td>
      <td>Yes</td>
      <td>-</td>
      <td>JWT signing secret (32+ chars)</td>
    </tr>
    <tr>
      <td>ENCRYPTION_KEY</td>
      <td>Yes</td>
      <td>-</td>
      <td>AES-256 key for token encryption (32 bytes hex)</td>
    </tr>
    <tr>
      <td>INSTAGRAM_APP_ID</td>
      <td>No</td>
      <td>-</td>
      <td>Meta app ID for OAuth</td>
    </tr>
    <tr>
      <td>INSTAGRAM_APP_SECRET</td>
      <td>No</td>
      <td>-</td>
      <td>Meta app secret</td>
    </tr>
    <tr>
      <td>LINKEDIN_CLIENT_ID</td>
      <td>No</td>
      <td>-</td>
      <td>LinkedIn OAuth client ID</td>
    </tr>
    <tr>
      <td>LINKEDIN_CLIENT_SECRET</td>
      <td>No</td>
      <td>-</td>
      <td>LinkedIn OAuth client secret</td>
    </tr>
    <tr>
      <td>CORS_ORIGINS</td>
      <td>No</td>
      <td>http://localhost:5173</td>
      <td>Comma-separated allowed origins</td>
    </tr>
    <tr>
      <td>LOG_LEVEL</td>
      <td>No</td>
      <td>info</td>
      <td>Pino log level</td>
    </tr>
  </tbody>
</table>

# 8. API Reference

## 8.1 REST Endpoints

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Path</th>
      <th>Auth</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>GET</td>
      <td>/health</td>
      <td>None</td>
      <td>Health check: DB + Redis + uptime</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/v1/analytics/overview?start&amp;end</td>
      <td>Required</td>
      <td>Cross-platform analytics overview</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/v1/analytics/channels/:id?start&amp;end&amp;granularity</td>
      <td>Required</td>
      <td>Per-channel analytics</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/v1/analytics/compare?channel_ids&amp;start&amp;end</td>
      <td>Required</td>
      <td>Channel comparison</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/v1/analytics/top-posts?start&amp;end&amp;sort_by&amp;limit</td>
      <td>Required</td>
      <td>Top performing posts</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/v1/channels</td>
      <td>Required</td>
      <td>List connected channels</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/v1/channels</td>
      <td>Required</td>
      <td>Connect new channel</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/v1/channels/:id</td>
      <td>Required</td>
      <td>Channel details</td>
    </tr>
    <tr>
      <td>PATCH</td>
      <td>/api/v1/channels/:id</td>
      <td>Required</td>
      <td>Update channel (pause/resume)</td>
    </tr>
    <tr>
      <td>DELETE</td>
      <td>/api/v1/channels/:id</td>
      <td>Required</td>
      <td>Disconnect channel</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/v1/strategist/brief?channel_ids</td>
      <td>Required</td>
      <td>AI content brief</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/v1/api-keys</td>
      <td>Required</td>
      <td>List API keys</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/v1/api-keys</td>
      <td>Required</td>
      <td>Create API key</td>
    </tr>
    <tr>
      <td>PATCH</td>
      <td>/api/v1/api-keys/:id</td>
      <td>Required</td>
      <td>Update key name/scopes</td>
    </tr>
    <tr>
      <td>DELETE</td>
      <td>/api/v1/api-keys/:id</td>
      <td>Required</td>
      <td>Revoke API key</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/auth/instagram/callback</td>
      <td>None</td>
      <td>Instagram OAuth callback</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/auth/linkedin/callback</td>
      <td>None</td>
      <td>LinkedIn OAuth callback</td>
    </tr>
  </tbody>
</table>

## 8.2 GraphQL Schema Summary

<table>
  <thead>
    <tr>
      <th>Type</th>
      <th>Name</th>
      <th>Arguments</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Query</td>
      <td>analyticsOverview</td>
      <td>startDate!, endDate!</td>
    </tr>
    <tr>
      <td>Query</td>
      <td>channelAnalytics</td>
      <td>channelId!, startDate!, endDate!, granularity</td>
    </tr>
    <tr>
      <td>Query</td>
      <td>compareChannels</td>
      <td>channelIds!, startDate!, endDate!</td>
    </tr>
    <tr>
      <td>Query</td>
      <td>topPosts</td>
      <td>startDate!, endDate!, sortBy, limit, platform</td>
    </tr>
    <tr>
      <td>Query</td>
      <td>channels</td>
      <td>-</td>
    </tr>
    <tr>
      <td>Query</td>
      <td>channel</td>
      <td>id!</td>
    </tr>
    <tr>
      <td>Query</td>
      <td>contentBrief</td>
      <td>channelIds</td>
    </tr>
    <tr>
      <td>Mutation</td>
      <td>connectChannel</td>
      <td>input: ConnectChannelInput!</td>
    </tr>
    <tr>
      <td>Mutation</td>
      <td>updateChannel</td>
      <td>id!, input: UpdateChannelInput!</td>
    </tr>
    <tr>
      <td>Mutation</td>
      <td>disconnectChannel</td>
      <td>id!</td>
    </tr>
    <tr>
      <td>Mutation</td>
      <td>createApiKey</td>
      <td>input: CreateApiKeyInput!</td>
    </tr>
    <tr>
      <td>Mutation</td>
      <td>revokeApiKey</td>
      <td>id!</td>
    </tr>
  </tbody>
</table>

## 8.3 Response Envelope

REST responses follow a consistent envelope:

```
// Success
{
  "data": { ... },
  "meta": {
    "dateRange": { "start": "2026-01-01", "end": "2026-01-31" },
    "generatedAt": "2026-02-12T10:30:00Z",
    "cached": false
  }
}
```

```
// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": [...]
  }
}
```

# 9. Testing Strategy

## 9.1 Testing Pyramid

<table>
  <thead>
    <tr>
      <th>Layer</th>
      <th>Tool</th>
      <th>Scope</th>
      <th>Target Coverage</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Unit Tests</td>
      <td>Jest + mongodb-memory-server</td>
      <td>Services: analytics, channel, strategist, apikey. Connectors with mocked HTTP.</td>
      <td>&gt; 80%</td>
    </tr>
    <tr>
      <td>Integration Tests</td>
      <td>Jest + supertest</td>
      <td>REST routes: full request → response with seeded data. GraphQL queries.</td>
      <td>&gt; 70%</td>
    </tr>
    <tr>
      <td>Middleware Tests</td>
      <td>Jest</td>
      <td>Auth (valid/invalid/expired), rate limiter (headers, 429), error handler.</td>
      <td>100%</td>
    </tr>
    <tr>
      <td>Manual / Smoke</td>
      <td>curl + dashboard</td>
      <td>Full end-to-end: seed → API → dashboard renders data.</td>
      <td>Key flows</td>
    </tr>
  </tbody>
</table>

## 9.2 Test Database Strategy

All automated tests use mongodb-memory-server, which spins up an in-memory MongoDB instance per test suite. This means: no external database required, tests run in parallel safely, each suite gets a clean database, CI environments need no MongoDB service.

## 9.3 Key Test Scenarios

<table>
  <thead>
    <tr>
      <th>Service</th>
      <th>Scenario</th>
      <th>Validates</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>AnalyticsService</td>
      <td>30-day overview with posts across 2 platforms</td>
      <td>Totals, platform breakdown, time series, period comparison</td>
    </tr>
    <tr>
      <td>AnalyticsService</td>
      <td>Empty date range (no posts)</td>
      <td>Returns zeroes, empty arrays, no errors</td>
    </tr>
    <tr>
      <td>AnalyticsService</td>
      <td>Single platform only</td>
      <td>Platform breakdown shows only 1 entry</td>
    </tr>
    <tr>
      <td>AIStrategist</td>
      <td>20+ posts (high confidence)</td>
      <td>Brief has &#x27;high&#x27; confidence, all sections populated</td>
    </tr>
    <tr>
      <td>AIStrategist</td>
      <td>0 posts</td>
      <td>Returns graceful &#x27;insufficient data&#x27; brief</td>
    </tr>
    <tr>
      <td>AIStrategist</td>
      <td>Underperformance streak</td>
      <td>Top insight mentions declining engagement</td>
    </tr>
    <tr>
      <td>ApiKeyService</td>
      <td>Create and verify key</td>
      <td>Generated key passes bcrypt verification</td>
    </tr>
    <tr>
      <td>ApiKeyService</td>
      <td>Revoke and re-verify</td>
      <td>Revoked key returns unauthorized</td>
    </tr>
    <tr>
      <td>Auth Middleware</td>
      <td>Valid API key</td>
      <td>Request proceeds, user attached</td>
    </tr>
    <tr>
      <td>Auth Middleware</td>
      <td>Invalid API key</td>
      <td>401 Unauthorized</td>
    </tr>
    <tr>
      <td>Auth Middleware</td>
      <td>Wrong scope</td>
      <td>403 Forbidden</td>
    </tr>
    <tr>
      <td>Rate Limiter</td>
      <td>Under limit</td>
      <td>Request passes, correct headers set</td>
    </tr>
    <tr>
      <td>Rate Limiter</td>
      <td>Over limit</td>
      <td>429 with Retry-After header</td>
    </tr>
  </tbody>
</table>

# 10. Security Considerations

<table>
  <thead>
    <tr>
      <th>Area</th>
      <th>Threat</th>
      <th>Mitigation</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Token Storage</td>
      <td>Platform tokens stolen from database</td>
      <td>AES-256 encryption at rest. Encryption key in env var, not in code.</td>
    </tr>
    <tr>
      <td>API Key Exposure</td>
      <td>Key leaked in logs or responses</td>
      <td>Full key shown only once at creation. Stored as bcrypt hash. Only prefix in API responses.</td>
    </tr>
    <tr>
      <td>Injection</td>
      <td>NoSQL injection via query params</td>
      <td>Zod validation on all inputs. Mongoose parameterized queries. No raw queries.</td>
    </tr>
    <tr>
      <td>Rate Abuse</td>
      <td>API abuse or scraping</td>
      <td>Per-key token bucket rate limiting. Configurable limits. 429 + Retry-After.</td>
    </tr>
    <tr>
      <td>CORS</td>
      <td>Cross-origin attacks</td>
      <td>Explicit origin whitelist. No wildcard in production.</td>
    </tr>
    <tr>
      <td>JWT</td>
      <td>Token theft or forging</td>
      <td>HS256 with 32+ char secret. Short expiration (24h). Refresh flow for long sessions.</td>
    </tr>
    <tr>
      <td>Dependencies</td>
      <td>Supply chain vulnerabilities</td>
      <td>npm audit in CI. Dependabot for automated updates.</td>
    </tr>
    <tr>
      <td>Error Leaking</td>
      <td>Stack traces exposed to clients</td>
      <td>Production: generic error messages. Detailed logs server-side only with correlation ID.</td>
    </tr>
  </tbody>
</table>

— End of Technical Design Document —
