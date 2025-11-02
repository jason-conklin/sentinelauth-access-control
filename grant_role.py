import os
from sqlalchemy import create_engine, text

EMAIL = os.getenv("EMAIL", "moderator@local.dev")
ROLE  = os.getenv("ROLE", "moderator")
DBURL = os.getenv("DATABASE_URL", "sqlite:///sentinelauth.db")

eng = create_engine(DBURL)

with eng.begin() as c:
    u = c.execute(text("SELECT id, email FROM users WHERE email=:e"), {"e": EMAIL}).mappings().first()
    if not u:
        raise SystemExit(f"❌ User not found: {EMAIL}")

    r = c.execute(text("SELECT id, name FROM roles WHERE name=:r"), {"r": ROLE}).mappings().first()
    if not r:
        # create the role if it doesn't exist
        c.execute(text("INSERT INTO roles(name) VALUES (:r)"), {"r": ROLE})
        r = c.execute(text("SELECT id, name FROM roles WHERE name=:r"), {"r": ROLE}).mappings().first()

    # add mapping if missing
    exists = c.execute(
        text("SELECT 1 FROM user_roles WHERE user_id=:u AND role_id=:r"),
        {"u": u["id"], "r": r["id"]}
    ).first()

    if not exists:
        c.execute(text("INSERT INTO user_roles(user_id, role_id) VALUES (:u, :r)"), {"u": u["id"], "r": r["id"]})

print(f"✅ Ensured role '{ROLE}' for {EMAIL}")
