# Penny

Penny is a self-hosted web app for Technical Writers to manage document reviews with Subject Matter Experts (SMEs). Upload a Markdown file, assign reviewers, and collect inline comments and decisions — all without requiring SMEs to create an account. When a review is complete, download the annotated Markdown file directly into your local repo.

---

## How it works

1. A Technical Writer runs the app and creates an admin account through the browser on first launch.
2. The TW uploads a `.md` file and assigns one or more SMEs.
3. Each SME receives a Slack message with a unique magic link — no login required.
4. SMEs open the link, confirm their name, and leave inline comments directly on lines of the document.
5. The TW watches feedback arrive in near real-time on the Document Detail page.
6. Once all SMEs have submitted, the TW downloads the reviewed file — original Markdown with all SME comments injected as blockquotes — and saves it to their local repo.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (includes Docker Compose)

---

## Quickstart

```bash
# 1. Clone the repo
git clone <repo-url>
cd penny-app

# 2. Create your environment file
cp .env.example .env

# 3. Start the app
docker compose up --build
```

Open **http://localhost** in your browser. On first launch you'll be guided through creating your admin account — no manual configuration needed.

`JWT_SECRET` is generated automatically on first run. `APP_URL` defaults to `http://localhost`, which is correct for local use. If you're running on a remote server, update `APP_URL` in `.env` to your server's domain or IP (e.g. `http://your-server-ip`) before starting.

Subsequent starts (without `--build`) are faster:

```bash
docker compose up
```

---

## Slack setup (optional)

Slack notifications send SMEs their review links automatically. The app works fully without Slack — links can be copied and shared manually from the Document Detail page.

To enable Slack:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app.
2. Under **Incoming Webhooks**, activate webhooks and add one to a channel.
3. Copy the Webhook URL into `.env` as `SLACK_WEBHOOK_URL`.
4. Restart with `docker compose up`.

---

## Accessing the app

| URL | Description |
|-----|-------------|
| `http://localhost` | Main app (Technical Writer login) |
| `http://localhost/review/<token>` | SME review page (from magic link) |

---

## Backing up your data

All persistent data lives in two named Docker volumes:

| Volume | Contents |
|--------|----------|
| `penny-app_db` | SQLite database |
| `penny-app_uploads` | Uploaded Markdown files |

To back up, copy the volume directories from your Docker host. On Linux:

```bash
# Find volume paths
docker volume inspect penny-app_db penny-app_uploads

# Example: copy to a backup location
cp -r /var/lib/docker/volumes/penny-app_db /my-backup/
cp -r /var/lib/docker/volumes/penny-app_uploads /my-backup/
```

To restore, copy the directories back and restart with `docker compose up`.

---

## Development (without Docker)

```bash
# Build the client once (or after frontend changes)
cd client && npm run build && cd ..

# Start the server — serves both the API and the built client
cd server && node index.js
```

App available at **http://localhost:3001**.

For frontend development with hot reload, run both in separate terminals:

```bash
# Terminal 1 — backend
cd server && node index.js

# Terminal 2 — frontend (hot reload via Vite)
cd client && npm run dev
```

Frontend: http://localhost:5173 (proxies API calls to the backend automatically)

Requires Node.js 20+.
