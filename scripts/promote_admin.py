"""Utility script to promote a specific user to admin."""

from __future__ import annotations

import sys
import argparse
from pathlib import Path

import sqlalchemy as sa

# Add the project root to sys.path so imports resolve when launched via PowerShell.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from api.config import get_settings
    from api.db import _SessionLocal, get_session_factory, init_db
    from api.models import Role, User
except ImportError as exc:  # pragma: no cover - guidance for mis-invocation
    print("❌ Unable to import application modules. Run this script from the project root.")
    print(f"Details: {exc}")
    sys.exit(1)

parser = argparse.ArgumentParser(description="Promote a user to the admin role.")
parser.add_argument("email", help="Email address of the user to promote")


def main() -> None:
    """Promote the target user to the admin role."""
    args = parser.parse_args()

    # Load application settings so we can reuse the configured database.
    settings = get_settings()

    # Ensure database schema is ready before we attempt any writes.
    init_db(settings)

    # Obtain a session factory; initialise the cached factory if needed.
    session_factory = _SessionLocal or get_session_factory(settings)

    # Open a session for transactional updates.
    session = session_factory()
    try:
        # Fetch the target user; abort if the account does not exist yet.
        user = session.execute(sa.select(User).where(User.email == args.email)).scalar_one_or_none()
        if not user:
            print("❌ User not found")
            sys.exit(1)

        # Ensure the admin role record exists (create it if missing).
        role = session.query(Role).filter(Role.name == "admin").one_or_none()
        if role is None:
            role = Role(name="admin")
            session.add(role)
            session.commit()

        # Attach the admin role to the user if not already assigned.
        if role not in user.roles:
            user.roles.append(role)
            session.commit()

        # Display the resulting set of user roles for verification.
        role_names = [r.name for r in user.roles]
        print(f"✅ Promoted {user.email} -> {role_names}")
    finally:
        # Always close the session to release the connection back to the pool.
        session.close()


if __name__ == "__main__":
    main()
