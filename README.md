# keyshop — an Eneba-style digital key marketplace

Eneba Intern Assignment 2027. Work in progress: see [docs/implementation-plan.md](docs/implementation-plan.md) for the schedule and [docs/requirements.md](docs/requirements.md) for how each assignment requirement is covered.

- **Frontend:** React 19 + TypeScript (Vite) — `web/`
- **Backend:** Go REST API — `api/`
- **Database:** PostgreSQL (migrations in `api/migrations/`)
- **AI conversation history:** [docs/agent-chat-history.md](docs/agent-chat-history.md) (how it is produced: [docs/agent-logging-plan.md](docs/agent-logging-plan.md))

All games, studios, sellers, ratings and keys are fictional demo data. This is a student project and is not affiliated with Eneba.

## Run locally

Requires Go 1.25+, Node 22+ and PostgreSQL 16.

```bash
make db      # create databases eneba and eneba_test
make seed    # migrate + load demo data
make api     # API on http://localhost:8080
make web     # app on http://localhost:5173
```

Demo account: `demo@example.test` / `demo-password-2027`.
