// POST /api/voice/tool?biz=<slug>&fn=<tool>
// Retell llama aquí durante la llamada cada vez que la recepcionista usa una herramienta.
import { tools } from '../../lib/tools.js';
import { gcal } from '../../lib/gcal.js';
import { db, q } from '../../lib/db.js';
import { notify } from '../../lib/mail.js';
import { readJson, send, safeEqual, env } from '../../lib/util.js';

const cache = new Map(); // slug -> { biz, at }
async function loadBiz(slug) {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < 60000) return hit.biz;
  const biz = await db.one('businesses', `slug=eq.${q(slug)}&active=is.true&select=*`);
  if (biz) cache.set(slug, { biz, at: Date.now() });
  return biz;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!safeEqual(String(req.headers['x-flowserve-secret'] || ''), env('TOOL_SECRET'))) return send(res, 401, { error: 'unauthorised' });

  const url = new URL(req.url, 'http://x');
  const slug = url.searchParams.get('biz');
  const body = await readJson(req);
  const fn = url.searchParams.get('fn') || body.name;
  if (!tools[fn]) return send(res, 400, { error: `unknown tool ${fn}` });

  try {
    const biz = await loadBiz(slug);
    if (!biz) return send(res, 404, { error: 'unknown business' });
    const out = await tools[fn](biz, body.args || {}, body.call || {}, { gcal, db, notify, now: new Date() });
    return send(res, 200, out);
  } catch (e) {
    console.error(`[tool ${fn}]`, e);
    // 200 a propósito: así la recepcionista se recupera en la llamada en vez de quedarse muda
    return send(res, 200, { ok: false, error: true, say: 'There was a problem reaching the diary. Apologise briefly and offer to take a message so the team can call back.' });
  }
}
