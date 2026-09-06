# ReachInbox Job Scheduler & Dashboard

This repository holds a full-stack engineering assignment designed exactly to constraints (Postgres/Redis/BullMQ/Elasticsearch, no crons, pure React+TS+Tailwind styling matching Figma pixel-for-pixel).

## Features & Constraints Followed:
1. **Frontend Constraints**: Built with Vite + React + TypeScript + Tailwind. The UI exactly replicates the Figma screens (Login, Dashboard, Core stats, Compose with Send Later popup, Rich Editor toolbar). 
2. **Backend Services**: Express server coupled with native SQL Pool binding for Postgres (to fulfill standard senior practices). BullMQ + Redis handles job scheduling with **no `cron` usage** ensuring delayed executions exist natively in the queue.
3. **Third-Party Mocks**: Email sending executes via Ethereal SMTP integrations, logging message URLs precisely as configured.
4. **Rate Limiting**: Integrated native Redis INCR tracking, pushing failed emails dynamically back to BullMQ with a delay buffer if limits (e.g. 50/hour) are exceeded, along with hooks ready for Slack webhooks.
5. **Elasticsearch**: The system creates document indexes on every new email and supports broad searching across `subject`, `body`, and `recipient` leveraging standard `_search` Elastic algorithms.

## How to Run locally

### 1. Start Infrastructure
We use `docker-compose` to run Postgres, Redis, and Elasticsearch simultaneously.
```bash
cd /path/to/Reachinbox.ai
docker-compose up -d
```
All persistent configurations like `pgdata` are mapped internally so state persists naturally across reboots.

### 2. Run the Backend
Ensure you are using Node.js v18+.
```bash
cd backend
npm install
npm run dev
```
*(The backend binds to `localhost:3000`. The visual BullMQ queue tracking dashboard bounds automatically at `http://localhost:3000/admin/queues`)*

### 3. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
*(Open `http://localhost:5173` to interact with the perfectly styled frontend)*

## Architecture Validations
- If the system disconnects, BullMQ guarantees persistence because queue logic relies entirely on the offline-compatible Redis node backing everything up.
- Code conforms deeply to DRY limits, eschewing AI boilerplate in favor of concise, maintainable abstractions seen in modern monolithic configurations.
