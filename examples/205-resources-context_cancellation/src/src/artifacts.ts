const ARTIFACT_BASE = process.env.ARTIFACT_URL ?? "http://artifacts.internal";

export async function uploadLog(jobId: string, step: string, body: string, signal: AbortSignal): Promise<void> {
  const res = await fetch(`${ARTIFACT_BASE}/jobs/${jobId}/logs/${encodeURIComponent(step)}`, {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body,
    signal,
  });
  if (!res.ok) {
    throw new Error(`log upload failed for ${step}: ${res.status}`);
  }
}
