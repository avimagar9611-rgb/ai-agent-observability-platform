
from database import Base, engine

# Import all models so SQLAlchemy registers their tables
from app.models.trace import Trace
from app.models.evaluation import Evaluation
from app.models.llm_evaluation import LlmEvaluation
from app.models.rag_evaluation import RagEvaluation


def create_tables():
    try:
        Base.metadata.create_all(bind=engine)

        print("All database tables created successfully!")

        print("\nRegistered tables:")
        for table_name in Base.metadata.tables.keys():
            print(f"- {table_name}")

    except Exception as error:
        print("Database table creation failed!")
        print(type(error).__name__, error)


if __name__ == "__main__":
    create_tables()
