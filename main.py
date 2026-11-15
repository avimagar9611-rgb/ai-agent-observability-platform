
from fastapi import FastAPI

# Create FastAPI application
app = FastAPI(
    title="AI Agent Observability Platform",
    description="Monitor and evaluate AI agents and RAG applications",
    version="1.0.0"
)


# 1. Home endpoint
@app.get("/")
def home():
    return {
        "message": "Welcome to AI Agent Observability Platform!",
        "status": "Running successfully"
    }


# 2. Health check endpoint
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AI Agent Observability Platform"
    }


# 3. Project information endpoint
@app.get("/api/v1/info")
def project_info():
    return {
        "project": "AI Agent Observability Platform",
        "version": "1.0.0",
        "features": [
            "AI Agent Monitoring",
            "LLM Evaluation",
            "RAG Observability"
        ],
        "status": "Under Development"
    }


# 4. Project status endpoint
@app.get("/api/v1/status")
def project_status():
    return {
        "project_status": "Active",
        "development_day": 1,
        "message": "Backend development started successfully"
    }
