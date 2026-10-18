// Pequeñas utilidades compartidas por las funciones de /api.

/** Normaliza un teléfono a E.164. Por defecto asume Irlanda (+353). */
export function normalizePhone(raw, defaultCc = '353') {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d+]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) return s.length >= 8 ? s : null;
  if (s.startsWith(defaultCc)) return '+' + s;
  if (s.startsWith('0')) return `+${defaultCc}${s.slice(1)}`;
  return s.length >= 7 ? `+${defaultCc}${s}` : null;
}

/** Lee el cuerpo JSON de la petición (Vercel ya lo parsea; si no, se lee el stream). */
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Comparación en tiempo constante para secretos. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function env(name, { required = true } = {}) {
  const v = process.env[name];
  if (required && !v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Recorta texto para que no se dispare el tamaño de lo que se guarda o se envía. */
export const clip = (s, n = 2000) => (s == null ? null : String(s).slice(0, n));
