"""Adjust refresh token schema for durable persistence."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202501020002"
down_revision = "202501020001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("refresh_tokens") as batch:
        batch.add_column(sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))

    refresh_tokens = sa.table(
        "refresh_tokens",
        sa.column("is_revoked", sa.Boolean),
        sa.column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.execute(
        refresh_tokens.update()
        .where(refresh_tokens.c.is_revoked == sa.true())
        .values(revoked_at=sa.func.now())
    )

    with op.batch_alter_table("refresh_tokens") as batch:
        batch.drop_column("is_revoked")


def downgrade() -> None:
    with op.batch_alter_table("refresh_tokens") as batch:
        batch.add_column(
            sa.Column(
                "is_revoked",
                sa.Boolean,
                nullable=False,
                server_default=sa.text("0"),
            )
        )

    refresh_tokens = sa.table(
        "refresh_tokens",
        sa.column("is_revoked", sa.Boolean),
        sa.column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.execute(
        refresh_tokens.update()
        .where(refresh_tokens.c.revoked_at.isnot(None))
        .values(is_revoked=sa.true())
    )

    with op.batch_alter_table("refresh_tokens") as batch:
        batch.drop_column("revoked_at")
        batch.alter_column("is_revoked", server_default=None)
