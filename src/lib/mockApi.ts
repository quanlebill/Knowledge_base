/**
 * Thin fetch wrapper for the AeroFlow KB Mock Server.
 * Base URL from VITE_MOCK_SERVER_URL env var, defaults to http://localhost:4000.
 *
 * Start the server: node testing/server.js
 *
 * Every request includes the current role via the X-Role header so the server
 * can enforce role-based permissions without UI-level gating.
 */

const BASE = (import.meta.env.VITE_MOCK_SERVER_URL as string | undefined) ?? 'http://localhost:4000';

let _role = 'AI_ENGINEER';

/** Call this whenever the app role changes (e.g. from AppStateContext). */
export const setApiRole = (role: string) => { _role = role; };

const roleHeader = () => ({ 'X-Role': _role });

export async function mockGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: roleHeader(),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
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
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    if (res.status === 403) {
      window.dispatchEvent(new CustomEvent('app:forbidden', { detail: msg }));
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
