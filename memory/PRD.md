# Content Pulse — Product Requirements Document

## Original Problem Statement
Implement Milestone 3: Per-Channel Analytics with drill-down views including 4 user stories:
- US-301: Per-Channel Time Series with daily/weekly/monthly granularity
- US-302: Content Type Performance Breakdown
- US-303: Best Posting Times
- US-304: Channel Comparison (Instagram vs LinkedIn)

## Architecture
- **Monorepo**: npm workspaces (`@contentpulse/api` + `@contentpulse/dashboard`)
- **Backend**: Node.js 20 + TypeScript + Express 4 (REST) + Apollo Server 4 (GraphQL), port 4000
- **Frontend**: React 18 + Vite 7 + Recharts, port 3000
- **Database**: MongoDB 7 (Mongoose 8)
- **Infrastructure**: Python FastAPI reverse proxy on port 8001 bridging to Node.js API

## User Personas
- **Creator (Alex)**: Wants time series analytics and best posting times per channel
- **Business Owner (Sarah)**: Wants content type performance breakdown and cross-channel comparison

## Core Requirements
| ID | Story | Status |
|----|-------|--------|
| US-301 | Per-Channel Time Series (daily/weekly/monthly) | DONE |
| US-302 | Content Type Performance Breakdown | DONE |
| US-303 | Best Posting Times (top 5, min 2 posts) | DONE |
| US-304 | Channel Comparison with winners | DONE |

## What's Been Implemented (March 12, 2026)

### Backend (Node.js API)
- `analytics.repository.ts`: 5 new aggregation functions (weekly/monthly time series, content type performance, best posting times, channel comparison metrics)
- `analytics.service.ts`: 4 new service functions with channel ownership validation and error handling
- `analytics.routes.ts`: 4 new REST endpoints with Zod validation
- `analytics.typeDefs.ts`: 8 new GraphQL types + 4 new queries
- `analytics.resolver.ts`: 4 new GraphQL resolvers

### Frontend (React Dashboard)
- Enhanced `ChannelDetail.tsx`: Granularity selector (Daily/Weekly/Monthly), content type performance table + chart, best posting times ranked slots
- New `Comparison.tsx`: Channel selection chips, 4 metric cards with winner badges, side-by-side bar chart
- New `comparison.css`: Complete styles for comparison page
- Updated `channel-detail.css`: Styles for granularity selector, performance table, posting slots
- Added `/comparison` route to App.tsx and nav

### REST API Endpoints Added
- `GET /api/v1/analytics/channels/:id?granularity=daily|weekly|monthly&start=&end=`
- `GET /api/v1/analytics/channels/:id/content-breakdown?start=&end=`
- `GET /api/v1/analytics/channels/:id/posting-times?start=&end=`
- `GET /api/v1/analytics/compare?channel_ids=id1,id2&start=&end=`

## Test Results
- Backend: 100% (29/29 tests passed)
- Frontend: 100% (All UI components and integrations working)

## Prioritized Backlog
### P0 (Critical)
- None remaining for Milestone 3

### P1 (Should Have)
- Full Strategist content brief computation (FR-400)
- Token bucket rate limiting (currently passthrough stub)
- Background sync jobs (BullMQ)

### P2 (Nice to Have)
- Full API key CRUD operations
- CI/CD pipeline (GitHub Actions)
- Production Dockerfile
- Connector `getPosts()`, `getPostMetrics()`, `refreshAccessToken()` implementations

## Next Tasks
- Milestone 4+ planning based on remaining BRS features
- Implement full Strategist deterministic content brief
- Add real rate limiting with Redis
- Add BullMQ background sync jobs
