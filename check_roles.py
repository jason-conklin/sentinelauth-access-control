from sqlalchemy import create_engine, text
import os

engine = create_engine(os.getenv("DATABASE_URL", "sqlite:///sentinelauth.db"))

with engine.begin() as conn:
    rows = conn.execute(
        text(
            """
            SELECT u.email, GROUP_CONCAT(r.name) AS roles
            FROM users u
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            GROUP BY u.id
            ORDER BY u.email
            """
        )
    ).mappings().all()

for row in rows:
    print(dict(row))
