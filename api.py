
import os
import logging

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from database import get_db

from app.models.trace import Trace
from app.models.evaluation import Evaluation
from app.models.llm_evaluation import LlmEvaluation
from app.models.rag_evaluation import RagEvaluation

from app.services.agent_service import execute_agent
from app.services.evaluation_service import evaluate_trace
from app.services.llm_evaluation_service import evaluate_with_groq
from app.services.rag_evaluation_service import evaluate_rag

from app.routes.document_routes import router as document_router


# ==========================================
# LOGGING CONFIGURATION
# ==========================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


# ==========================================
# INITIALIZE FASTAPI
# ==========================================

app = FastAPI(
    title="AI Agent Observability Platform",
    description="Track, monitor and evaluate AI agent executions and RAG pipelines",
    version="1.1.0"
)


# ==========================================
# CORS CONFIGURATION
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# REGISTER ROUTERS
# ==========================================

app.include_router(document_router)


# ==========================================
# REQUEST MODELS
# ==========================================

class TraceRequest(BaseModel):
    agent_name: str = Field(min_length=1)
    input: str = Field(min_length=1)
    output: str = Field(min_length=1)
    execution_time: float = Field(ge=0)
    status: str = Field(min_length=1)
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    estimated_cost: float = Field(default=0.0, ge=0)


class AgentRunRequest(BaseModel):
    agent_name: str = Field(min_length=1)
    input: str = Field(min_length=1)


class EvaluationRequest(BaseModel):
    trace_id: str = Field(min_length=1)


class RagEvaluationRequest(BaseModel):
    trace_id: str = Field(min_length=1)

    retrieved_chunks: list[dict] = Field(
        default_factory=list
    )

    reference_answer: str | None = None


# ==========================================
# CREATE TRACE
# ==========================================

@app.post("/traces")
def create_trace(
    trace: TraceRequest,
    db: Session = Depends(get_db)
):

    try:
        new_trace = Trace(
            agent_name=trace.agent_name,
            input=trace.input,
            output=trace.output,
            execution_time=trace.execution_time,
            status=trace.status,
            input_tokens=trace.input_tokens,
            output_tokens=trace.output_tokens,
            total_tokens=trace.total_tokens,
            estimated_cost=trace.estimated_cost
        )

        db.add(new_trace)
        db.commit()
        db.refresh(new_trace)

        logger.info("Trace created successfully: %s", new_trace.id)

        return {
            "message": "Trace created successfully",
            "trace": new_trace
        }

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Database error while creating trace")

        raise HTTPException(
            status_code=500,
            detail="Unable to save trace. Please try again."
        )


# ==========================================
# GET ALL TRACES WITH FILTERS
# ==========================================

@app.get("/traces")
def get_traces(
    status: str | None = None,
    agent_name: str | None = None,
    db: Session = Depends(get_db)
):

    try:
        query = db.query(Trace)

        if status:
            query = query.filter(Trace.status == status)

        if agent_name:
            query = query.filter(Trace.agent_name == agent_name)

        return query.order_by(
            Trace.created_at.desc()
        ).all()

    except SQLAlchemyError:
        logger.exception("Database error while retrieving traces")

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve traces."
        )


# ==========================================
# GET SINGLE TRACE
# ==========================================

@app.get("/traces/{trace_id}")
def get_trace(
    trace_id: str,
    db: Session = Depends(get_db)
):

    try:
        trace = db.query(Trace).filter(
            Trace.id == trace_id
        ).first()

        if trace is None:
            raise HTTPException(
                status_code=404,
                detail="Trace not found"
            )

        return trace

    except HTTPException:
        raise

    except SQLAlchemyError:
        logger.exception("Database error while retrieving trace")

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve trace."
        )


# ==========================================
# RUN AI AGENT WITH RAG TRANSPARENCY
# ==========================================

@app.post("/agents/run")
def run_agent(
    request: AgentRunRequest,
    db: Session = Depends(get_db)
):

    try:
        trace, retrieved_chunks = execute_agent(
            agent_name=request.agent_name,
            user_input=request.input,
            db=db
        )

        message = (
            "Agent executed successfully and trace saved"
            if trace.status == "success"
            else "Agent failed and error trace saved"
        )

        return {
            "message": message,
            "trace": trace,
            "total_retrieved_chunks": len(retrieved_chunks),
            "retrieved_chunks": retrieved_chunks
        }

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Database error during agent execution")

        raise HTTPException(
            status_code=500,
            detail="Unable to save agent execution trace."
        )

    except Exception:
        db.rollback()
        logger.exception("Unexpected error during agent execution")

        raise HTTPException(
            status_code=500,
            detail="Agent execution could not be completed."
        )


# ==========================================
# CREATE RULE-BASED EVALUATION
# ==========================================

@app.post("/evaluations")
def create_evaluation(
    request: EvaluationRequest,
    db: Session = Depends(get_db)
):

    try:
        evaluation = evaluate_trace(
            trace_id=request.trace_id,
            db=db
        )

        if evaluation is None:
            raise HTTPException(
                status_code=404,
                detail="Trace not found"
            )

        logger.info(
            "Rule-based evaluation completed for trace: %s",
            request.trace_id
        )

        return {
            "message": "Evaluation completed successfully",
            "evaluation": evaluation
        }

    except HTTPException:
        raise

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Database error during rule-based evaluation")

        raise HTTPException(
            status_code=500,
            detail="Unable to save evaluation."
        )

    except Exception:
        db.rollback()
        logger.exception("Unexpected rule-based evaluation error")

        raise HTTPException(
            status_code=500,
            detail="Evaluation could not be completed."
        )


# ==========================================
# GET ALL RULE-BASED EVALUATIONS
# ==========================================

@app.get("/evaluations")
def get_evaluations(
    db: Session = Depends(get_db)
):

    try:
        return db.query(Evaluation).order_by(
            Evaluation.created_at.desc()
        ).all()

    except SQLAlchemyError:
        logger.exception("Database error while retrieving evaluations")

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve evaluations."
        )


# ==========================================
# CREATE GROQ LLM EVALUATION
# ==========================================

@app.post("/llm-evaluations")
def create_llm_evaluation(
    request: EvaluationRequest,
    db: Session = Depends(get_db)
):

    try:
        trace = db.query(Trace).filter(
            Trace.id == request.trace_id
        ).first()

        if trace is None:
            raise HTTPException(
                status_code=404,
                detail="Trace not found"
            )

        if trace.status != "success":
            raise HTTPException(
                status_code=400,
                detail="Cannot evaluate a failed agent execution"
            )

        result = evaluate_with_groq(
            user_input=trace.input,
            agent_output=trace.output
        )

        new_evaluation = LlmEvaluation(
            trace_id=trace.id,
            relevance_score=result["relevance_score"],
            correctness_score=result["correctness_score"],
            completeness_score=result["completeness_score"],
            clarity_score=result["clarity_score"],
            overall_score=result["overall_score"],
            feedback=result["feedback"],
            strengths=result["strengths"],
            improvements=result["improvements"],
            model_name="Groq - " + os.getenv(
                "GROQ_MODEL",
                "openai/gpt-oss-20b"
            )
        )

        db.add(new_evaluation)
        db.commit()
        db.refresh(new_evaluation)

        logger.info(
            "Groq evaluation saved for trace: %s",
            trace.id
        )

        return {
            "message": "Groq LLM evaluation completed and saved successfully",
            "evaluation": new_evaluation
        }

    except HTTPException:
        raise

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Database error during Groq evaluation")

        raise HTTPException(
            status_code=500,
            detail="Unable to save Groq evaluation."
        )

    except Exception:
        db.rollback()
        logger.exception("Groq evaluation failed")

        raise HTTPException(
            status_code=502,
            detail="Groq evaluation failed. Check your API key, model configuration and server logs."
        )


# ==========================================
# GET ALL GROQ LLM EVALUATIONS
# ==========================================

@app.get("/llm-evaluations")
def get_llm_evaluations(
    db: Session = Depends(get_db)
):

    try:
        return db.query(LlmEvaluation).order_by(
            LlmEvaluation.created_at.desc()
        ).all()

    except SQLAlchemyError:
        logger.exception("Database error while retrieving Groq evaluations")

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve Groq evaluations."
        )


# ==========================================
# CREATE RAG EVALUATION
# ==========================================

@app.post("/rag-evaluations")
def create_rag_evaluation(
    request: RagEvaluationRequest,
    db: Session = Depends(get_db)
):

    try:
        trace = db.query(Trace).filter(
            Trace.id == request.trace_id
        ).first()

        if trace is None:
            raise HTTPException(
                status_code=404,
                detail="Trace not found"
            )

        if trace.status != "success":
            raise HTTPException(
                status_code=400,
                detail="Cannot evaluate a failed agent execution"
            )

        result = evaluate_rag(
            user_input=trace.input,
            agent_output=trace.output,
            retrieved_chunks=request.retrieved_chunks,
            reference_answer=request.reference_answer
        )

        new_evaluation = RagEvaluation(
            trace_id=trace.id,
            faithfulness_score=result["faithfulness_score"],
            answer_relevancy_score=result["answer_relevancy_score"],
            context_precision_score=result["context_precision_score"],
            context_recall_score=result["context_recall_score"],
            overall_score=result["overall_score"],
            evaluated_chunks=result["evaluated_chunks"],
            feedback=result["feedback"],
            strengths=result["strengths"],
            improvements=result["improvements"]
        )

        db.add(new_evaluation)
        db.commit()
        db.refresh(new_evaluation)

        logger.info(
            "RAG evaluation saved for trace: %s",
            trace.id
        )

        return {
            "message": "RAG evaluation completed and saved successfully",
            "evaluation": new_evaluation
        }

    except HTTPException:
        raise

    except SQLAlchemyError:
        db.rollback()
        logger.exception("Database error during RAG evaluation")

        raise HTTPException(
            status_code=500,
            detail="Unable to save RAG evaluation."
        )

    except Exception:
        db.rollback()
        logger.exception("RAG evaluation failed")

        raise HTTPException(
            status_code=502,
            detail="RAG evaluation failed. Check the server logs and Groq configuration."
        )


# ==========================================
# GET ALL RAG EVALUATIONS
# ==========================================

@app.get("/rag-evaluations")
def get_rag_evaluations(
    db: Session = Depends(get_db)
):

    try:
        return db.query(RagEvaluation).order_by(
            RagEvaluation.created_at.desc()
        ).all()

    except SQLAlchemyError:
        logger.exception("Database error while retrieving RAG evaluations")

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve RAG evaluations."
        )


# ==========================================
# OBSERVABILITY METRICS
# ==========================================

@app.get("/metrics")
def get_metrics(
    db: Session = Depends(get_db)
):

    try:
        total_traces = db.query(
            func.count(Trace.id)
        ).scalar() or 0

        successful_traces = db.query(
            func.count(Trace.id)
        ).filter(
            Trace.status == "success"
        ).scalar() or 0

        failed_traces = db.query(
            func.count(Trace.id)
        ).filter(
            Trace.status == "error"
        ).scalar() or 0

        success_rate = (
            successful_traces / total_traces * 100
            if total_traces > 0 else 0.0
        )

        failure_rate = (
            failed_traces / total_traces * 100
            if total_traces > 0 else 0.0
        )

        average_execution_time = db.query(
            func.avg(Trace.execution_time)
        ).scalar() or 0.0

        total_execution_time = db.query(
            func.sum(Trace.execution_time)
        ).scalar() or 0.0

        fastest_execution = db.query(
            func.min(Trace.execution_time)
        ).scalar()

        slowest_execution = db.query(
            func.max(Trace.execution_time)
        ).scalar()

        total_input_tokens = db.query(
            func.sum(Trace.input_tokens)
        ).scalar() or 0

        total_output_tokens = db.query(
            func.sum(Trace.output_tokens)
        ).scalar() or 0

        total_tokens = db.query(
            func.sum(Trace.total_tokens)
        ).scalar() or 0

        average_tokens_per_trace = db.query(
            func.avg(Trace.total_tokens)
        ).scalar() or 0.0

        total_estimated_cost = db.query(
            func.sum(Trace.estimated_cost)
        ).scalar() or 0.0

        return {
            "total_traces": total_traces,
            "successful_traces": successful_traces,
            "failed_traces": failed_traces,
            "success_rate": round(success_rate, 2),
            "failure_rate": round(failure_rate, 2),

            "average_execution_time": round(
                float(average_execution_time), 6
            ),

            "total_execution_time": round(
                float(total_execution_time), 6
            ),

            "fastest_execution": (
                round(float(fastest_execution), 6)
                if fastest_execution is not None else None
            ),

            "slowest_execution": (
                round(float(slowest_execution), 6)
                if slowest_execution is not None else None
            ),

            "total_input_tokens": int(total_input_tokens),
            "total_output_tokens": int(total_output_tokens),
            "total_tokens": int(total_tokens),

            "average_tokens_per_trace": round(
                float(average_tokens_per_trace), 2
            ),

            "total_estimated_cost": round(
                float(total_estimated_cost), 8
            )
        }

    except SQLAlchemyError:
        logger.exception("Database error while calculating metrics")

        raise HTTPException(
            status_code=500,
            detail="Unable to calculate observability metrics."
        )
