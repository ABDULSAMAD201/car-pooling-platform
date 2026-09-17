"""add driver destination

Revision ID: a877c36c1a8a
Revises: 
Create Date: 2026-09-08 16:05:59.037432

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a877c36c1a8a'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns NOT NULL via a temporary server default so existing rows are
    # backfilled, then drop the default so new rows must provide real values.
    op.add_column('driver_availability', sa.Column('destination_lat', sa.Float(), nullable=False, server_default='0'))
    op.add_column('driver_availability', sa.Column('destination_lng', sa.Float(), nullable=False, server_default='0'))
    op.alter_column('driver_availability', 'destination_lat', server_default=None)
    op.alter_column('driver_availability', 'destination_lng', server_default=None)


def downgrade() -> None:
    op.drop_column('driver_availability', 'destination_lng')
    op.drop_column('driver_availability', 'destination_lat')