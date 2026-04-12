## NeuralOps AI — Company Dashboard (MVP)

An AI-company operating system: assign work to agents, track status, manage projects/clients, generate invoices, and chat with agents.

### Repo layout

- `apps/api` — Python Flask REST API (SQLite by default)
- `apps/web` — Next.js + Tailwind frontend (scaffolded files; install deps on your machine)
- `.trae/skills` — reusable Trae skills (`SKILL.md`)
- `docs` — agent prompts and operating workflow

### MVP features (Phase 1)

- Task assignment (agent → agent)
- Status tracking
- Project creation
- Chat with agents (stubbed for now)
- Invoice generator
- Client management

### Quickstart (API)

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app
```

API runs on `http://127.0.0.1:8000` and exposes:

- `GET /health`
- `GET/POST /agents`
- `GET/POST /projects`
- `GET/POST /tasks`
- `GET/POST /clients`
- `GET/POST /invoices`
- `POST /chat`

### Quickstart (Web)

Node.js is required for the Next.js app.

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Frontend expects the API at `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://127.0.0.1:8000`).

