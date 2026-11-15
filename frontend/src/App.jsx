
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [metrics, setMetrics] = useState({});
  const [traces, setTraces] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [llmEvaluations, setLlmEvaluations] = useState([]);
  const [ragEvaluations, setRagEvaluations] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("dashboard");

  const [traceFilter, setTraceFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrace, setSelectedTrace] = useState(null);

  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [evaluationSuccess, setEvaluationSuccess] = useState("");

  const [llmEvaluating, setLlmEvaluating] = useState(false);
  const [llmEvaluationError, setLlmEvaluationError] = useState("");
  const [llmEvaluationSuccess, setLlmEvaluationSuccess] = useState("");

  const [ragEvaluating, setRagEvaluating] = useState(false);
  const [ragEvaluationError, setRagEvaluationError] = useState("");
  const [ragEvaluationSuccess, setRagEvaluationSuccess] = useState("");

  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentSuccess, setDocumentSuccess] = useState("");

  // RAG Playground
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragRunning, setRagRunning] = useState(false);
  const [ragError, setRagError] = useState("");
  const [ragResult, setRagResult] = useState(null);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch(`${API_URL}/metrics`),
        fetch(`${API_URL}/traces`),
        fetch(`${API_URL}/evaluations`),
        fetch(`${API_URL}/llm-evaluations`),
        fetch(`${API_URL}/documents/`),
        fetch(`${API_URL}/rag-evaluations`),
      ]);

      if (responses.some((response) => !response.ok)) {
        throw new Error("Unable to fetch dashboard data.");
      }

      const [
        metricsData,
        tracesData,
        evaluationsData,
        llmEvaluationsData,
        documentsData,
        ragEvaluationsData,
      ] = await Promise.all(responses.map((response) => response.json()));

      setMetrics(metricsData);
      setTraces(Array.isArray(tracesData) ? tracesData : []);
      setEvaluations(Array.isArray(evaluationsData) ? evaluationsData : []);
      setLlmEvaluations(
        Array.isArray(llmEvaluationsData) ? llmEvaluationsData : []
      );
      setDocuments(
        Array.isArray(documentsData.documents) ? documentsData.documents : []
      );
      setRagEvaluations(
        Array.isArray(ragEvaluationsData) ? ragEvaluationsData : []
      );

      setError("");
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(
        "Cannot connect to backend. Make sure FastAPI is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    const interval = setInterval(fetchDashboardData, 5000);

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Dashboard metrics
  const totalTraces = Number(metrics.total_traces ?? traces.length);

  const successRate = Number(
    metrics.success_rate ?? metrics.success_rate_percentage ?? 0
  );

  const failedTraces = Number(
    metrics.failed_traces ??
      metrics.failure_count ??
      traces.filter((trace) => trace.status === "error").length
  );

  const totalTokens = Number(
    metrics.total_tokens ??
      traces.reduce((sum, trace) => sum + Number(trace.total_tokens || 0), 0)
  );

  const averageExecutionTime = Number(
    metrics.average_execution_time ?? metrics.avg_execution_time ?? 0
  );

  const estimatedCost = Number(
    metrics.total_estimated_cost ??
      metrics.estimated_cost ??
      traces.reduce((sum, trace) => sum + Number(trace.estimated_cost || 0), 0)
  );

  // Sort evaluations
  const sortedEvaluations = [...evaluations].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const sortedLlmEvaluations = [...llmEvaluations].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const sortedRagEvaluations = [...ragEvaluations].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const latestEvaluation = sortedEvaluations[0];
  const latestLlmEvaluation = sortedLlmEvaluations[0];
  const latestRagEvaluation = sortedRagEvaluations[0];

  // Evaluation analytics
  const totalEvaluations = evaluations.length;

  const averageScore = totalEvaluations
    ? evaluations.reduce(
        (sum, item) => sum + Number(item.overall_score || 0),
        0
      ) / totalEvaluations
    : 0;

  const highestScore = totalEvaluations
    ? Math.max(...evaluations.map((item) => Number(item.overall_score || 0)))
    : 0;

  const lowestScore = totalEvaluations
    ? Math.min(...evaluations.map((item) => Number(item.overall_score || 0)))
    : 0;

  const averageRelevance = totalEvaluations
    ? evaluations.reduce(
        (sum, item) => sum + Number(item.relevance_score || 0),
        0
      ) / totalEvaluations
    : 0;

  const averageCompleteness = totalEvaluations
    ? evaluations.reduce(
        (sum, item) => sum + Number(item.completeness_score || 0),
        0
      ) / totalEvaluations
    : 0;

  const averageQuality = totalEvaluations
    ? evaluations.reduce(
        (sum, item) => sum + Number(item.quality_score || 0),
        0
      ) / totalEvaluations
    : 0;

  const evaluationTrend = [...evaluations]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-10);

  const chartTraces = [...traces]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 7)
    .reverse();

  const maxExecutionTime = Math.max(
    ...chartTraces.map((trace) => Number(trace.execution_time || 0)),
    0.1
  );

  // Trace filtering
  const filteredTraces = traces.filter((trace) => {
    const matchesFilter =
      traceFilter === "all" || trace.status === traceFilter;

    const search = searchTerm.toLowerCase();

    const matchesSearch =
      trace.agent_name?.toLowerCase().includes(search) ||
      trace.input?.toLowerCase().includes(search) ||
      trace.id?.toLowerCase().includes(search);

    return matchesFilter && matchesSearch;
  });

  // Selected trace evaluations
  const selectedTraceEvaluation = selectedTrace
    ? sortedEvaluations.find(
        (evaluation) => evaluation.trace_id === selectedTrace.id
      )
    : null;

  const selectedTraceLlmEvaluation = selectedTrace
    ? sortedLlmEvaluations.find(
        (evaluation) => evaluation.trace_id === selectedTrace.id
      )
    : null;

  const selectedTraceRagEvaluation = selectedTrace
    ? sortedRagEvaluations.find(
        (evaluation) => evaluation.trace_id === selectedTrace.id
      )
    : null;

  // Run Research Agent
  const handleRunRag = async (event) => {
    event.preventDefault();

    const question = ragQuestion.trim();

    if (!question) {
      setRagError("Please enter a question.");
      return;
    }

    if (ragRunning) return;

    setRagRunning(true);
    setRagError("");
    setRagResult(null);
    setRagEvaluationError("");
    setRagEvaluationSuccess("");

    try {
      const response = await fetch(`${API_URL}/agents/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_name: "ResearchAgent",
          input: question,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || result.message || "Agent execution failed."
        );
      }

      const trace = result.trace ?? result.data ?? result;

      setRagResult({
        message: result.message || "Agent execution completed.",
        traceId: trace.id ?? trace.trace_id ?? result.trace_id ?? null,
        output:
          trace.output ??
          result.output ??
          result.answer ??
          "No output was returned.",
        status: trace.status ?? result.status ?? "success",
        executionTime: trace.execution_time ?? result.execution_time ?? null,
        inputTokens: trace.input_tokens ?? result.input_tokens ?? 0,
        outputTokens: trace.output_tokens ?? result.output_tokens ?? 0,
        totalTokens: trace.total_tokens ?? result.total_tokens ?? 0,
        estimatedCost: trace.estimated_cost ?? result.estimated_cost ?? 0,
        retrievedChunks: Array.isArray(result.retrieved_chunks)
          ? result.retrieved_chunks
          : [],
        totalRetrievedChunks: Number(result.total_retrieved_chunks || 0),
        raw: result,
      });

      await fetchDashboardData();
    } catch (err) {
      console.error("RAG execution error:", err);
      setRagError(err.message || "Something went wrong.");
    } finally {
      setRagRunning(false);
    }
  };

  // Rule-based evaluation
  const handleEvaluateTrace = async () => {
    if (!selectedTrace || evaluating) return;

    setEvaluating(true);
    setEvaluationError("");
    setEvaluationSuccess("");

    try {
      const response = await fetch(`${API_URL}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace_id: selectedTrace.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Evaluation failed.");
      }

      const savedEvaluation = result.evaluation ?? result;

      if (!savedEvaluation.id || !savedEvaluation.trace_id) {
        throw new Error("Unexpected evaluation response format.");
      }

      setEvaluations((previous) => [
        savedEvaluation,
        ...previous.filter((item) => item.id !== savedEvaluation.id),
      ]);

      setEvaluationSuccess("Evaluation completed successfully!");

      await fetchDashboardData();
    } catch (err) {
      setEvaluationError(err.message || "Something went wrong.");
    } finally {
      setEvaluating(false);
    }
  };

  // Groq LLM evaluation
  const handleLlmEvaluateTrace = async () => {
    if (!selectedTrace || llmEvaluating) return;

    setLlmEvaluating(true);
    setLlmEvaluationError("");
    setLlmEvaluationSuccess("");

    try {
      const response = await fetch(`${API_URL}/llm-evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace_id: selectedTrace.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Groq LLM evaluation failed.");
      }

      const savedEvaluation = result.evaluation ?? result;

      if (!savedEvaluation.id || !savedEvaluation.trace_id) {
        throw new Error("Unexpected Groq evaluation response format.");
      }

      setLlmEvaluations((previous) => [
        savedEvaluation,
        ...previous.filter((item) => item.id !== savedEvaluation.id),
      ]);

      setLlmEvaluationSuccess(
        "Groq evaluation completed and saved successfully!"
      );

      await fetchDashboardData();
    } catch (err) {
      setLlmEvaluationError(err.message || "Groq evaluation failed.");
    } finally {
      setLlmEvaluating(false);
    }
  };

  // RAG evaluation
  const handleRagEvaluate = async () => {
    if (!ragResult?.traceId) {
      setRagEvaluationError(
        "No trace ID available. Run the ResearchAgent first."
      );
      return;
    }

    if (!ragResult.retrievedChunks?.length) {
      setRagEvaluationError("No retrieved document chunks available.");
      return;
    }

    if (ragEvaluating) return;

    setRagEvaluating(true);
    setRagEvaluationError("");
    setRagEvaluationSuccess("");

    try {
      const response = await fetch(`${API_URL}/rag-evaluations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trace_id: ragResult.traceId,
          retrieved_chunks: ragResult.retrievedChunks,
          reference_answer: null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "RAG evaluation failed.");
      }

      const savedEvaluation = result.evaluation ?? result;

      if (!savedEvaluation.id || !savedEvaluation.trace_id) {
        throw new Error("Unexpected RAG evaluation response.");
      }

      setRagEvaluations((previous) => [
        savedEvaluation,
        ...previous.filter((item) => item.id !== savedEvaluation.id),
      ]);

      setRagEvaluationSuccess(
        "RAG evaluation completed and saved successfully!"
      );

      await fetchDashboardData();
    } catch (err) {
      console.error("RAG evaluation error:", err);
      setRagEvaluationError(err.message || "RAG evaluation failed.");
    } finally {
      setRagEvaluating(false);
    }
  };

  // Upload document
  const handleDocumentUpload = async (event) => {
    event.preventDefault();

    if (!uploadFile) {
      setDocumentError("Please select a PDF or TXT file.");
      return;
    }

    const extension = uploadFile.name.split(".").pop().toLowerCase();

    if (!["pdf", "txt"].includes(extension)) {
      setDocumentError("Only PDF and TXT files are supported.");
      return;
    }

    setUploading(true);
    setDocumentError("");
    setDocumentSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const response = await fetch(`${API_URL}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Document upload failed.");
      }

      setDocumentSuccess(
        `${result.original_filename} uploaded successfully! ${result.total_chunks} chunks created.`
      );

      setUploadFile(null);
      event.currentTarget.reset();

      await fetchDashboardData();
    } catch (err) {
      setDocumentError(err.message || "Document upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // Helpers
  const formatDate = (date) =>
    date ? new Date(date).toLocaleString() : "N/A";

  const formatScore = (score) =>
    score === null || score === undefined
      ? "N/A"
      : Number(score).toFixed(1);

  const dimensionWidth = (score) =>
    `${Math.min(100, Math.max(0, Number(score || 0)))}%`;

  const formatFileSize = (bytes) => {
    const size = Number(bytes || 0);

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const openTraceDetails = (trace) => {
    setSelectedTrace(trace);
    setEvaluationError("");
    setEvaluationSuccess("");
    setLlmEvaluationError("");
    setLlmEvaluationSuccess("");
  };

  const closeTraceDetails = () => {
    setSelectedTrace(null);
    setEvaluationError("");
    setEvaluationSuccess("");
    setLlmEvaluationError("");
    setLlmEvaluationSuccess("");
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <h2>AgentWatch</h2>
        <p>Loading your observability dashboard...</p>
      </div>
    );
  }

  const pageTitles = {
    dashboard: "Dashboard",
    traces: "Traces",
    evaluations: "Evaluations",
    analytics: "Analytics",
    documents: "Documents",
    rag: "RAG Playground",
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <span>◈</span> AgentWatch
        </div>

        <div className="menu-heading">MENU</div>

        <nav>
          {[
            ["dashboard", "▦", "Dashboard"],
            ["traces", "⌁", "Traces"],
            ["evaluations", "◉", "Evaluations"],
            ["analytics", "▥", "Analytics"],
            ["documents", "▤", "Documents"],
            ["rag", "✧", "RAG Playground"],
          ].map(([page, icon, label]) => (
            <div
              key={page}
              className={`nav-item ${activePage === page ? "active" : ""}`}
              onClick={() => setActivePage(page)}
            >
              <span>{icon}</span> {label}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <p>AI Agent Observability</p>
          <span>Version 1.0</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{pageTitles[activePage]}</h1>
            <p>
              {activePage === "documents"
                ? "Manage your RAG knowledge base"
                : activePage === "rag"
                  ? "Ask questions using your uploaded knowledge documents"
                  : "Monitor and evaluate your AI agents"}
            </p>
          </div>

          <div className="profile">
            <span className="status-dot"></span>
            System Online
          </div>
        </header>

        {error && <div className="error-message">{error}</div>}

        {/* RAG PLAYGROUND */}
        {activePage === "rag" && (
          <section className="rag-playground">
            <div className="panel">
              <h2>Ask Your Knowledge Base</h2>

              <p className="panel-description">
                Ask a question about your uploaded PDF and TXT documents.
                ResearchAgent retrieves relevant chunks and generates an
                answer using Groq.
              </p>

              <form onSubmit={handleRunRag}>
                <textarea
                  value={ragQuestion}
                  onChange={(event) => setRagQuestion(event.target.value)}
                  placeholder="Example: Explain the important concepts covered in my uploaded documents..."
                  rows={5}
                  disabled={ragRunning}
                  style={{
                    width: "100%",
                    padding: "16px",
                    marginTop: "18px",
                    borderRadius: "10px",
                    resize: "vertical",
                    font: "inherit",
                  }}
                />

                <button
                  type="submit"
                  className="evaluate-button"
                  disabled={ragRunning || !ragQuestion.trim()}
                  style={{ marginTop: "16px" }}
                >
                  {ragRunning
                    ? "ResearchAgent is thinking..."
                    : "✧ Run Research Agent"}
                </button>
              </form>

              {ragError && (
                <div className="error-message" style={{ marginTop: "16px" }}>
                  {ragError}
                </div>
              )}
            </div>

            {/* Agent Response */}
            {ragResult && (
              <>
                <div className="panel" style={{ marginTop: "24px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2>ResearchAgent Response</h2>
                      <p className="panel-description">
                        Generated using your RAG knowledge base
                      </p>
                    </div>

                    <span
                      className={
                        ragResult.status === "success"
                          ? "success-badge"
                          : "error-badge"
                      }
                    >
                      {ragResult.status}
                    </span>
                  </div>

                  <div
                    className="trace-content"
                    style={{
                      marginTop: "20px",
                      whiteSpace: "pre-wrap",
                      lineHeight: "1.8",
                    }}
                  >
                    {ragResult.output}
                  </div>

                  {ragResult.message && (
                    <p className="panel-description" style={{ marginTop: "16px" }}>
                      {ragResult.message}
                    </p>
                  )}
                </div>

                {/* Execution Metrics */}
                <div className="analytics-grid" style={{ marginTop: "24px" }}>
                  <div className="analytics-card">
                    <h3>Execution Time</h3>
                    <p>
                      {ragResult.executionTime !== null
                        ? `${Number(ragResult.executionTime).toFixed(3)}s`
                        : "N/A"}
                    </p>
                  </div>

                  <div className="analytics-card">
                    <h3>Input Tokens</h3>
                    <p>{Number(ragResult.inputTokens).toLocaleString()}</p>
                  </div>

                  <div className="analytics-card">
                    <h3>Output Tokens</h3>
                    <p>{Number(ragResult.outputTokens).toLocaleString()}</p>
                  </div>

                  <div className="analytics-card">
                    <h3>Total Tokens</h3>
                    <p>{Number(ragResult.totalTokens).toLocaleString()}</p>
                  </div>
                </div>

                {/* Retrieved Context */}
                <div className="panel" style={{ marginTop: "24px" }}>
                  <h2>Retrieved Context</h2>

                  <p className="panel-description">
                    These are the actual document chunks retrieved from
                    ChromaDB and supplied to the ResearchAgent.
                  </p>

                  <div className="analytics-grid" style={{ marginTop: "16px" }}>
                    <div className="analytics-card">
                      <h3>Retrieved Chunks</h3>
                      <p>{ragResult.totalRetrievedChunks}</p>
                    </div>

                    <div className="analytics-card">
                      <h3>Vector Database</h3>
                      <p style={{ fontSize: "18px" }}>ChromaDB</p>
                    </div>

                    <div className="analytics-card">
                      <h3>Embedding Model</h3>
                      <p style={{ fontSize: "18px" }}>MiniLM</p>
                    </div>
                  </div>

                  {ragResult.retrievedChunks.length === 0 ? (
                    <p style={{ marginTop: "18px" }}>
                      No retrieved chunks were returned by the backend.
                    </p>
                  ) : (
                    <div style={{ marginTop: "20px" }}>
                      {ragResult.retrievedChunks.map((chunk, index) => (
                        <div
                          key={`${chunk.source}-${chunk.chunk_index}-${index}`}
                          style={{
                            border: "1px solid rgba(128,128,128,0.25)",
                            borderRadius: "12px",
                            padding: "18px",
                            marginBottom: "16px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "10px",
                              marginBottom: "12px",
                            }}
                          >
                            <h3>Chunk {index + 1}</h3>
                            <span className="success-badge">Retrieved</span>
                          </div>

                          <p style={{ marginBottom: "10px" }}>
                            <strong>Source:</strong> {chunk.source || "Unknown"}
                          </p>

                          <p style={{ marginBottom: "10px" }}>
                            <strong>Chunk Index:</strong>{" "}
                            {chunk.chunk_index ?? "N/A"}
                          </p>

                          <p style={{ marginBottom: "10px" }}>
                            <strong>Distance:</strong>{" "}
                            {typeof chunk.distance === "number"
                              ? chunk.distance.toFixed(4)
                              : "N/A"}
                          </p>

                          <div
                            style={{
                              background: "rgba(128,128,128,0.08)",
                              padding: "14px",
                              borderRadius: "8px",
                              whiteSpace: "pre-wrap",
                              lineHeight: "1.7",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {chunk.text || "No chunk text available."}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* RAG Evaluation */}
                <div className="panel" style={{ marginTop: "24px" }}>
                  <h2>RAG Quality Evaluation</h2>

                  <p className="panel-description">
                    Evaluate faithfulness, answer relevancy and context
                    precision using your Groq-powered LLM judge.
                  </p>

                  <button
                    className="evaluate-button"
                    onClick={handleRagEvaluate}
                    disabled={
                      ragEvaluating ||
                      !ragResult.traceId ||
                      ragResult.retrievedChunks.length === 0
                    }
                    style={{ marginTop: "16px" }}
                  >
                    {ragEvaluating
                      ? "Evaluating RAG..."
                      : "Evaluate RAG Response"}
                  </button>

                  {ragEvaluationError && (
                    <div
                      className="error-message"
                      style={{ marginTop: "16px" }}
                    >
                      {ragEvaluationError}
                    </div>
                  )}

                  {ragEvaluationSuccess && (
                    <div
                      className="success-message"
                      style={{ marginTop: "16px" }}
                    >
                      {ragEvaluationSuccess}
                    </div>
                  )}

                  {(() => {
                    const currentRagEvaluation = sortedRagEvaluations.find(
                      (item) => item.trace_id === ragResult.traceId
                    );

                    return currentRagEvaluation ? (
                      <div style={{ marginTop: "24px" }}>
                        <h3>Evaluation Results</h3>

                        <div className="score">
                          {formatScore(currentRagEvaluation.overall_score)}
                          <span>/100</span>
                        </div>

                        <div className="dimension-grid">
                          {[
                            [
                              "Faithfulness",
                              currentRagEvaluation.faithfulness_score,
                            ],
                            [
                              "Answer Relevancy",
                              currentRagEvaluation.answer_relevancy_score,
                            ],
                            [
                              "Context Precision",
                              currentRagEvaluation.context_precision_score,
                            ],
                          ].map(([label, score]) => (
                            <div className="dimension-card" key={label}>
                              <h4>{label}</h4>
                              <p>
                                {formatScore(score)}
                                <span>/100</span>
                              </p>
                              <div className="dimension-track">
                                <div
                                  className="dimension-fill"
                                  style={{ width: dimensionWidth(score) }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="modal-section" style={{ marginTop: "18px" }}>
                          <p>
                            <strong>Context Recall:</strong>{" "}
                            {formatScore(currentRagEvaluation.context_recall_score)}
                          </p>

                          <p>
                            <strong>Evaluated Chunks:</strong>{" "}
                            {currentRagEvaluation.evaluated_chunks}
                          </p>

                          <h3 style={{ marginTop: "16px" }}>Feedback</h3>
                          <p>{currentRagEvaluation.feedback}</p>

                          <h3 style={{ marginTop: "16px" }}>Strengths</h3>
                          {Array.isArray(currentRagEvaluation.strengths) &&
                          currentRagEvaluation.strengths.length > 0 ? (
                            <ul>
                              {currentRagEvaluation.strengths.map(
                                (item, index) => (
                                  <li key={index}>{item}</li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p>No strengths provided.</p>
                          )}

                          <h3 style={{ marginTop: "16px" }}>Improvements</h3>
                          {Array.isArray(currentRagEvaluation.improvements) &&
                          currentRagEvaluation.improvements.length > 0 ? (
                            <ul>
                              {currentRagEvaluation.improvements.map(
                                (item, index) => (
                                  <li key={index}>{item}</li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p>No improvements provided.</p>
                          )}

                          <p style={{ marginTop: "14px" }}>
                            <strong>Evaluated At:</strong>{" "}
                            {formatDate(currentRagEvaluation.created_at)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p style={{ marginTop: "18px" }}>
                        This response has not been evaluated yet.
                      </p>
                    );
                  })()}
                </div>

                {/* Execution Trace */}
                <div className="panel" style={{ marginTop: "24px" }}>
                  <h2>Execution Trace</h2>

                  <p className="panel-description">
                    This agent execution has been recorded in PostgreSQL.
                  </p>

                  <p style={{ marginTop: "14px" }}>
                    <strong>Trace ID:</strong>{" "}
                    {ragResult.traceId || "Trace ID not returned"}
                  </p>

                  <p style={{ marginTop: "10px" }}>
                    <strong>Estimated Cost:</strong> $
                    {Number(ragResult.estimatedCost || 0).toFixed(6)}
                  </p>

                  {ragResult.traceId && (
                    <button
                      className="view-button"
                      style={{ marginTop: "16px" }}
                      onClick={() => {
                        const trace = traces.find(
                          (item) => item.id === ragResult.traceId
                        );

                        if (trace) {
                          openTraceDetails(trace);
                        } else {
                          setActivePage("traces");
                        }
                      }}
                    >
                      View Saved Trace
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Knowledge Base */}
            <div className="panel" style={{ marginTop: "24px" }}>
              <h2>Knowledge Base</h2>

              <p className="panel-description">
                Documents currently available for retrieval
              </p>

              <div className="analytics-grid" style={{ marginTop: "16px" }}>
                <div className="analytics-card">
                  <h3>Total Documents</h3>
                  <p>{documents.length}</p>
                </div>

                <div className="analytics-card">
                  <h3>PDF Documents</h3>
                  <p>
                    {documents.filter((doc) => doc.file_type === ".pdf").length}
                  </p>
                </div>

                <div className="analytics-card">
                  <h3>TXT Documents</h3>
                  <p>
                    {documents.filter((doc) => doc.file_type === ".txt").length}
                  </p>
                </div>
              </div>

              <button
                className="view-button"
                style={{ marginTop: "16px" }}
                onClick={() => setActivePage("documents")}
              >
                Manage Documents
              </button>
            </div>
          </section>
        )}

        {/* DOCUMENTS PAGE */}
        {activePage === "documents" && (
          <section className="documents-page">
            <div className="panel documents-upload-panel">
              <h2>Document Management</h2>

              <p className="panel-description">
                Upload PDF and TXT documents to your RAG knowledge base.
              </p>

              <form onSubmit={handleDocumentUpload} className="upload-form">
                <div className="upload-area">
                  <div className="upload-icon">↑</div>
                  <h3>Upload Knowledge Documents</h3>
                  <p>Select a PDF or TXT file from your computer.</p>

                  <input
                    type="file"
                    accept=".pdf,.txt,application/pdf,text/plain"
                    onChange={(event) => {
                      setUploadFile(event.target.files[0] || null);
                      setDocumentError("");
                      setDocumentSuccess("");
                    }}
                  />

                  {uploadFile && (
                    <p className="selected-file">
                      Selected: {uploadFile.name}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="upload-button"
                    disabled={uploading || !uploadFile}
                  >
                    {uploading
                      ? "Uploading and Processing..."
                      : "Upload Document"}
                  </button>
                </div>
              </form>

              {documentError && (
                <div className="error-message">{documentError}</div>
              )}

              {documentSuccess && (
                <div className="success-message">{documentSuccess}</div>
              )}
            </div>

            <div className="documents-stats">
              <div className="analytics-card">
                <h3>Total Documents</h3>
                <p>{documents.length}</p>
              </div>

              <div className="analytics-card">
                <h3>PDF Documents</h3>
                <p>
                  {documents.filter((doc) => doc.file_type === ".pdf").length}
                </p>
              </div>

              <div className="analytics-card">
                <h3>TXT Documents</h3>
                <p>
                  {documents.filter((doc) => doc.file_type === ".txt").length}
                </p>
              </div>
            </div>

            <div className="panel documents-list-panel">
              <div className="documents-list-header">
                <div>
                  <h2>Uploaded Documents</h2>
                  <p className="panel-description">
                    Documents available in your RAG knowledge base
                  </p>
                </div>

                <button className="refresh-button" onClick={fetchDashboardData}>
                  ↻ Refresh
                </button>
              </div>

              {documents.length === 0 ? (
                <p className="empty-documents">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="documents-list">
                  {documents.map((document) => (
                    <div className="document-row" key={document.filename}>
                      <div className="document-icon">
                        {document.file_type === ".pdf" ? "📕" : "📄"}
                      </div>

                      <div className="document-info">
                        <strong>{document.filename}</strong>
                        <span>
                          {document.file_type.toUpperCase()} ·{" "}
                          {formatFileSize(document.size_bytes)}
                        </span>
                      </div>

                      <span className="document-status">Available</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* DASHBOARD */}
        {activePage === "dashboard" && (
          <>
            <section className="metrics-grid">
              <div className="metric-card">
                <h3>Total Traces</h3>
                <p>{totalTraces}</p>
                <span>Recorded executions</span>
              </div>

              <div className="metric-card">
                <h3>Success Rate</h3>
                <p>{successRate.toFixed(1)}%</p>
                <span>Successful executions</span>
              </div>

              <div className="metric-card">
                <h3>Failed Traces</h3>
                <p className="negative">{failedTraces}</p>
                <span>Failed executions</span>
              </div>

              <div className="metric-card">
                <h3>Total Tokens</h3>
                <p>{totalTokens.toLocaleString()}</p>
                <span>Estimated token usage</span>
              </div>

              <div className="metric-card">
                <h3>Average Latency</h3>
                <p>{averageExecutionTime.toFixed(3)}s</p>
                <span>Execution time</span>
              </div>

              <div className="metric-card">
                <h3>Estimated Cost</h3>
                <p>${estimatedCost.toFixed(5)}</p>
                <span>Recorded agent cost</span>
              </div>
            </section>

            <section className="content-grid">
              <div className="panel">
                <h2>Execution Performance</h2>
                <p className="panel-description">
                  Recent agent execution times
                </p>

                {chartTraces.length === 0 ? (
                  <p>No execution data available.</p>
                ) : (
                  <div className="chart-placeholder">
                    {chartTraces.map((trace) => (
                      <div
                        className="chart-bar"
                        key={trace.id}
                        title={`${trace.agent_name}: ${Number(
                          trace.execution_time
                        ).toFixed(3)} seconds`}
                        style={{
                          height: `${
                            (Number(trace.execution_time || 0) /
                              maxExecutionTime) *
                            100
                          }%`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="panel evaluation-panel">
                <h2>Latest Evaluation</h2>
                <p className="panel-description">
                  Most recently evaluated agent
                </p>

                {latestEvaluation ? (
                  <>
                    <div className="score">
                      {formatScore(latestEvaluation.overall_score)}
                      <span>/100</span>
                    </div>

                    <div className="evaluation-breakdown">
                      <p>
                        Relevance
                        <strong>
                          {formatScore(latestEvaluation.relevance_score)}
                        </strong>
                      </p>
                      <p>
                        Completeness
                        <strong>
                          {formatScore(latestEvaluation.completeness_score)}
                        </strong>
                      </p>
                      <p>
                        Quality
                        <strong>
                          {formatScore(latestEvaluation.quality_score)}
                        </strong>
                      </p>
                    </div>
                  </>
                ) : (
                  <p>No evaluations available yet.</p>
                )}
              </div>
            </section>

            {/* Latest Groq Evaluation */}
            <section className="panel" style={{ marginBottom: "24px" }}>
              <h2>Latest Groq LLM Evaluation</h2>
              <p className="panel-description">
                AI-powered assessment of your agent response
              </p>

              {latestLlmEvaluation ? (
                <>
                  <div className="score">
                    {formatScore(latestLlmEvaluation.overall_score)}
                    <span>/100</span>
                  </div>

                  <div className="dimension-grid">
                    {[
                      ["Relevance", latestLlmEvaluation.relevance_score],
                      ["Correctness", latestLlmEvaluation.correctness_score],
                      ["Completeness", latestLlmEvaluation.completeness_score],
                      ["Clarity", latestLlmEvaluation.clarity_score],
                    ].map(([label, score]) => (
                      <div className="dimension-card" key={label}>
                        <h4>{label}</h4>
                        <p>
                          {formatScore(score)}
                          <span>/100</span>
                        </p>
                        <div className="dimension-track">
                          <div
                            className="dimension-fill"
                            style={{ width: dimensionWidth(score) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="modal-section" style={{ marginTop: "18px" }}>
                    <p>
                      <strong>Model:</strong>{" "}
                      {latestLlmEvaluation.model_name || "Groq"}
                    </p>
                    <p>
                      <strong>Feedback:</strong>{" "}
                      {latestLlmEvaluation.feedback || "No feedback provided."}
                    </p>
                  </div>
                </>
              ) : (
                <p>No Groq evaluations available yet.</p>
              )}
            </section>

            {/* Latest RAG Evaluation */}
            <section className="panel" style={{ marginBottom: "24px" }}>
              <h2>Latest RAG Evaluation</h2>
              <p className="panel-description">
                Quality assessment of retrieval-augmented generation
              </p>

              {latestRagEvaluation ? (
                <>
                  <div className="score">
                    {formatScore(latestRagEvaluation.overall_score)}
                    <span>/100</span>
                  </div>

                  <div className="dimension-grid">
                    {[
                      ["Faithfulness", latestRagEvaluation.faithfulness_score],
                      [
                        "Answer Relevancy",
                        latestRagEvaluation.answer_relevancy_score,
                      ],
                      [
                        "Context Precision",
                        latestRagEvaluation.context_precision_score,
                      ],
                    ].map(([label, score]) => (
                      <div className="dimension-card" key={label}>
                        <h4>{label}</h4>
                        <p>
                          {formatScore(score)}
                          <span>/100</span>
                        </p>
                        <div className="dimension-track">
                          <div
                            className="dimension-fill"
                            style={{ width: dimensionWidth(score) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="modal-section" style={{ marginTop: "18px" }}>
                    <p>
                      <strong>Feedback:</strong>{" "}
                      {latestRagEvaluation.feedback}
                    </p>
                    <p>
                      <strong>Evaluated chunks:</strong>{" "}
                      {latestRagEvaluation.evaluated_chunks}
                    </p>
                  </div>
                </>
              ) : (
                <p>No RAG evaluations available yet.</p>
              )}
            </section>
          </>
        )}

        {/* EVALUATION ANALYTICS */}
        {(activePage === "dashboard" ||
          activePage === "analytics" ||
          activePage === "evaluations") && (
          <section className="analytics-section">
            <h2>Evaluation Analytics</h2>
            <p className="section-description">
              Monitor the overall performance of your AI agents
            </p>

            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Total Evaluations</h3>
                <p>{totalEvaluations}</p>
              </div>

              <div className="analytics-card">
                <h3>Average Score</h3>
                <p>
                  {averageScore.toFixed(1)}
                  <span>/100</span>
                </p>
              </div>

              <div className="analytics-card">
                <h3>Highest Score</h3>
                <p>
                  {highestScore}
                  <span>/100</span>
                </p>
              </div>

              <div className="analytics-card">
                <h3>Lowest Score</h3>
                <p>
                  {lowestScore}
                  <span>/100</span>
                </p>
              </div>
            </div>

            <div className="dimension-section">
              <h3>Evaluation Dimension Breakdown</h3>
              <p className="panel-description">
                Understand the strengths and weaknesses of your AI agents
              </p>

              <div className="dimension-grid">
                {[
                  ["Relevance", averageRelevance, "relevance-fill"],
                  ["Completeness", averageCompleteness, "completeness-fill"],
                  ["Quality", averageQuality, "quality-fill"],
                ].map(([label, score, className]) => (
                  <div className="dimension-card" key={label}>
                    <h4>{label}</h4>
                    <p>
                      {score.toFixed(1)}
                      <span>/100</span>
                    </p>
                    <div className="dimension-track">
                      <div
                        className={`dimension-fill ${className}`}
                        style={{ width: dimensionWidth(score) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="trend-card">
              <h3>Evaluation Score Trend</h3>
              <p className="panel-description">
                Scores from your last 10 evaluations
              </p>

              {evaluationTrend.length === 0 ? (
                <p>No evaluation data available yet.</p>
              ) : (
                <div className="trend-chart">
                  {evaluationTrend.map((item, index) => (
                    <div className="trend-bar-container" key={item.id}>
                      <span className="trend-score">
                        {Number(item.overall_score).toFixed(0)}
                      </span>
                      <div
                        className="trend-bar"
                        style={{
                          height: `${Math.max(
                            Number(item.overall_score || 0),
                            3
                          )}%`,
                        }}
                        title={`Score: ${item.overall_score}/100`}
                      />
                      <span className="trend-label">#{index + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* GROQ EVALUATION HISTORY */}
        {(activePage === "dashboard" || activePage === "evaluations") && (
          <section
            className="panel history-panel"
            style={{ marginBottom: "24px" }}
          >
            <h2>Groq LLM Evaluation History</h2>
            <p className="panel-description">
              View AI judge scores and recommendations for previous traces
            </p>

            {sortedLlmEvaluations.length === 0 ? (
              <p>No Groq evaluation history available yet.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Trace ID</th>
                      <th>Overall</th>
                      <th>Relevance</th>
                      <th>Correctness</th>
                      <th>Completeness</th>
                      <th>Clarity</th>
                      <th>Evaluated At</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedLlmEvaluations.map((evaluation) => {
                      const relatedTrace = traces.find(
                        (trace) => trace.id === evaluation.trace_id
                      );

                      return (
                        <tr key={evaluation.id}>
                          <td>{relatedTrace?.agent_name || "ResearchAgent"}</td>
                          <td>{evaluation.trace_id?.substring(0, 8)}...</td>
                          <td>
                            <strong>
                              {formatScore(evaluation.overall_score)}/100
                            </strong>
                          </td>
                          <td>{formatScore(evaluation.relevance_score)}</td>
                          <td>{formatScore(evaluation.correctness_score)}</td>
                          <td>{formatScore(evaluation.completeness_score)}</td>
                          <td>{formatScore(evaluation.clarity_score)}</td>
                          <td>{formatDate(evaluation.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* RAG EVALUATION HISTORY */}
        {(activePage === "dashboard" || activePage === "evaluations") && (
          <section
            className="panel history-panel"
            style={{ marginBottom: "24px" }}
          >
            <h2>RAG Evaluation History</h2>
            <p className="panel-description">
              Compare retrieval and generation quality across agent executions
            </p>

            {sortedRagEvaluations.length === 0 ? (
              <p>No RAG evaluation history available yet.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Trace ID</th>
                      <th>Overall</th>
                      <th>Faithfulness</th>
                      <th>Answer Relevancy</th>
                      <th>Context Precision</th>
                      <th>Evaluated At</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedRagEvaluations.map((evaluation) => {
                      const relatedTrace = traces.find(
                        (trace) => trace.id === evaluation.trace_id
                      );

                      return (
                        <tr key={evaluation.id}>
                          <td>{relatedTrace?.agent_name || "ResearchAgent"}</td>
                          <td>{evaluation.trace_id?.substring(0, 8)}...</td>
                          <td>
                            <strong>
                              {formatScore(evaluation.overall_score)}/100
                            </strong>
                          </td>
                          <td>
                            {formatScore(evaluation.faithfulness_score)}
                          </td>
                          <td>
                            {formatScore(evaluation.answer_relevancy_score)}
                          </td>
                          <td>
                            {formatScore(evaluation.context_precision_score)}
                          </td>
                          <td>{formatDate(evaluation.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* RECENT AGENT TRACES */}
        {(activePage === "dashboard" || activePage === "traces") && (
          <section className="traces-panel panel">
            <div className="traces-header">
              <div>
                <h2>Recent Agent Traces</h2>
                <p className="panel-description">
                  Inspect your agent executions
                </p>
              </div>

              <div className="trace-controls">
                <input
                  type="text"
                  placeholder="Search traces..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />

                <select
                  value={traceFilter}
                  onChange={(event) => setTraceFilter(event.target.value)}
                >
                  <option value="all">All Traces</option>
                  <option value="success">Success</option>
                  <option value="error">Failed</option>
                </select>
              </div>
            </div>

            {filteredTraces.length === 0 ? (
              <p>No traces found.</p>
            ) : (
              <div className="trace-list">
                {filteredTraces.map((trace) => (
                  <div
                    className="trace-row"
                    key={trace.id}
                    onClick={() => openTraceDetails(trace)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="trace-header">
                      <strong>{trace.agent_name}</strong>
                      <span
                        className={
                          trace.status === "success"
                            ? "success-badge"
                            : "error-badge"
                        }
                      >
                        {trace.status}
                      </span>
                    </div>

                    <p>
                      {trace.input?.length > 100
                        ? `${trace.input.substring(0, 100)}...`
                        : trace.input}
                    </p>

                    <div className="trace-meta">
                      <span>
                        Latency:{" "}
                        {Number(trace.execution_time || 0).toFixed(3)}s
                      </span>
                      <span>Tokens: {trace.total_tokens || 0}</span>
                      <span>{formatDate(trace.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* RULE-BASED EVALUATION HISTORY */}
        {(activePage === "dashboard" || activePage === "evaluations") && (
          <section className="panel history-panel">
            <h2>Evaluation History</h2>
            <p className="panel-description">
              View and compare previous agent evaluations
            </p>

            {sortedEvaluations.length === 0 ? (
              <p>No evaluation history available.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Trace ID</th>
                      <th>Overall Score</th>
                      <th>Relevance</th>
                      <th>Completeness</th>
                      <th>Quality</th>
                      <th>Evaluated At</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedEvaluations.map((evaluation) => {
                      const relatedTrace = traces.find(
                        (trace) => trace.id === evaluation.trace_id
                      );

                      return (
                        <tr key={evaluation.id}>
                          <td>{relatedTrace?.agent_name || "ResearchAgent"}</td>
                          <td>{evaluation.trace_id?.substring(0, 8)}...</td>
                          <td>
                            <strong>
                              {formatScore(evaluation.overall_score)}/100
                            </strong>
                          </td>
                          <td>{formatScore(evaluation.relevance_score)}</td>
                          <td>{formatScore(evaluation.completeness_score)}</td>
                          <td>{formatScore(evaluation.quality_score)}</td>
                          <td>{formatDate(evaluation.created_at)}</td>
                          <td>
                            <button
                              className="view-button"
                              disabled={!relatedTrace}
                              onClick={() => {
                                if (relatedTrace) openTraceDetails(relatedTrace);
                              }}
                            >
                              View Trace
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {/* TRACE DETAILS MODAL */}
      {selectedTrace && (
        <div className="modal-overlay" onClick={closeTraceDetails}>
          <div
            className="trace-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Trace Details</h2>
              <button onClick={closeTraceDetails} className="close-button">
                ×
              </button>
            </div>

            <div className="modal-section">
              <h3>Execution Information</h3>
              <p>
                <strong>Agent:</strong> {selectedTrace.agent_name}
              </p>
              <p>
                <strong>Trace ID:</strong> {selectedTrace.id}
              </p>
              <p>
                <strong>Status:</strong> {selectedTrace.status}
              </p>
              <p>
                <strong>Execution Time:</strong>{" "}
                {Number(selectedTrace.execution_time || 0).toFixed(3)}s
              </p>
              <p>
                <strong>Created At:</strong>{" "}
                {formatDate(selectedTrace.created_at)}
              </p>
            </div>

            <div className="modal-section">
              <h3>Input</h3>
              <p className="trace-content">{selectedTrace.input}</p>
            </div>

            <div className="modal-section">
              <h3>Output</h3>
              <p className="trace-content">{selectedTrace.output}</p>
            </div>

            <div className="modal-section">
              <h3>Token Usage</h3>
              <p>Input Tokens: {selectedTrace.input_tokens || 0}</p>
              <p>Output Tokens: {selectedTrace.output_tokens || 0}</p>
              <p>Total Tokens: {selectedTrace.total_tokens || 0}</p>
              <p>
                Estimated Cost: $
                {Number(selectedTrace.estimated_cost || 0).toFixed(6)}
              </p>
            </div>

            {/* Rule-based evaluation */}
            <div className="modal-section">
              <h3>Evaluation Results</h3>

              {selectedTraceEvaluation ? (
                <>
                  <div className="score">
                    {formatScore(selectedTraceEvaluation.overall_score)}
                    <span>/100</span>
                  </div>
                  <p>
                    Relevance:{" "}
                    {formatScore(selectedTraceEvaluation.relevance_score)}
                  </p>
                  <p>
                    Completeness:{" "}
                    {formatScore(selectedTraceEvaluation.completeness_score)}
                  </p>
                  <p>
                    Quality:{" "}
                    {formatScore(selectedTraceEvaluation.quality_score)}
                  </p>
                  {selectedTraceEvaluation.feedback && (
                    <p>
                      <strong>Feedback:</strong>{" "}
                      {selectedTraceEvaluation.feedback}
                    </p>
                  )}
                </>
              ) : (
                <p>This trace has not been evaluated yet.</p>
              )}

              <button
                className="evaluate-button"
                onClick={handleEvaluateTrace}
                disabled={evaluating}
              >
                {evaluating
                  ? "Evaluating..."
                  : selectedTraceEvaluation
                    ? "Evaluate Again"
                    : "Evaluate Trace"}
              </button>

              {evaluationError && (
                <p className="error-message">{evaluationError}</p>
              )}
              {evaluationSuccess && (
                <p className="success-message">{evaluationSuccess}</p>
              )}
            </div>

            {/* Groq LLM evaluation */}
            <div className="modal-section">
              <h3>Groq LLM-as-a-Judge Results</h3>

              {selectedTraceLlmEvaluation ? (
                <>
                  <div className="score">
                    {formatScore(selectedTraceLlmEvaluation.overall_score)}
                    <span>/100</span>
                  </div>

                  <div className="evaluation-breakdown">
                    <p>
                      Relevance
                      <strong>
                        {formatScore(
                          selectedTraceLlmEvaluation.relevance_score
                        )}
                      </strong>
                    </p>
                    <p>
                      Correctness
                      <strong>
                        {formatScore(
                          selectedTraceLlmEvaluation.correctness_score
                        )}
                      </strong>
                    </p>
                    <p>
                      Completeness
                      <strong>
                        {formatScore(
                          selectedTraceLlmEvaluation.completeness_score
                        )}
                      </strong>
                    </p>
                    <p>
                      Clarity
                      <strong>
                        {formatScore(
                          selectedTraceLlmEvaluation.clarity_score
                        )}
                      </strong>
                    </p>
                  </div>

                  <p>
                    <strong>Model:</strong>{" "}
                    {selectedTraceLlmEvaluation.model_name || "Groq"}
                  </p>
                  <p>
                    <strong>Feedback:</strong>{" "}
                    {selectedTraceLlmEvaluation.feedback}
                  </p>

                  <div style={{ marginTop: "12px" }}>
                    <strong>Strengths</strong>
                    {Array.isArray(selectedTraceLlmEvaluation.strengths) &&
                    selectedTraceLlmEvaluation.strengths.length > 0 ? (
                      <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
                        {selectedTraceLlmEvaluation.strengths.map(
                          (item, index) => (
                            <li key={index}>{item}</li>
                          )
                        )}
                      </ul>
                    ) : (
                      <p>No strengths provided.</p>
                    )}
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <strong>Improvements</strong>
                    {Array.isArray(selectedTraceLlmEvaluation.improvements) &&
                    selectedTraceLlmEvaluation.improvements.length > 0 ? (
                      <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
                        {selectedTraceLlmEvaluation.improvements.map(
                          (item, index) => (
                            <li key={index}>{item}</li>
                          )
                        )}
                      </ul>
                    ) : (
                      <p>No improvement suggestions provided.</p>
                    )}
                  </div>
                </>
              ) : (
                <p>This trace has not been evaluated by Groq yet.</p>
              )}

              <button
                className="evaluate-button"
                onClick={handleLlmEvaluateTrace}
                disabled={llmEvaluating}
                style={{ marginTop: "14px" }}
              >
                {llmEvaluating
                  ? "Evaluating with Groq..."
                  : selectedTraceLlmEvaluation
                    ? "Evaluate Again with Groq"
                    : "Evaluate with Groq"}
              </button>

              {llmEvaluationError && (
                <p className="error-message">{llmEvaluationError}</p>
              )}
              {llmEvaluationSuccess && (
                <p className="success-message">{llmEvaluationSuccess}</p>
              )}
            </div>

            {/* RAG evaluation details */}
            <div className="modal-section">
              <h3>RAG Evaluation Results</h3>

              {selectedTraceRagEvaluation ? (
                <>
                  <div className="score">
                    {formatScore(selectedTraceRagEvaluation.overall_score)}
                    <span>/100</span>
                  </div>

                  <div className="evaluation-breakdown">
                    <p>
                      Faithfulness
                      <strong>
                        {formatScore(
                          selectedTraceRagEvaluation.faithfulness_score
                        )}
                      </strong>
                    </p>
                    <p>
                      Answer Relevancy
                      <strong>
                        {formatScore(
                          selectedTraceRagEvaluation.answer_relevancy_score
                        )}
                      </strong>
                    </p>
                    <p>
                      Context Precision
                      <strong>
                        {formatScore(
                          selectedTraceRagEvaluation.context_precision_score
                        )}
                      </strong>
                    </p>
                    <p>
                      Context Recall
                      <strong>
                        {formatScore(
                          selectedTraceRagEvaluation.context_recall_score
                        )}
                      </strong>
                    </p>
                  </div>

                  <p>
                    <strong>Feedback:</strong>{" "}
                    {selectedTraceRagEvaluation.feedback}
                  </p>

                  <h4 style={{ marginTop: "14px" }}>Strengths</h4>
                  <ul>
                    {(selectedTraceRagEvaluation.strengths || []).map(
                      (item, index) => (
                        <li key={index}>{item}</li>
                      )
                    )}
                  </ul>

                  <h4 style={{ marginTop: "14px" }}>Improvements</h4>
                  <ul>
                    {(selectedTraceRagEvaluation.improvements || []).map(
                      (item, index) => (
                        <li key={index}>{item}</li>
                      )
                    )}
                  </ul>
                </>
              ) : (
                <p>This trace has not received a RAG evaluation yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
