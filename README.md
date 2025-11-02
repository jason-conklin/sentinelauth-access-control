# SentinelAuth – Role-Based Access & Security Platform

SentinelAuth is a lean authentication, authorization, and security telemetry service designed as a complement to observability stacks like FlowGuard. It delivers hardened login flows, RBAC enforcement, and audit visibility with production-ready defaults.

## Features
- 🔐 Bcrypt-secured registration and login with JWT access/refresh token rotation
- 🧠 Redis-backed rate limiting plus anomaly heuristics for suspicious logins
- 🗂️ Role-based access control (admin, moderator, user) enforced at the API layer
- 📜 Structured audit trail & session tracking with Slack/SMTP alert hooks
- 🧪 Pytest suite spanning auth flows, RBAC, rate limits, and audit coverage
- 🖥️ Optional Vite + React admin console for visibility into users, sessions, and audits
- 🐳 Docker Compose stack (API, Redis, Postgres profile, optional web dashboard)

## Quickstart

### 1. Environment & dependencies (PowerShell friendly)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` with secure values for `SECRET_KEY`, `DB_URL`, `REDIS_URL`, and optional alert credentials.

### 2. Bring up data services
```powershell
docker compose up -d redis
# For Postgres (optional prod profile):
docker compose --profile prod up -d postgres
```

### 3. Run the API locally
```powershell
uvicorn api.main:app --host 0.0.0.0 --port 8001
```

### 4. Seed an administrator
```powershell
python scripts/seed_admin.py
```

Visit http://localhost:8001/docs for interactive OpenAPI documentation.

### Docker Compose (full stack)
```powershell
docker compose up --build
```

The optional React dashboard runs at http://localhost:5174 (profile `web`).

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | `dev` / `prod` toggle for logging/behaviour |
| `API_HOST`, `API_PORT` | FastAPI bind address/port |
| `SECRET_KEY` | JWT signing key (min 16 chars; rotate regularly) |
| `ACCESS_TOKEN_TTL_MIN`, `REFRESH_TOKEN_TTL_DAYS` | Token expiry windows |
| `DB_URL` | SQLAlchemy database URL (SQLite or Postgres) |
| `REDIS_URL` | Redis connection string for tokens & rate limits |
| `CORS_ORIGINS` | Comma-separated list of allowed origins |
| `ALERT_CHANNELS` | Comma-separated subset of `slack,email` |
| `SLACK_WEBHOOK_URL`, `SMTP_*` | Alert transport credentials |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Default admin seeding |

**Security note:** Refresh tokens should live in HTTP-only storage in production. The sample admin UI keeps them client-side for demo purposes only.

## RBAC Matrix

| Endpoint | User | Moderator | Admin |
| --- | --- | --- | --- |
| `POST /auth/register` | ✅ | ✅ | ✅ |
| `POST /auth/login` | ✅ | ✅ | ✅ |
| `GET /auth/me` | ✅ | ✅ | ✅ |
| `GET /auth/me/sessions` | ✅ | ✅ | ✅ |
| `GET /users` | ⛔️ | ✅ | ✅ |
| `POST /users/{id}/roles` | ⛔️ | ⛔️ | ✅ |
| `PATCH /users/{id}` | ⛔️ | ⛔️ | ✅ |
| `GET /sessions` | ⛔️ | ⛔️ | ✅ |
| `POST /sessions/{id}/revoke` | ⛔️ | ⛔️ | ✅ |
| `GET /audit` | ⛔️ | ✅ | ✅ |

## API Examples

```bash
# Register
curl -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"ChangeMe123!"}'

# Login
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"ChangeMe123!"}'

# Authenticated "me"
curl http://localhost:8001/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# Admin-only: list users
curl http://localhost:8001/users \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>"
```

## Testing
```bash
pytest
```

The test suite uses `fakeredis` so no external Redis service is required.

## Observability & Alerts
- All auth and admin events are persisted to `audit_events`
- Suspicious login heuristics flag IP/UA changes (`severity` metadata) and trigger Slack/SMTP notifications when configured
- Sessions track device fingerprints, last-seen timestamps, and support revocation

## Future Work
- 🔑 Time-based one-time passwords (TOTP) and WebAuthn passkey support
- 🏢 Organization & tenant aware RBAC with scoped permissions
- 🔌 SSO bridges (OIDC / SAML) and SCIM provisioning hooks
- 📱 Device trust scoring with richer geo/IP intelligence

## Troubleshooting
- **Refresh token reuse denied** → Confirm Redis is reachable and persistent
- **429 rate limits** → Check Redis TTLs and adjust `capacity` in `api/deps.py`
- **Admin UI login loops** → Ensure `VITE_API_BASE` matches your API endpoint and CORS settings allow the origin

---

SentinelAuth keeps authentication flows observable, auditable, and secure without the overhead of a heavyweight identity provider.
