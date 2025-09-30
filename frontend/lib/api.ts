const API_BASE_URL = "http://localhost:8000/api/v1";

export async function researchStatements(statements: string[]) {
  const response = await fetch(`${API_BASE_URL}/research/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ statements_to_research: statements }),
  });

  if (!response.ok) {
    throw new Error(`Research failed: ${response.statusText}`);
  }

  return response.json();
}
