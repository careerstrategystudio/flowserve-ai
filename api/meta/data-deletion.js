// /api/meta/data-deletion — "Data deletion request URL" y "Deauthorize callback URL" que pide Meta.
// Meta manda un signed_request (firmado con META_APP_SECRET) con el id del usuario de Instagram.
// Borramos sus eventos guardados y devolvemos el código de confirmación que Meta enseña al usuario.
import crypto from 'node:crypto';
import { db, q } from '../../lib/db.js';
import { send, readJson, safeEqual } from '../../lib/util.js';

const b64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function parseSignedRequest(sr, secret) {
  const [sig, payload] = String(sr || '').split('.');
  if (!sig || !payload || !secret) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (!safeEqual(sig.replace(/=+$/, ''), expected)) return null;
  try { return JSON.parse(b64url(payload).toString('utf8')); } catch { return null; }
}

export default async function handler(req, res) {
  const base = (process.env.PUBLIC_BASE_URL || 'https://flowserve-ai.vercel.app').replace(/\/$/, '');
  if (req.method === 'GET') { // página de estado para el usuario
    const code = new URL(req.url, 'http://x').searchParams.get('code') || '';
    res.statusCode = 200; res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Data deletion · FlowServe</title><body style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:0 16px"><h1>Data deletion request</h1><p>Your Instagram data held by FlowServe has been deleted.</p>${code ? `<p>Confirmation code: <b>${code.replace(/[^\w-]/g, '')}</b></p>` : ''}<p>Questions? See our <a href="${base}/privacy/">privacy policy</a>.</p></body>`);
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  let sr = (await readJson(req)).signed_request;
  if (!sr && typeof req.body === 'string') sr = new URLSearchParams(req.body).get('signed_request');
  const data = parseSignedRequest(sr, process.env.META_APP_SECRET);
  if (!data?.user_id) return send(res, 400, { error: 'invalid_signed_request' });
  const code = crypto.randomUUID();
  try {
    const del = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/meta_events?sender_id=eq.${q(String(data.user_id))}`, {
      method: 'DELETE', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!del.ok) throw new Error(`delete ${del.status}`);
    await db.insert('meta_deletions', { user_id: String(data.user_id), confirmation_code: code });
  } catch (e) { console.error('[meta deletion]', e.message); return send(res, 500, { error: 'deletion_failed' }); }
  return send(res, 200, { url: `${base}/api/meta/data-deletion?code=${code}`, confirmation_code: code });
}
