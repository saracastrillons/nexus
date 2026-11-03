// Empty in production: serve /api through the same origin or configure an HTTPS API.
export const API_URL = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8000" : "")).replace(/\/+$/, "");

export async function fetchJSON(path, { signal, timeout = 15000 } = {}) {
  const signals = [AbortSignal.timeout(timeout), signal].filter(Boolean);
  const response = await fetch(`${API_URL}${path}`, { signal: AbortSignal.any(signals) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message || `Request failed (${response.status})`);
  }
  return response.json();
}
