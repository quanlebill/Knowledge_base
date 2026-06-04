/**
 * Thin fetch wrapper for the AeroFlow KB API server.
 * Base URL from VITE_API_URL env var, defaults to http://localhost:8000 (FastAPI).
 * Falls back to VITE_MOCK_SERVER_URL for legacy mock server compatibility.
 *
 * Start FastAPI: uvicorn main:app --reload   (from server/)
 * Start mock:    node testing/server.js       (port 4000)
 *
 * Every request includes the current role via the X-Role header.
 *
 * Responses from the FastAPI server are wrapped in { code, data, error }.
 * unwrapEnvelope() strips the envelope and returns data, or throws on error.
 * Raw responses (mock server) pass through unchanged.
 */

const BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.VITE_MOCK_SERVER_URL as string | undefined) ??
  'http://localhost:8000';

let _role = 'AI_ENGINEER';

/** Call this whenever the app role changes (e.g. from AppStateContext). */
export const setApiRole = (role: string) => { _role = role; };

const roleHeader = () => ({ 'X-Role': _role });

/** Unwraps FastAPI ResponseModel envelope { code, data, error }. Raw responses pass through. */
function unwrapEnvelope<T>(json: unknown): T {
  if (
    typeof json === 'object' &&
    json !== null &&
    'code' in json &&
    'data' in json
  ) {
    const envelope = json as { code: number; data: unknown; error: { message: string; error_type: string } | null };
    if (envelope.error) throw new Error(envelope.error.message);
    if (envelope.code >= 400) throw new Error(`Server error ${envelope.code}`);
    return envelope.data as T;
  }
  return json as T;
}

export async function mockGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: roleHeader(),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return unwrapEnvelope<T>(await res.json());
}

export async function mockMutate<T = unknown>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { ...roleHeader() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(3000),
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.error?.message) msg = j.error.message;
      else if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    if (res.status === 403) {
      window.dispatchEvent(new CustomEvent('app:forbidden', { detail: msg }));
    }
    throw new Error(msg);
  }
  return unwrapEnvelope<T>(await res.json());
}
