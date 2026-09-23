"""ai traceability columns on tasks

Revision ID: e1f2a3b4c5d6
Revises: c3d4e5f6g7h8
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "c3d4e5f6g7h8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("ai_provider", sa.String(), nullable=True))
    op.add_column("tasks", sa.Column("ai_model", sa.String(), nullable=True))
    op.add_column("tasks", sa.Column("ai_is_fallback", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("tasks", sa.Column("ai_needs_review", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("tasks", sa.Column("ai_analyzed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    for col in ("ai_analyzed_at", "ai_needs_review", "ai_is_fallback", "ai_model", "ai_provider"):
        op.drop_column("tasks", col)
