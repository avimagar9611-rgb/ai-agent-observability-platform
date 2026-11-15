
from uuid import uuid4

from sqlalchemy import String, Text, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # Connect evaluation to an existing trace
    trace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("traces.id"),
        nullable=False
    )

    relevance_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    completeness_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    quality_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    overall_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    feedback: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    