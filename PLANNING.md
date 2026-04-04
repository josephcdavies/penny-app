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
- [ ] File upload — accepts .docx and .pdf only, max 20MB
- [ ] Add SMEs — repeating name + email fields, add/remove dynamically
- [ ] Deadline date picker
- [ ] On submit: upload file, create document record, create SME assignments,
      generate tokens, send Slack notifications

### Document Detail (TW view)
- [ ] Document title, description, status badge, deadline
- [ ] Download link for the uploaded file
- [ ] SME response table: Name | Email | Status | Decision | Submitted At
- [ ] Expandable row per SME showing general notes and inline comments
- [ ] Revision history timeline at the bottom of the page
- [ ] Document status is derived automatically (see Status Logic below)

### SME Review Page (public, no auth)
- [ ] Accessed via `/review/:token`
- [ ] No app header or navigation — standalone page
- [ ] Shows document title and description
- [ ] Download link for the document file
- [ ] Inline comment builder:
      - Section label field (e.g. "Page 2", "Step 3", "Introduction")
      - Comment text field
      - Add Comment button
      - List of added comments with ability to remove before submitting
- [ ] General notes textarea
- [ ] Decision selector: Approve / Reject / Needs Changes
- [ ] Submit button — disabled after submission
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
  section_label TEXT NOT NULL,
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
| Method | Route                  | Auth | Description                        |
|--------|------------------------|------|------------------------------------|
| GET    | /api/documents         | JWT  | List documents for logged-in TW    |
| POST   | /api/documents         | JWT  | Upload file + create document      |
| GET    | /api/documents/:id     | JWT  | Document detail + SMEs + history   |
| DELETE | /api/documents/:id     | JWT  | Delete document and file           |

### Reviews
| Method | Route                  | Auth | Description                        |
|--------|------------------------|------|------------------------------------|
| POST   | /api/reviews           | JWT  | Assign SMEs, set deadline, send Slack |

### SME (no auth)
| Method | Route                        | Auth | Description                    |
|--------|------------------------------|------|--------------------------------|
| GET    | /api/sme/:token              | No   | Get document info for this token |
| POST   | /api/sme/:token/submit       | No   | Submit feedback and decision   |

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

- Accepted types: `.pdf`, `.docx` only
- Max size: 20MB
- Stored at: `server/uploads/[uuid]-[original-filename]`
- Served via Express static route: `GET /uploads/[filename]`
- When a document is deleted, the file is also deleted from disk

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

### Phase 1 — Backend Foundation
**Goal:** A running Express server with a working database and auth.

- [ ] Initialize `server/` with `npm init`, install dependencies:
      `express`, `better-sqlite3`, `jsonwebtoken`, `bcrypt`, `uuid`,
      `multer`, `cors`, `dotenv`
- [ ] Create `server/db/schema.sql` with all tables
- [ ] Create `server/db/database.js` — opens SQLite connection, runs schema on startup
- [ ] Create `server/index.js` — Express app, loads env, mounts routes
- [ ] Create `server/routes/auth.js` — register and login routes
- [ ] Create `server/middleware/auth.js` — JWT verification middleware
- [ ] Test: register a user, log in, receive a JWT

---

### Phase 2 — Document Upload
**Goal:** TWs can upload files and create document records.

- [ ] Create `server/routes/documents.js`
- [ ] `POST /api/documents` — multer handles file upload, saves to `server/uploads/`,
      creates document record in DB, logs to revision_history
- [ ] `GET /api/documents` — returns all documents for the authenticated TW
- [ ] `GET /api/documents/:id` — returns document + SME assignments + revision history
- [ ] `DELETE /api/documents/:id` — deletes DB record and file from disk
- [ ] Serve uploads statically: `app.use('/uploads', express.static('uploads'))`
- [ ] Test: upload a file, retrieve it, delete it

---

### Phase 3 — Reviews and SME System
**Goal:** TWs can assign SMEs, SMEs can submit feedback.

- [ ] Create `server/routes/reviews.js`
- [ ] `POST /api/reviews` — accepts document_id, deadline, array of SMEs (name + email);
      creates sme_assignment rows with UUID tokens; triggers Slack per SME;
      updates document status to 'In Review'; logs to revision_history
- [ ] Create `server/slack.js` — exports a `sendSlackNotification(sme, document, twName)` function;
      skips silently if SLACK_WEBHOOK_URL not set
- [ ] Create `server/routes/sme.js`
- [ ] `GET /api/sme/:token` — returns document info and assignment for this token;
      returns 404 if token not found
- [ ] `POST /api/sme/:token/submit` — saves decision, general notes, inline comments;
      marks assignment as Submitted; recalculates and updates document status;
      logs to revision_history
- [ ] Write status recalculation as a reusable function in a shared utility file
- [ ] Test full flow: create review → get magic link → submit feedback → verify status update

---

### Phase 4 — Frontend Scaffold
**Goal:** React app running with routing and auth context.

- [ ] Initialize `client/` with `npm create vite@latest` (React, JavaScript)
- [ ] Install dependencies: `react-router-dom`
- [ ] Set up React Router in `App.jsx` with all routes from Section 10
- [ ] Create auth context (`src/context/AuthContext.jsx`):
      stores JWT in localStorage, provides login/logout functions, exposes current user
- [ ] Create a `ProtectedRoute` component that redirects to /login if not authenticated
- [ ] Create placeholder page components for all routes
- [ ] Configure Vite proxy so `/api` requests go to `http://localhost:3001` in dev
- [ ] Test: app loads, login redirects work, JWT persists across page refresh

---

### Phase 5 — TW Frontend Pages
**Goal:** TWs can use the app to manage documents and reviews.

- [ ] **Login page** — email + password form, calls `/api/auth/login`, stores JWT
- [ ] **Register page** — name + email + password form
- [ ] **Dashboard page** — fetches and displays document list with status badges,
      SME response counts, deadline indicators (overdue in red, due soon in yellow)
- [ ] **New Review page** — title, description, file input, dynamic SME list
      (add/remove rows), deadline picker; submits to `POST /api/documents` then
      `POST /api/reviews`
- [ ] **Document Detail page** — document info, SME table with expandable rows
      showing notes and inline comments, revision history timeline

---

### Phase 6 — SME Frontend Page
**Goal:** SMEs can access and complete their review via magic link.

- [ ] **SME Review page** (`/review/:token`)
- [ ] On load: fetch `GET /api/sme/:token`; show error if invalid token
- [ ] Show document title, description, and download link
- [ ] Inline comment builder:
      - Section label input + comment text input
      - Add Comment button appends to local list
      - Rendered comment list with Remove button per item
- [ ] General notes textarea
- [ ] Decision button group: Approve / Reject / Needs Changes
- [ ] Submit button: posts to `POST /api/sme/:token/submit`
- [ ] After submit: replace form with a thank-you confirmation message
- [ ] If assignment already submitted: show read-only confirmation on page load

---

### Phase 7 — Docker & Open Source Readiness
**Goal:** Anyone can clone the repo and run the app with one command.

- [ ] Write `server/Dockerfile`
- [ ] Write `client/Dockerfile` (build React app, serve with nginx)
- [ ] Write `docker-compose.yml`:
      - `server` service — builds server, exposes port 3001
      - `client` service — builds client, exposes port 80
      - Named volume for `server/uploads/` so files persist
      - Named volume for `server/db/` so SQLite persists
      - Both services read from `.env`
- [ ] Write `.env.example` with every variable documented inline
- [ ] Write `README.md`:
      - What the app does (2–3 sentences)
      - Prerequisites (Docker + Docker Compose)
      - Setup instructions (clone → copy .env → docker compose up)
      - Slack webhook setup steps
      - How to access the app
      - How to back up data (copy the two volume directories)
      - Screenshot or two (add later)
- [ ] Test: fresh clone on a clean machine or VM, follow README only,
      confirm app works end to end

---

### Phase 8 — Polish & Hardening
**Goal:** App is robust and ready to share.

- [ ] Frontend form validation with clear error messages
- [ ] Backend input validation on all routes (check required fields, file type, size)
- [ ] Loading states on all async operations
- [ ] Empty states on dashboard (first-time user sees a helpful prompt, not a blank table)
- [ ] 404 page for unknown routes
- [ ] Invalid/expired token page for SME link errors
- [ ] Confirm dialog before deleting a document
- [ ] Test the full end-to-end workflow manually before publishing

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
