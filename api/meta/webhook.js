// /api/meta/webhook — webhooks de Instagram (API with Instagram Login).
// GET: verificación de Meta (hub.challenge). POST: guarda cada evento firmado en meta_events.
// Fase 1: solo recibe y guarda (para probar la conexión y grabar el vídeo de App Review).
// La respuesta automática con IA se conecta en la fase 2, cuando tengamos tokens de cada negocio.
import crypto from 'node:crypto';
import { db } from '../../lib/db.js';
import { send, safeEqual } from '../../lib/util.js';

// Necesitamos el cuerpo EXACTO para comprobar la firma: leemos el stream antes de tocar req.body
// (en Vercel req.body se parsea de forma perezosa y re-serializarlo cambiaría los bytes).
async function rawBody(req) {
  if (typeof req[Symbol.asyncIterator] === 'function') {
    const chunks = []; for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    if (chunks.length) return Buffer.concat(chunks).toString('utf8');
  }
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  return '';
}

export function validSignature(raw, header, secret) {
  if (!secret || !header) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  return safeEqual(String(header), expected);
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET') {
    const p = url.searchParams;
    if (p.get('hub.mode') === 'subscribe' && process.env.META_VERIFY_TOKEN && safeEqual(p.get('hub.verify_token') || '', process.env.META_VERIFY_TOKEN)) {
      res.statusCode = 200; res.setHeader('Content-Type', 'text/plain'); return res.end(p.get('hub.challenge') || '');
    }
    return send(res, 403, { error: 'verification_failed' });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });

  const raw = await rawBody(req);
  if (!validSignature(raw, req.headers['x-hub-signature-256'], process.env.META_APP_SECRET)) return send(res, 401, { error: 'bad_signature' });
  let body; try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad_json' }); }

  const rows = [];
  for (const entry of body.entry || []) {
    for (const m of entry.messaging || []) {
      rows.push({ object: body.object, account_id: String(entry.id || ''), sender_id: String(m.sender?.id || ''), kind: m.message ? (m.message.is_echo ? 'echo' : 'message') : Object.keys(m).find((k) => !['sender', 'recipient', 'timestamp'].includes(k)) || 'other', text: m.message?.text?.slice(0, 2000) || null, payload: m });
    }
    for (const c of entry.changes || []) rows.push({ object: body.object, account_id: String(entry.id || ''), sender_id: String(c.value?.from?.id || ''), kind: c.field || 'change', text: c.value?.text?.slice(0, 2000) || null, payload: c });
  }
  try { for (const r of rows) await db.insert('meta_events', r); }
  catch (e) { console.error('[meta webhook]', e.message); } // Meta reintenta si no respondemos 200; preferimos no duplicar
  return send(res, 200, { ok: true, received: rows.length });
}
