
from app.models.trace import Trace


# ==========================================
# TEST CREATE TRACE
# ==========================================

def test_create_trace(client):

    response = client.post(
        "/traces",
        json={
            "agent_name": "TestAgent",
            "input": "Explain RAG",
            "output": "RAG retrieves relevant information.",
            "execution_time": 1.5,
            "status": "success",
            "input_tokens": 100,
            "output_tokens": 50,
            "total_tokens": 150,
            "estimated_cost": 0.0
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["message"] == "Trace created successfully"
    assert data["trace"]["agent_name"] == "TestAgent"
    assert data["trace"]["status"] == "success"
    assert data["trace"]["total_tokens"] == 150


# ==========================================
# TEST GET AND FILTER TRACES
# ==========================================

def test_get_traces_with_filters(client):

    client.post(
        "/traces",
        json={
            "agent_name": "ResearchAgent",
            "input": "Question 1",
            "output": "Answer 1",
            "execution_time": 1.0,
            "status": "success"
        }
    )

    client.post(
        "/traces",
        json={
            "agent_name": "TestAgent",
            "input": "Question 2",
            "output": "Answer 2",
            "execution_time": 2.0,
            "status": "error"
        }
    )

    response = client.get(
        "/traces",
        params={"status": "success"}
    )

    assert response.status_code == 200

    traces = response.json()

    assert len(traces) == 1
    assert traces[0]["agent_name"] == "ResearchAgent"


# ==========================================
# TEST GET SINGLE TRACE
# ==========================================

def test_get_single_trace(client):

    create_response = client.post(
        "/traces",
        json={
            "agent_name": "ResearchAgent",
            "input": "Explain embeddings",
            "output": "Embeddings represent text as vectors.",
            "execution_time": 1.2,
            "status": "success"
        }
    )

    trace_id = create_response.json()["trace"]["id"]

    response = client.get(
        f"/traces/{trace_id}"
    )

    assert response.status_code == 200
    assert response.json()["id"] == trace_id


# ==========================================
# TEST TRACE NOT FOUND
# ==========================================

def test_trace_not_found(client):

    response = client.get(
        "/traces/invalid-trace-id"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == "Trace not found"


# ==========================================
# TEST OBSERVABILITY METRICS
# ==========================================

def test_metrics(client):

    client.post(
        "/traces",
        json={
            "agent_name": "ResearchAgent",
            "input": "Question 1",
            "output": "Answer 1",
            "execution_time": 2.0,
            "status": "success",
            "input_tokens": 100,
            "output_tokens": 50,
            "total_tokens": 150
        }
    )

    client.post(
        "/traces",
        json={
            "agent_name": "ResearchAgent",
            "input": "Question 2",
            "output": "Execution failed",
            "execution_time": 4.0,
            "status": "error",
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0
        }
    )

    response = client.get("/metrics")

    assert response.status_code == 200

    metrics = response.json()

    assert metrics["total_traces"] == 2
    assert metrics["successful_traces"] == 1
    assert metrics["failed_traces"] == 1
    assert metrics["success_rate"] == 50.0
    assert metrics["failure_rate"] == 50.0
    assert metrics["total_tokens"] == 150


# ==========================================
# TEST AGENT ENDPOINT WITH MOCK EXECUTION
# ==========================================

def test_agent_run_endpoint(client, db_session, monkeypatch):

    trace = Trace(
        agent_name="ResearchAgent",
        input="Explain RAG",
        output="RAG retrieves relevant information.",
        execution_time=1.5,
        status="success",
        input_tokens=100,
        output_tokens=50,
        total_tokens=150,
        estimated_cost=0.0
    )

    db_session.add(trace)
    db_session.commit()
    db_session.refresh(trace)

    retrieved_chunks = [
        {
            "text": "RAG combines retrieval and generation.",
            "source": "test.txt",
            "chunk_index": 0,
            "distance": 0.2
        }
    ]

    def mock_execute_agent(agent_name, user_input, db):

        return trace, retrieved_chunks

    monkeypatch.setattr(
        "api.execute_agent",
        mock_execute_agent
    )

    response = client.post(
        "/agents/run",
        json={
            "agent_name": "ResearchAgent",
            "input": "Explain RAG"
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["trace"]["status"] == "success"
    assert data["total_retrieved_chunks"] == 1
    assert len(data["retrieved_chunks"]) == 1

# ==========================================
# ADDITIONAL ERROR HANDLING TESTS
# ==========================================

# TEST 7: INVALID TRACE DATA
def test_create_trace_with_invalid_data(client):

    response = client.post(
        "/traces",
        json={
            "agent_name": "",
            "input": "Explain RAG",
            "output": "RAG answer",
            "execution_time": 1.5,
            "status": "success"
        }
    )

    assert response.status_code == 422


# TEST 8: RULE-BASED EVALUATION - TRACE NOT FOUND
def test_rule_evaluation_trace_not_found(client):

    response = client.post(
        "/evaluations",
        json={
            "trace_id": "non-existent-id"
        }
    )

    assert response.status_code == 404


# TEST 9: GROQ EVALUATION - TRACE NOT FOUND
def test_llm_evaluation_trace_not_found(client):

    response = client.post(
        "/llm-evaluations",
        json={
            "trace_id": "non-existent-id"
        }
    )

    assert response.status_code == 404


# TEST 10: RAG EVALUATION - TRACE NOT FOUND
def test_rag_evaluation_trace_not_found(client):

    response = client.post(
        "/rag-evaluations",
        json={
            "trace_id": "non-existent-id",
            "retrieved_chunks": []
        }
    )

    assert response.status_code == 404


# TEST 11: GROQ EVALUATION - FAILED TRACE
def test_llm_evaluation_rejects_failed_trace(client, db_session):

    trace = Trace(
        agent_name="TestAgent",
        input="Explain RAG",
        output="Execution failed",
        execution_time=1.5,
        status="error",
        input_tokens=0,
        output_tokens=0,
        total_tokens=0,
        estimated_cost=0.0
    )

    db_session.add(trace)
    db_session.commit()
    db_session.refresh(trace)

    response = client.post(
        "/llm-evaluations",
        json={
            "trace_id": trace.id
        }
    )

    assert response.status_code == 400


# TEST 12: RAG EVALUATION - FAILED TRACE
def test_rag_evaluation_rejects_failed_trace(client, db_session):

    trace = Trace(
        agent_name="TestAgent",
        input="Explain RAG",
        output="Execution failed",
        execution_time=1.5,
        status="error",
        input_tokens=0,
        output_tokens=0,
        total_tokens=0,
        estimated_cost=0.0
    )

    db_session.add(trace)
    db_session.commit()
    db_session.refresh(trace)

    response = client.post(
        "/rag-evaluations",
        json={
            "trace_id": trace.id
        }
    )

    assert response.status_code == 400
