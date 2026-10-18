// Cliente mínimo para la API REST de Supabase (PostgREST), con la clave de servicio.
// Solo se usa en el servidor. Nunca se manda al navegador.
import { env } from './util.js';

function base() {
  return { url: env('SUPABASE_URL').replace(/\/$/, ''), key: env('SUPABASE_SERVICE_ROLE_KEY') };
}

async function call(method, path, { query = '', body, prefer } = {}) {
  const { url, key } = base();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${url}/rest/v1/${path}${query ? `?${query}` : ''}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${path} ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export const db = {
  select: (table, query) => call('GET', table, { query }),
  one: async (table, query) => (await call('GET', table, { query: `${query}&limit=1` }))[0] || null,
  insert: (table, row) => call('POST', table, { body: row, prefer: 'return=representation' }).then((r) => r[0]),
  update: (table, query, patch) => call('PATCH', table, { query, body: patch, prefer: 'return=representation' }),
  upsert: (table, row, onConflict) => call('POST', table, { query: `on_conflict=${onConflict}`, body: row, prefer: 'resolution=merge-duplicates,return=representation' }).then((r) => r[0]),
};

/** Valida el token de sesión de un dueño (viene del panel) y devuelve su usuario. */
export async function userFromToken(token) {
  if (!token) return null;
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json();
}

export const q = encodeURIComponent;
