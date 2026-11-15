const API_BASE_URL = "http://127.0.0.1:8000";

// Fetch dashboard metrics
export async function getMetrics() {
  const response = await fetch(`${API_BASE_URL}/metrics`);

  if (!response.ok) {
    throw new Error("Failed to fetch metrics");
  }

  return response.json();
}

// Fetch recent traces
export async function getTraces() {
  const response = await fetch(`${API_BASE_URL}/traces`);

  if (!response.ok) {
    throw new Error("Failed to fetch traces");
  }

  return response.json();
}

// Fetch evaluations
export async function getEvaluations() {
  const response = await fetch(`${API_BASE_URL}/evaluations`);

  if (!response.ok) {
    throw new Error("Failed to fetch evaluations");
  }

  return response.json();
}