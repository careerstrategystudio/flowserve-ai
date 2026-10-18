// POST /api/voice/webhook?key=<WEBHOOK_SECRET>
// Retell avisa aquí cuando empieza, termina y se analiza cada llamada. Guardamos el historial con resumen.
import { db, q } from '../../lib/db.js';
import { readJson, send, safeEqual, env, clip } from '../../lib/util.js';
import { processCallEvent } from '../../lib/calls.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const key = new URL(req.url, 'http://x').searchParams.get('key') || '';
  if (!safeEqual(key, env('WEBHOOK_SECRET'))) return send(res, 401, { error: 'unauthorised' });
  const body = await readJson(req);
  try {
    await processCallEvent(body, { db, q, clip });
  } catch (e) {
    console.error('[webhook]', e);
    return send(res, 500, { error: 'failed' }); // Retell reintenta
  }
  res.statusCode = 204;
  return res.end();
}
