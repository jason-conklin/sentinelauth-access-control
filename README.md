# SentinelAuth – Role-Based Access & Security Platform
<img width="1593" height="941" alt="sentinel_admin_dash" src="https://github.com/user-attachments/assets/54c76d32-e782-4653-9b95-d595655c5665" />

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
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Default admin seeding (dev can use addresses like `admin@local`; production should supply a routable email) |
| `DEV_RELAXED_MODE` | Enable dev fallback when Redis is unavailable (forced off in production) |
| `REFRESH_PERSISTENCE` | Refresh token persistence backend: `db` (durable, default) or `redis` (cached with DB fallback) |

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
- Refresh token rotation writes durable records to the database and optionally caches JTIs in Redis. When `DEV_RELAXED_MODE=true`, Redis outages degrade gracefully (warning responses, health status `degraded`). In production, rotation fails fast with `503` to avoid silent token reuse.

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

## Dev on Windows
- Set an absolute SQLite URL and force DB persistence before starting uvicorn:
  ```powershell
  $abs = (Resolve-Path .\sentinelauth.db).Path.Replace('\','/')
  $env:DATABASE_URL = "sqlite:///$abs"
  $env:REFRESH_PERSISTENCE = "db"
  uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
  ```

## Screenshots
Screenshot 1: Login page
Secure login screen with JWT rotation and rate-limited access.
<img width="1401" height="941" alt="sentinel_login" src="https://github.com/user-attachments/assets/6a859a7a-156f-4236-9ff2-9cb4080211b7" />

Screenshot 2: Admin dashboard
Security overview with navigation to users, sessions, and audit tools.
<img width="1593" height="941" alt="sentinel_admin_dash" src="https://github.com/user-attachments/assets/d623ad1c-0eba-4a80-91ad-de2de0edc597" />

Screenshot 3: Users directory
Admin view listing users, roles, and active status for RBAC management.
<img width="1593" height="942" alt="sentinel_users" src="https://github.com/user-attachments/assets/829b22f0-b280-4582-9994-475886d4fdc2" />

Screenshot 4: Sessions overview
Inspect active sessions with device fingerprinting and revocation controls.
<img width="1593" height="941" alt="sentinel_sessions" src="https://github.com/user-attachments/assets/09f40e43-7e3a-4e4f-9a7c-9d1f1ba2f3ac" />

Screenshot 5: Audit trail
Structured audit events with IDs, actors, IP addresses, and timestamps.
<img width="1595" height="942" alt="sentinel_audit" src="https://github.com/user-attachments/assets/cb49bf27-7ac9-4553-9673-1e0188376660" />

Screenshot 6: Profile details
User profile page with role membership, metadata, and password update actions.
<img width="1595" height="943" alt="sentinel_profile" src="https://github.com/user-attachments/assets/4a7e330e-b5ab-4533-b6ce-3a235141281e" />

Screenshot 7: My sessions
Personal session history with IP, device, and last-seen activity.
<img width="1594" height="942" alt="sentinel_my_sessions" src="https://github.com/user-attachments/assets/b8885e4f-046d-47dd-84b0-e7f5b7127664" />

Screenshot 8: Limited dashboard
User role dashboard showing restricted access indicators and trimmed navigation.
<img width="1593" height="943" alt="sentinel_user_dash" src="https://github.com/user-attachments/assets/33fec629-22a3-4b57-8d5b-84c1186b4249" />
