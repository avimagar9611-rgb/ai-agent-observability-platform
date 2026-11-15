
from uuid import uuid4

from sqlalchemy import String, Text, Float, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Trace(Base):
    __tablename__ = "traces"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    agent_name: Mapped[str] = mapped_column(String(100))

    input: Mapped[str] = mapped_column(Text)

    output: Mapped[str] = mapped_column(Text)

    execution_time: Mapped[float] = mapped_column(Float)

    status: Mapped[str] = mapped_column(String(20))

    input_tokens: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0"
    )

    output_tokens: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0"
    )

    total_tokens: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0"
    )

    estimated_cost: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        server_default="0.0"
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
