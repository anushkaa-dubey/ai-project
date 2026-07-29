"""initial

Revision ID: 10f6dfb3f694
Revises: 
Create Date: 2026-07-29 21:45:33.279824

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10f6dfb3f694'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('feedback',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('grade', sa.Integer(), nullable=True),
        sa.Column('predicted_bw', sa.Float(), nullable=True),
        sa.Column('actual_bw', sa.Float(), nullable=True),
        sa.Column('recommendation', sa.Text(), nullable=True),
        sa.Column('action', sa.String(length=10), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('operator_id', sa.String(length=50), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_feedback_id'), 'feedback', ['id'], unique=False)
    
    op.create_table('prediction_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.Column('grade', sa.Integer(), nullable=True),
        sa.Column('predicted_bw', sa.Float(), nullable=True),
        sa.Column('actual_bw', sa.Float(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('anomaly_prob', sa.Float(), nullable=True),
        sa.Column('machine_speed', sa.Float(), nullable=True),
        sa.Column('steam_pressure', sa.Float(), nullable=True),
        sa.Column('moisture', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_prediction_log_id'), 'prediction_log', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_prediction_log_id'), table_name='prediction_log')
    op.drop_table('prediction_log')
    op.drop_index(op.f('ix_feedback_id'), table_name='feedback')
    op.drop_table('feedback')
