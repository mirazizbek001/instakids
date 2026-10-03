# InstaKids — Railway single-service deployment

This repository root is the **whole project**. Deploy this root with Railway's Dockerfile builder.

## Structure
- `Dockerfile` — builds React and runs Django + Nginx in one service
- `backend/` — Django API, auth, sessions and database models
- `frontend/react/` — React application
- `railway/` — Nginx and startup configuration
- `railway.toml` — Railway deployment configuration

## Railway
1. Deploy the repository **root** (do not deploy only `frontend/react`).
2. Add a Railway Volume mounted at `/data` if you want persistent SQLite storage.
3. Or set `DATABASE_URL` to a Railway PostgreSQL database.
4. Set `SECRET_KEY` to a long random value.
5. Open `/health` after deployment.

If neither `/data` nor `DATABASE_URL` is configured, the app still starts with a local fallback SQLite directory so the service stays online, but the data is not durable across restarts. For durable production data, use a Volume or PostgreSQL.

Do not commit `backend/db.sqlite3`; production data belongs in the Railway Volume or PostgreSQL.
