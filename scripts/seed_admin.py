"""Seed an initial admin user based on environment settings."""

from __future__ import annotations

from loguru import logger

from api.config import get_settings
from api.db import get_session_factory
from api.models import Role, User
from api.security import hash_password


def seed_admin() -> None:
    settings = get_settings()
    if not settings.seed_admin_email or not settings.seed_admin_password:
        logger.error("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD must be set in the environment")
        return

    session_factory = get_session_factory(settings)
    session = session_factory()

    try:
        user = session.query(User).filter(User.email == settings.seed_admin_email).one_or_none()
        if user:
            logger.info("Admin user already exists: {}", settings.seed_admin_email)
            return

        admin_role = session.query(Role).filter(Role.name == "admin").one_or_none()
        if not admin_role:
            admin_role = Role(name="admin")
            session.add(admin_role)
            session.flush()

        user = User(
            email=settings.seed_admin_email,
            password_hash=hash_password(settings.seed_admin_password),
            is_active=True,
        )
        user.roles.append(admin_role)
        session.add(user)
        session.commit()
        logger.info("Seeded admin user {}", settings.seed_admin_email)
    except Exception:
        session.rollback()
        logger.exception("Failed to seed admin user")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed_admin()
