from sqlalchemy import create_engine, text
import os

engine = create_engine(os.getenv("DATABASE_URL", "sqlite:///sentinelauth.db"))

with engine.begin() as conn:
    rows = conn.execute(
        text(
            """
            SELECT jti, user_id, revoked_at, issued_at, expires_at
            FROM refresh_tokens
            ORDER BY issued_at DESC
            LIMIT 6
            """
        )
    ).mappings().all()

for row in rows:
    print(dict(row))
