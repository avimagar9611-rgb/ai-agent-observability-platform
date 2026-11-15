
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# Load environment variables
load_dotenv()


# Create PostgreSQL connection URL safely
database_url = URL.create(
    drivername="postgresql+psycopg",
    username=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT", "9611")),
    database=os.getenv("DB_NAME")
)


# Create database engine
engine = create_engine(
    database_url,
    pool_pre_ping=True
)


# Base class for all database models
class Base(DeclarativeBase):
    pass


# Create database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# FastAPI database dependency
def get_db():
    db = SessionLocal()

    try:
        yield db

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# Create all database tables
if __name__ == "__main__":

    # Import all models before creating tables
    from app.models.trace import Trace
    from app.models.evaluation import Evaluation
    from app.models.llm_evaluation import LlmEvaluation
    from app.models.rag_evaluation import RagEvaluation

    try:
        Base.metadata.create_all(bind=engine)

        print("All database tables created successfully!")

        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT version()")
            )

            print("PostgreSQL connected successfully!")
            print(result.scalar())

    except Exception as error:
        print("Database operation failed!")
        print(error)
        raise
