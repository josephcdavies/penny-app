# PLANNING.md — Penny SME Review & Approval App

This is the detailed project blueprint. It is not read automatically — reference
it explicitly at the start of a session when working on a specific phase:
*"Read PLANNING.md and let's work on Phase 2."*

---

## 1. Project Goals

Build a lightweight, self-hosted web app for Technical Writers to manage document
reviews with Subject Matter Experts. The app should be simple enough to be set up
by a non-developer using Docker, and approachable enough for open source contributors.

**Design principles:**
- Simplicity over cleverness — prefer obvious code over clever code
- Every feature should serve the TW ↔ SME review workflow directly
- Setup should take under 10 minutes for a new user with Docker installed
- No feature should require a paid external service to function

---

## 2. User Roles

### Technical Writer (authenticated)
- Registers and logs in with email + password
- Uploads documents and creates review requests
- Assigns one or more SMEs per document
- Tracks review status, SME responses, and deadlines
- Views full feedback history per document

### SME (unauthenticated)
- Receives a Slack message containing a unique magic link
- Clicks the link — no account, no login
- Reads the document (download link provided)
- Leaves inline comments on specific sections
- Writes general notes
- Submits a decision: Approve, Reject, or Needs Changes
- Cannot see other SMEs' feedback on the same document

---

## 3. Full Feature List

### Authentication
- [ ] TW registration (name, email, password)
- [ ] TW login — returns JWT stored in localStorage
- [ ] Protected routes — redirect to login if no valid JWT
- [ ] Logout

### Dashboard
- [ ] List all documents created by the logged-in TW
- [ ] Show per-document: title, status badge, SME response count (X of Y), deadline
- [ ] Visual indicator for overdue and due-soon deadlines
- [ ] Link to document detail view
- [ ] Button to create a new review

### New Review
- [ ] Document title and description fields
- [ ] File upload — accepts `.md` only, max 1MB
- [ ] Add SMEs — repeating name + email fields, add/remove dynamically
- [ ] Deadline date picker
- [ ] On submit: upload file, create document record, create SME assignments,
      generate tokens, send Slack notifications

### Document Detail (TW view)
- [ ] Document title, description, status badge, deadline
- [ ] Rendered markdown preview of the uploaded file with all SME inline comments
      shown as annotations beside their referenced lines — page polls every 5 seconds
      so the TW sees feedback appear in near real-time without refreshing
- [ ] **Download reviewed file** button — always available once the document exists;
      server assembles a modified `.md` file on demand: inline comments are injected
      as blockquotes directly beneath the lines they reference
      (`> **[SME Name]:** comment text`) and general notes are appended as a fenced
      section at the end of the file. The stored source file is never modified —
      the annotated copy is built fresh at download time. TW saves this to their
      local repo, acts on the feedback, removes the annotations, and pushes to
      GitHub manually.
- [ ] SME response table: Name | Email | Status | Decision | Submitted At
- [ ] Expandable row per SME showing general notes and inline comments
      (each comment shows the line number it is anchored to)
- [ ] Revision history timeline at the bottom of the page
- [ ] Document status is derived automatically (see Status Logic below)

### SME Review Page (public, no auth)
- [ ] Accessed via `/review/:token`
- [ ] No app header or navigation — standalone page
- [ ] On load: show a name confirmation screen — display the assigned SME name and
      ask "Is this you?" with a Confirm button; the review UI is not shown until
      confirmed. This prevents accidental submissions by someone who received the
      link in error.
- [ ] Shows document title and description
- [ ] Rendered markdown preview of the document (read-only)
- [ ] Inline comment builder — anchored to line numbers:
      - SME clicks a line in the rendered markdown to select it (line number captured)
      - Comment text field
      - Add Comment button — saves comment to server immediately (no waiting for submit)
      - Running list of the SME's own comments with line reference and Remove button
- [ ] Comments saved incrementally so collaboration is live; TW sees them appear
      in near real-time via polling on the Document Detail page
- [ ] General notes textarea
- [ ] Decision selector: Approve / Reject / Needs Changes
- [ ] Submit button — finalises the review; disabled after submission
- [ ] Confirmation message after successful submission
- [ ] If token is invalid or already submitted, show appropriate message

### Slack Notifications
- [ ] One message sent per SME when assigned
- [ ] Message includes: document title, SME name, deadline, magic link
- [ ] If SLACK_WEBHOOK_URL is not set in .env, skip silently — do not error

### Docker Support
- [ ] Dockerfile for the server
- [ ] Dockerfile for the client (build + serve via nginx)
- [ ] docker-compose.yml that starts both with one command
- [ ] Volumes configured so the SQLite database and uploads persist across restarts
- [ ] .env.example with all variables documented

---

## 4. Status Logic

Document status is derived from the set of SME decisions on that document.
Recalculate and update `documents.status` every time an SME submits.

| Condition                              | Status         |
|----------------------------------------|----------------|
| No SMEs have submitted yet             | In Review      |
| All SMEs approved                      | Approved       |
| Any SME rejected                       | Rejected       |
| Any SME submitted Needs Changes        | Needs Changes  |
| Document created, no SMEs assigned yet | Draft          |

---

## 5. Database Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Draft',
  deadline DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sme_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sme_name TEXT NOT NULL,
  sme_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  decision TEXT,
  general_notes TEXT,
  submitted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inline_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES sme_assignments(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  comment_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE revision_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  actor TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. API Routes

### Auth
| Method | Route                  | Auth | Description                        |
|--------|------------------------|------|------------------------------------|
| POST   | /api/auth/register     | No   | Create TW account                  |
| POST   | /api/auth/login        | No   | Returns JWT token                  |

### Documents
| Method | Route                          | Auth | Description                              |
|--------|--------------------------------|------|------------------------------------------|
| GET    | /api/documents                 | JWT  | List documents for logged-in TW          |
| POST   | /api/documents                 | JWT  | Upload file + create document            |
| GET    | /api/documents/:id             | JWT  | Document detail + SMEs + history         |
| DELETE | /api/documents/:id             | JWT  | Delete document and file                 |
| GET    | /api/documents/:id/download    | JWT  | Stream annotated `.md` file on demand    |

### Reviews
| Method | Route                  | Auth | Description                        |
|--------|------------------------|------|------------------------------------|
| POST   | /api/reviews           | JWT  | Assign SMEs, set deadline, send Slack |

### SME (no auth)
| Method | Route                        | Auth | Description                                        |
|--------|------------------------------|----|------------------------------------------------------|
| GET    | /api/sme/:token              | No   | Get document info and existing comments for token  |
| POST   | /api/sme/:token/comment      | No   | Add a single inline comment (saved immediately)    |
| DELETE | /api/sme/:token/comment/:id  | No   | Remove a comment before final submission           |
| POST   | /api/sme/:token/submit       | No   | Finalise review — save decision and general notes  |

---

## 7. Slack Message Format

```
📄 *Review Request: [Document Title]*
Hi [SME Name], you've been asked to review a document.

*Due:* [Deadline, formatted as Month Day, Year]
*From:* [TW Name]

<[Magic Link URL]|Click here to review>
```

Send one message per SME. Use Slack's Incoming Webhook — no bot token needed.
Webhook URL is set via SLACK_WEBHOOK_URL in .env.

---

## 8. Magic Link Behavior

1. TW submits new review form
2. Server generates a `uuid` token per SME → stored in `sme_assignments.token`
3. Magic link format: `[APP_URL]/review/[token]`
4. Token is single-use in spirit — once submitted, the page shows a confirmation
   state and the submit button is permanently disabled
5. The token does not expire — intentionally simple for v1

---

## 9. File Handling

- Accepted types: `.md` only
- Max size: 1MB
- Stored at: `server/uploads/[uuid]-[original-filename]`
- Served via Express static route: `GET /uploads/[filename]`
- When a document is deleted, the file is also deleted from disk
- **Annotated download** (`GET /api/documents/:id/download`) — assembled on demand,
  never written to disk; server reads the source `.md`, injects inline comments as
  blockquotes beneath their referenced lines, appends general notes at the end,
  and streams the result as a file download

---

## 10. Frontend Routes

| Path                | Component        | Auth Required |
|---------------------|------------------|---------------|
| /                   | Redirect to /dashboard or /login |  |
| /login              | Login            | No            |
| /register           | Register         | No            |
| /dashboard          | Dashboard        | Yes           |
| /documents/new      | NewReview        | Yes           |
| /documents/:id      | DocumentDetail   | Yes           |
| /review/:token      | SMEReview        | No            |

---

## 11. Build Phases

Work through phases in order. Do not start a new phase until the current one is
tested and working. State which phase you are on at the start of each session.

---

### Phase 1 — Backend Foundation ✅
**Goal:** A running Express server with a working database and auth.

- [x] Initialize `server/` with `npm init`, install dependencies:
      `express`, `better-sqlite3`, `jsonwebtoken`, `bcryptjs`, `uuid`,
      `multer`, `cors`, `dotenv`
- [x] Create `server/db/schema.sql` with all tables
- [x] Create `server/db/database.js` — opens SQLite connection, runs schema on startup
- [x] Create `server/index.js` — Express app, loads env, mounts routes
- [x] Create `server/routes/auth.js` — register and login routes
- [x] Create `server/middleware/auth.js` — JWT verification middleware
- [x] Test: register a user, log in, receive a JWT

---

### Phase 2 — Document Upload ✅
**Goal:** TWs can upload files and create document records.

- [x] Create `server/routes/documents.js`
- [x] `POST /api/documents` — multer handles file upload, saves to `server/uploads/`,
      creates document record in DB, logs to revision_history
- [x] `GET /api/documents` — returns all documents for the authenticated TW
- [x] `GET /api/documents/:id` — returns document + SME assignments + revision history
- [x] `DELETE /api/documents/:id` — deletes DB record and file from disk
- [x] `GET /api/documents/:id/download` — reads source `.md` from disk, injects
      inline comments as blockquotes beneath their line numbers, appends general
      notes section, streams result as a `.md` file download
- [x] Serve uploads statically: `app.use('/uploads', express.static('uploads'))`
- [x] Test: upload a file, retrieve it, download annotated version, delete it

---

### Phase 3 — Reviews and SME System ✅
**Goal:** TWs can assign SMEs, SMEs can submit feedback.

- [x] Create `server/routes/reviews.js`
- [x] `POST /api/reviews` — accepts document_id, deadline, array of SMEs (name + email);
      creates sme_assignment rows with UUID tokens; triggers Slack per SME;
      updates document status to 'In Review'; logs to revision_history
- [x] Create `server/slack.js` — exports a `sendSlackNotification(sme, document, twName)` function;
      skips silently if SLACK_WEBHOOK_URL not set
- [x] Create `server/routes/sme.js`
- [x] `GET /api/sme/:token` — returns document info, file content, and any comments
      already saved by this SME; returns 404 if token not found
- [x] `POST /api/sme/:token/comment` — saves a single inline comment (line_number +
      comment_text) immediately; returns the saved comment with its id
- [x] `DELETE /api/sme/:token/comment/:id` — removes a comment (only if assignment
      not yet submitted)
- [x] `POST /api/sme/:token/submit` — saves decision and general notes; marks
      assignment as Submitted; recalculates and updates document status;
      logs to revision_history
- [x] Write status recalculation as a reusable function in a shared utility file
- [x] Test full flow: create review → get magic link → submit feedback → verify status update

---

### Phase 4 — Frontend Scaffold ✅
**Goal:** React app running with routing and auth context.

- [x] Initialize `client/` with `npm create vite@latest` (React, JavaScript)
- [x] Install dependencies: `react-router-dom`
- [x] Set up React Router in `App.jsx` with all routes from Section 10
- [x] Create auth context (`src/context/AuthContext.jsx`):
      stores JWT in localStorage, provides login/logout functions, exposes current user
- [x] Create a `ProtectedRoute` component that redirects to /login if not authenticated
- [x] Create placeholder page components for all routes
- [x] Configure Vite proxy so `/api` requests go to `http://localhost:3001` in dev
- [x] Test: app loads, login redirects work, JWT persists across page refresh

---

### Phase 5 — TW Frontend Pages ✅
**Goal:** TWs can use the app to manage documents and reviews.

- [x] **Login page** — email + password form, calls `/api/auth/login`, stores JWT
- [x] **Register page** — name + email + password form
- [x] **Dashboard page** — fetches and displays document list with status badges,
      SME response counts, deadline indicators (overdue in red, due soon in yellow)
- [x] **New Review page** — title, description, file input, dynamic SME list
      (add/remove rows), deadline picker; submits to `POST /api/documents` then
      `POST /api/reviews`
- [x] **Document Detail page** — document info, SME table with expandable rows
      showing notes and inline comments, revision history timeline

---

### Phase 6 — SME Frontend Page ✅
**Goal:** SMEs can access and complete their review via magic link.

- [x] **SME Review page** (`/review/:token`)
- [x] On load: fetch `GET /api/sme/:token`; show error if invalid token
- [x] Name confirmation screen — "Is this you?" with confirm and "That's not me" paths;
      "That's not me" calls `POST /api/sme/:token/wrong-person` which fires Slack alert
      to the TW and shows a "we've notified them" message
- [x] Render the markdown document line-by-line in a code-editor style (dark theme,
      monospace, line numbers) — plain text, no HTML rendering
- [x] Clicking a line highlights it and opens an inline comment input anchored to
      that line number
- [x] Confirming the comment posts to `POST /api/sme/:token/comment` immediately
      and inserts the saved comment visually beneath the line
- [x] Each comment has a Remove button that calls `DELETE /api/sme/:token/comment/:id`
- [x] General notes textarea
- [x] Decision button group: Approve / Reject / Needs Changes
- [x] Submit button: posts decision + general notes to `POST /api/sme/:token/submit`;
      disabled until a decision is selected
- [x] After submit: replace form with a thank-you confirmation message
- [x] If assignment already submitted: show read-only view with their comments on load

---

### Phase 7 — Docker & Open Source Readiness ✅
**Goal:** Anyone can clone the repo and run the app with one command.

- [x] Write `server/Dockerfile`
- [x] Write `client/Dockerfile` (build React app, serve with nginx)
- [x] Write `docker-compose.yml`:
      - `server` service — builds server, exposes port 3001 internally only
      - `client` service — builds client, exposes port 80 via nginx
      - Named volume for `server/uploads/` so files persist
      - Named volume for `server/db/` so SQLite persists
      - Both services read from `.env` via env_file
- [x] Write `.env.example` with every variable documented inline
- [x] Write `README.md`:
      - What the app does (2–3 sentences)
      - Prerequisites (Docker + Docker Compose)
      - Setup instructions (clone → copy .env → docker compose up)
      - Slack webhook setup steps
      - How to access the app
      - How to back up data (copy the two volume directories)
- [x] Write `client/nginx.conf` — proxies /api and /uploads to server, serves
      React app with try_files fallback for client-side routing
- [x] Write `.gitignore`
- [x] Add server/.dockerignore and client/.dockerignore

---

### Phase 8 — Polish & Hardening ✅
**Goal:** App is robust and ready to share.

- [x] Frontend form validation with clear error messages — partial SME rows caught,
      file type validated client-side, all forms show server errors inline
- [x] Backend input validation on all routes — email format regex on auth + reviews,
      blank name check, file type/size enforced by multer, decision enum validated
- [x] Loading states on all async operations — including download button ("Preparing…")
- [x] Empty states on dashboard — first-time user sees prompt with link to new review
- [x] 404 page for unknown routes — NotFound.jsx with catch-all route in App.jsx
- [x] Invalid/expired token page for SME link errors — SMEReview shows error screen
- [x] Confirm dialog before deleting a document — inline confirm/cancel in DocumentDetail
- [x] try/catch guard added to wrong-person route
- [x] End-to-end smoke test passed: register → upload → assign SME → comment →
      submit → download annotated file

---

## 12. Out of Scope (v1)

These are intentionally excluded to keep the build focused. Note them for a future
version rather than implementing them now.

- Email notifications (Slack only for v1)
- Document versioning (one file per review)
- SME-to-SME visibility of feedback
- In-app document preview (download link only)
- Role-based permissions beyond TW vs SME
- Admin panel
- API rate limiting
- Password reset flow
