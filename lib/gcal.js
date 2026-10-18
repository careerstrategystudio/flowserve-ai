// Google Calendar con una cuenta de servicio (sin OAuth del dueño).
// El dueño comparte su calendario con el email de la cuenta de servicio ("Hacer cambios en eventos").
// Así no hace falta que Google verifique la app ni que el dueño haga login.
import crypto from 'node:crypto';
import { env } from './util.js';

const API = 'https://www.googleapis.com/calendar/v3';
let cached = null; // { token, exp }

function serviceAccount() {
  let raw = env('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw.trim().startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
  const sa = JSON.parse(raw);
  sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}
const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function token() {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = b64url(crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(sa.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${sig}` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google token ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function g(method, path, { query, body } = {}) {
  const t = await token();
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  const r = await fetch(`${API}${path}${qs}`, {
    method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google Calendar ${method} ${path} ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const cal = (id) => `/calendars/${encodeURIComponent(id)}`;
const toBusy = (e) => ({
  id: e.id,
  start: new Date(e.start.dateTime || `${e.start.date}T00:00:00Z`),
  end: new Date(e.end.dateTime || `${e.end.date}T00:00:00Z`),
  allDay: !e.start.dateTime,
  summary: e.summary,
  props: e.extendedProperties?.private || {},
});

export const gcal = {
  /** Eventos (ya expandidos si son recurrentes) entre dos instantes. Los "libres" (transparent) no ocupan. */
  async busy(calendarId, timeMin, timeMax) {
    const items = [];
    let pageToken;
    do {
      const j = await g('GET', `${cal(calendarId)}/events`, { query: {
        timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', ...(pageToken ? { pageToken } : {}),
      } });
      items.push(...(j.items || []));
      pageToken = j.nextPageToken;
    } while (pageToken);
    return items.filter((e) => e.status !== 'cancelled' && e.transparency !== 'transparent').map(toBusy);
  },

  /** Citas futuras creadas por FlowServe para un teléfono. */
  async byPhone(calendarId, phone, from = new Date()) {
    const j = await g('GET', `${cal(calendarId)}/events`, { query: {
      privateExtendedProperty: `fs_phone=${phone}`, timeMin: from.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '10',
    } });
    return (j.items || []).filter((e) => e.status !== 'cancelled').map(toBusy);
  },

  async get(calendarId, eventId) { return toBusy(await g('GET', `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`)); },

  async create(calendarId, { summary, description, start, end, tz, props }) {
    const e = await g('POST', `${cal(calendarId)}/events`, { body: {
      summary, description,
      start: { dateTime: start.toISOString(), timeZone: tz }, end: { dateTime: end.toISOString(), timeZone: tz },
      extendedProperties: { private: props },
      reminders: { useDefault: true },
    } });
    return toBusy(e);
  },

  async move(calendarId, eventId, { start, end, tz }) {
    return toBusy(await g('PATCH', `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, { body: {
      start: { dateTime: start.toISOString(), timeZone: tz }, end: { dateTime: end.toISOString(), timeZone: tz },
    } }));
  },

  async cancel(calendarId, eventId) { await g('DELETE', `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`); },
};
