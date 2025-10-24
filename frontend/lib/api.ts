const API_BASE_URL = "http://localhost:8000/api/v1";

export async function researchStatements(statements: string[]) {
  const response = await fetch(`${API_BASE_URL}/workflows/research/`, {
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

export async function extractNotableContext(transcript: string) {
  const response = await fetch(
    `${API_BASE_URL}/workflows/extract_notable_context/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transcript }),
    }
  );

  if (!response.ok) {
    throw new Error(`Extract notable context failed: ${response.statusText}`);
  }

  return response.json();
}

export interface AudioChunkInfo {
  total_chunks: number;
  chunk_duration_seconds: number;
  total_duration_seconds: number;
}

export async function getAudioChunkInfo(
  filename: string
): Promise<AudioChunkInfo> {
  const response = await fetch(
    `${API_BASE_URL}/transcription/info/${filename}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get audio info: ${response.statusText}`);
  }

  return response.json();
}
