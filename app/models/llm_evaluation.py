
from uuid import uuid4

from sqlalchemy import (
    String, Text, Float, DateTime,
    ForeignKey, func, JSON
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class LlmEvaluation(Base):

    __tablename__ = "llm_evaluations"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    trace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("traces.id"),
        nullable=False
    )

    relevance_score: Mapped[float] = mapped_column(
        Float, nullable=False
    )

    correctness_score: Mapped[float] = mapped_column(
        Float, nullable=False
    )

    completeness_score: Mapped[float] = mapped_column(
        Float, nullable=False
    )

    clarity_score: Mapped[float] = mapped_column(
        Float, nullable=False
    )

    overall_score: Mapped[float] = mapped_column(
        Float, nullable=False
    )

    feedback: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    strengths: Mapped[list] = mapped_column(
        JSON, nullable=False
    )

    improvements: Mapped[list] = mapped_column(
        JSON, nullable=False
    )

    model_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
