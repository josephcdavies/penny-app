# CLAUDE.md

This file is read automatically at the start of every Claude Code session.
It contains the always-relevant context for this project.

---

## What We're Building

A self-hosted, open source web application that helps Technical Writers manage
document reviews with Subject Matter Experts (SMEs). TWs upload documents, assign
SMEs, and track feedback. SMEs access reviews via a unique magic link — no account
or login required. When an SME is assigned, a Slack notification is sent with their link.

This is designed to be cloned and self-hosted by other teams. Ease of setup for
end users matters. Docker support is a first-class concern.

---

## Tech Stack

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Frontend       | React (Vite)                      |
| Backend        | Node.js + Express                 |
| Database       | SQLite (via better-sqlite3)       |
| File Storage   | Local filesystem (/server/uploads)|
| Auth           | JWT (jsonwebtoken) + bcrypt       |
| Notifications  | Slack Incoming Webhooks           |
| Deployment     | Docker + docker-compose           |

---

## Project Structure

```
penny-app/
├── client/                   # React frontend (Vite)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/                   # Express backend
│   ├── routes/
│   ├── middleware/
│   ├── db/
│   │   ├── schema.sql
│   │   └── database.js
│   ├── uploads/
│   ├── slack.js
│   └── index.js
│
├── PLANNING.md               # Full feature spec and build order
├── CLAUDE.md                 # This file
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Key Conventions

- **Never use TypeScript.** Plain JavaScript only — this keeps the project approachable
  for contributors who are not experienced developers.
- **No ORMs.** Write raw SQL using better-sqlite3. Queries should be readable.
- **No CSS frameworks.** Plain CSS only, scoped per component where possible.
  Keep styles simple and functional — this is a utility tool, not a showcase.
- **No external auth providers.** JWT + bcrypt only. No Passport, no OAuth.
- **Error handling:** All Express routes must handle errors and return meaningful
  JSON error messages. Never let unhandled errors crash the server.
- **Environment variables:** All configurable values go in `.env`. Never hardcode
  URLs, secrets, or ports. Always keep `.env.example` in sync.

---

## Dev Commands

From the project root:

```bash
# Start the backend
cd server && node index.js

# Start the frontend (in a separate terminal)
cd client && npm run dev

# Start everything with Docker
docker compose up

# Rebuild Docker containers after dependency changes
docker compose up --build
```

Backend runs on port **3001** by default.
Frontend runs on port **5173** in dev mode (Vite default).

---

## Environment Variables

The app is configured entirely via `.env`. See `.env.example` for all required
variables. The minimum required to run the app locally:

```
PORT=3001
JWT_SECRET=          # Any long random string
APP_URL=             # e.g. http://localhost:5173
SLACK_WEBHOOK_URL=   # Optional — Slack notifications are skipped if not set
```

---

## Database

SQLite database file is created automatically at `server/db/database.sqlite`
on first run. Schema is defined in `server/db/schema.sql` and applied via
`server/db/database.js` at startup.

**Never modify the database file directly.** All schema changes go through
`schema.sql`. If a schema change is needed mid-project, note it clearly and
update the file — do not patch the live database manually.

---

## How Sessions Work

Each Claude Code session is stateless. At the start of a new session:
- This file (CLAUDE.md) is read automatically
- Reference PLANNING.md explicitly when working on a specific phase:
  *"Read PLANNING.md and let's continue Phase 3."*
- If picking up mid-phase, describe what was completed last session so
  context is restored quickly

---

## What This App Is Not

- Not a SaaS product — there is no hosted version
- Not a document editor — TWs upload files, SMEs download and read them
- Not an email tool — Slack is the only notification channel
- Not a versioning system — one document file per review, no version history of files
