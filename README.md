# Penny

Penny is a self-hosted web app for Technical Writers to manage document reviews with Subject Matter Experts (SMEs). Upload a Markdown file, assign reviewers, and collect inline comments and decisions — all without requiring SMEs to create an account. When a review is complete, download the annotated Markdown file directly into your local repo.

---

## How it works

1. A Technical Writer registers, uploads a `.md` file, and assigns one or more SMEs.
2. Each SME receives a Slack message with a unique magic link — no login required.
3. SMEs open the link, confirm their name, and leave inline comments directly on lines of the document.
4. The TW watches feedback arrive in near real-time on the Document Detail page.
5. Once all SMEs have submitted, the TW downloads the reviewed file — original Markdown with all SME comments injected as blockquotes — and saves it to their local repo.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (included with Docker Desktop)

---

## Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd penny-app

# 2. Create your environment file
cp .env.example .env

# 3. Edit .env and fill in the required values
#    — JWT_SECRET: any long random string (e.g. run: openssl rand -hex 32)
#    — APP_URL: the URL where the app will be accessed (e.g. http://localhost)
#    — SLACK_WEBHOOK_URL: optional, see Slack setup below

# 4. Start the app
docker compose up --build
```

The app will be available at **http://localhost**.

On first run, Docker builds both containers and the SQLite database is created automatically. Subsequent starts (without `--build`) are faster.

---

## Slack setup (optional)

Slack notifications are used to send SMEs their review links and to alert the TW if a link reaches the wrong person. The app works fully without Slack — links can be shared manually.

To enable Slack:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app.
2. Under **Incoming Webhooks**, activate webhooks and add one to a channel.
3. Copy the Webhook URL into `.env` as `SLACK_WEBHOOK_URL`.
4. Restart with `docker compose up`.

---

## Accessing the app

| URL | Description |
|-----|-------------|
| `http://localhost` | Main app (Technical Writer login/register) |
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
# Terminal 1 — backend
cd server
node index.js

# Terminal 2 — frontend
cd client
npm run dev
```

Backend: http://localhost:3001  
Frontend: http://localhost:5173

Requires Node.js 20+.
