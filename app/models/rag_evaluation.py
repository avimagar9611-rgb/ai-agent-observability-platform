
from uuid import uuid4

from sqlalchemy import (
    String,
    Text,
    Float,
    DateTime,
    ForeignKey,
    func,
    JSON
)

from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RagEvaluation(Base):

    __tablename__ = "rag_evaluations"

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

    faithfulness_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    answer_relevancy_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    context_precision_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    context_recall_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    overall_score: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    evaluated_chunks: Mapped[int] = mapped_column(
        nullable=False,
        default=0
    )

    feedback: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    strengths: Mapped[list] = mapped_column(
        JSON,
        nullable=False
    )

    improvements: Mapped[list] = mapped_column(
        JSON,
        nullable=False
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
