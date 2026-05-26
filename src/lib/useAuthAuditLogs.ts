import { useState, useEffect, useCallback } from 'react';
import keycloak from './keycloak';

const KC_URL   = import.meta.env.VITE_KEYCLOAK_URL   ?? 'http://localhost:8080';
const KC_REALM = import.meta.env.VITE_KEYCLOAK_REALM ?? 'aeroflow';

/* ── Keycloak raw event shapes ───────────────────────────────────────── */
interface KcUserEvent {
  time:      number;
  type:      string;
  realmId:   string;
  clientId:  string;
  userId?:   string;
  sessionId?: string;
  ipAddress: string;
  error?:    string;
  details?:  Record<string, string>;
}

interface KcAdminEvent {
  time:            number;
  realmId:         string;
  operationType:   string;   // CREATE / UPDATE / DELETE / ACTION
  resourceType:    string;   // USER / GROUP / REALM_ROLE / CLIENT / ...
  resourcePath?:   string;
  representation?: string;
  error?:          string;
  authDetails?: {
    realmId:   string;
    clientId:  string;
    userId:    string;
    ipAddress: string;
    username?: string;
  };
}

/* ── Normalised shape used by the UI ─────────────────────────────────── */
export interface AuditLogEntry {
  id:        string;   // synthetic — time+index
  time:      string;   // ISO
  event:     string;
  actor:     string;
  ip:        string;
  sessionId?: string;
  realm:     string;
  outcome:   'SUCCESS' | 'FAILURE' | 'BLOCKED';
  detail?:   string;
  raw:       KcUserEvent | KcAdminEvent;
}

/* ── Map Keycloak event types → outcome ─────────────────────────────── */
const outcomeOf = (type: string, error?: string): AuditLogEntry['outcome'] => {
  if (error) return 'FAILURE';
  if (type.endsWith('_ERROR') || type === 'LOGIN_ERROR') return 'FAILURE';
  return 'SUCCESS';
};

const labelOf = (ev: KcUserEvent): string => {
  const map: Record<string, string> = {
    LOGIN:            'LOGIN_SUCCESS',
    LOGIN_ERROR:      'LOGIN_FAILURE',
    LOGOUT:           'LOGOUT',
    TOKEN_REFRESH:    'TOKEN_REFRESHED',
    TOKEN_REFRESH_ERROR: 'TOKEN_REFRESH_ERROR',
    REGISTER:         'USER_REGISTERED',
    RESET_PASSWORD:   'PASSWORD_RESET',
    UPDATE_PASSWORD:  'PASSWORD_CHANGED',
    UPDATE_PROFILE:   'PROFILE_UPDATED',
    SEND_VERIFY_EMAIL: 'VERIFY_EMAIL_SENT',
    VERIFY_EMAIL:     'EMAIL_VERIFIED',
    UPDATE_TOTP:      'MFA_UPDATED',
    REMOVE_TOTP:      'MFA_REMOVED',
    GRANT_CONSENT:    'CONSENT_GRANTED',
    REVOKE_GRANT:     'CONSENT_REVOKED',
  };
  return map[ev.type] ?? ev.type;
};

const adminLabel = (ev: KcAdminEvent): string => {
  const op  = ev.operationType;
  const res = ev.resourceType?.replace(/_/g, ' ');
  if (ev.error) return `${op}_${ev.resourceType}_ERROR`;
  return `${op} ${res}`;
};

const actorFromUser = (ev: KcUserEvent): string =>
  ev.details?.username ?? ev.details?.email ?? ev.userId ?? 'unknown';

const actorFromAdmin = (ev: KcAdminEvent): string =>
  ev.authDetails?.username ?? ev.authDetails?.userId ?? 'System';

/* ── Hook ─────────────────────────────────────────────────────────────── */
interface Result {
  logs:    AuditLogEntry[];
  loading: boolean;
  error:   string | null;
  refetch: () => void;
}

export const useAuthAuditLogs = (isAdmin: boolean, maxRows = 200): Result => {
  const [logs, setLogs]       = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!isAdmin || !keycloak.token) return;
    setLoading(true);
    setError(null);

    try {
      // Refresh token before request so it doesn't expire mid-way
      await keycloak.updateToken(30).catch(() => {});

      const headers = { Authorization: `Bearer ${keycloak.token}` };
      const base    = `${KC_URL}/admin/realms/${KC_REALM}`;

      const [userRes, adminRes] = await Promise.all([
        fetch(`${base}/events?max=${maxRows}`,       { headers }),
        fetch(`${base}/admin-events?max=${maxRows}`, { headers }),
      ]);

      if (userRes.status === 403 || adminRes.status === 403)
        throw new Error('Token lacks view-events permission — assign realm-management → view-events in Keycloak');
      if (!userRes.ok)  throw new Error(`Keycloak events API ${userRes.status}`);
      if (!adminRes.ok) throw new Error(`Keycloak admin-events API ${adminRes.status}`);

      const userEvents:  KcUserEvent[]  = await userRes.json();
      const adminEvents: KcAdminEvent[] = await adminRes.json();

      const userMapped: AuditLogEntry[] = userEvents.map((ev, i) => ({
        id:        `U-${ev.time}-${i}`,
        time:      new Date(ev.time).toISOString(),
        event:     labelOf(ev),
        actor:     actorFromUser(ev),
        ip:        ev.ipAddress ?? '—',
        sessionId: ev.sessionId,
        realm:     KC_REALM,
        outcome:   outcomeOf(ev.type, ev.error),
        detail:    ev.error
          ? `Error: ${ev.error}${ev.details?.username ? ` — user: ${ev.details.username}` : ''}`
          : ev.details?.redirect_uri
            ? `client: ${ev.clientId}`
            : undefined,
        raw: ev,
      }));

      const adminMapped: AuditLogEntry[] = adminEvents.map((ev, i) => ({
        id:        `A-${ev.time}-${i}`,
        time:      new Date(ev.time).toISOString(),
        event:     adminLabel(ev),
        actor:     actorFromAdmin(ev),
        ip:        ev.authDetails?.ipAddress ?? '—',
        realm:     KC_REALM,
        outcome:   ev.error ? 'FAILURE' : 'SUCCESS',
        detail:    ev.error ?? ev.resourcePath,
        raw:       ev,
      }));

      // Merge + sort newest-first
      const merged = [...userMapped, ...adminMapped].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
      );

      setLogs(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, keycloak.token, maxRows]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { logs, loading, error, refetch: fetch_ };
};
