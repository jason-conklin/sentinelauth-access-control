"""Database engine, session management, and migration helpers."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator, Optional

from alembic import command
from alembic.config import Config as AlembicConfig
from loguru import logger
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .config import Settings

Base = declarative_base()

_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def get_engine(settings: Settings) -> Engine:
    """Return a singleton SQLAlchemy engine."""
    global _engine
    if _engine is None:
        connect_args = {}
        if settings.db_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(
            settings.db_url,
            echo=False,
            future=True,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        logger.debug("Database engine initialised for {}", settings.db_url)
    return _engine


def get_session_factory(settings: Settings) -> sessionmaker:
    """Return a session factory bound to the engine."""
    global _SessionLocal
    if _SessionLocal is None:
        engine = get_engine(settings)
        _SessionLocal = sessionmaker(
            bind=engine,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
            class_=Session,
            future=True,
        )
    return _SessionLocal


@contextmanager
def db_session(settings: Settings) -> Generator[Session, None, None]:
    """Provide a transactional scope for database operations."""
    session_factory = get_session_factory(settings)
    session: Session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:  # pragma: no cover - re-raised for FastAPI handlers
        session.rollback()
        raise
    finally:
        session.close()


def run_migrations(settings: Settings) -> None:
    """Run Alembic upgrades to the latest head."""
    logger.info("Applying database migrations...")
    alembic_cfg = AlembicConfig()
    migrations_path = settings_path("migrations")
    alembic_cfg.set_main_option("script_location", migrations_path)
    alembic_cfg.set_main_option("sqlalchemy.url", settings.db_url)
    command.upgrade(alembic_cfg, "head")


def init_db(settings: Settings) -> None:
    """Initialise the database and seed baseline data."""
    engine = get_engine(settings)
    Base.metadata.create_all(bind=engine)
    try:
        run_migrations(settings)
    except Exception as exc:  # pragma: no cover - migrations optional in tests
        logger.warning("Failed to run migrations automatically: {}", exc)
    seed_default_roles(settings)


def seed_default_roles(settings: Settings) -> None:
    """Ensure baseline roles are present."""
    from .models import Role  # Local import to avoid circular dependency

    role_names = ("admin", "moderator", "user")
    with db_session(settings) as session:
        existing = {
            name for (name,) in session.query(Role.name).filter(Role.name.in_(role_names))
        }
        for role_name in role_names:
            if role_name not in existing:
                session.add(Role(name=role_name))
                logger.info("Seeded role '{}'", role_name)


def settings_path(*parts: str) -> str:
    """Return an absolute path relative to the project root."""
    from pathlib import Path

    base = Path(__file__).resolve().parent.parent
    return str(base.joinpath(*parts))
