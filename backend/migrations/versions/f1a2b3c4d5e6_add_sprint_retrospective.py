"""sprint retrospective tables

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "retrospectives",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sprint_id", sa.Integer(), sa.ForeignKey("sprints.id"), nullable=False, unique=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="open"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "retro_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("retrospective_id", sa.Integer(), sa.ForeignKey("retrospectives.id"), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=True, server_default="1"),
        sa.Column("is_done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("votes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_retro_items_retrospective_id", "retro_items", ["retrospective_id"])


def downgrade() -> None:
    op.drop_index("ix_retro_items_retrospective_id", table_name="retro_items")
    op.drop_table("retro_items")
    op.drop_table("retrospectives")