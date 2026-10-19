// POST /api/voice/web-call — crea una llamada de prueba desde el navegador con la recepcionista DEMO.
// Límites para que nadie vacíe el crédito: X llamadas al día en total, 3 por persona (IP), 3 minutos cada una.
import crypto from 'node:crypto';
import { db, q } from '../../lib/db.js';
import { retell } from '../../lib/retell.js';
import { send, env } from '../../lib/util.js';

const DAILY_LIMIT = () => Number(process.env.DEMO_DAILY_LIMIT || 20);
const PER_IP_LIMIT = 3;
const MAX_MS = 3 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  // Solo desde nuestra propia web
  const origin = String(req.headers.origin || '');
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (origin && base && origin !== base && !origin.endsWith('.vercel.app')) return send(res, 403, { error: 'Not allowed' });

  try {
    const biz = await db.one('businesses', `slug=eq.${q(process.env.DEMO_SLUG || 'halden-demo')}&is_demo=is.true&active=is.true&select=id,retell_agent_id`);
    if (!biz?.retell_agent_id) return send(res, 503, { error: 'The demo line is not ready yet.' });

    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const ipHash = crypto.createHash('sha256').update(`${ip}|${env('TOOL_SECRET')}`).digest('hex').slice(0, 32);
    const since = new Date(Date.now() - 864e5).toISOString();
    const [all, mine] = await Promise.all([
      db.select('demo_web_calls', `created_at=gte.${q(since)}&select=id`),
      db.select('demo_web_calls', `created_at=gte.${q(since)}&ip_hash=eq.${ipHash}&select=id`),
    ]);
    if (all.length >= DAILY_LIMIT()) return send(res, 429, { error: 'The demo line is busy today. Book a quick call with us and we will show it to you live.' });
    if (mine.length >= PER_IP_LIMIT) return send(res, 429, { error: 'You have used your demo calls for today. Book a quick call with us to see more.' });

    const body = {
      agent_id: biz.retell_agent_id,
      metadata: { business_id: biz.id, source: 'website_demo' },
      retell_llm_dynamic_variables: { call_mode: 'inbound', caller_name: '', callback_context: '', owner_instruction: '' },
    };
    let call;
    try {
      call = await retell.createWebCall({ ...body, agent_override: { agent: { max_call_duration_ms: MAX_MS } } });
    } catch (e) {
      if (!/400|422/.test(e.message)) throw e;
      call = await retell.createWebCall(body); // por si la API no acepta el override
    }
    await db.insert('demo_web_calls', { ip_hash: ipHash, retell_call_id: call.call_id }).catch((e) => console.error('demo_web_calls', e.message));
    return send(res, 200, {
      accessToken: call.access_token, callId: call.call_id,
      ...(call.transport ? { transport: call.transport } : {}), ...(call.url ? { url: call.url } : {}),
      maxSeconds: MAX_MS / 1000,
    });
  } catch (e) {
    console.error('[web-call]', e);
    return send(res, 500, { error: 'Could not start the demo call. Please try again in a minute.' });
  }
}
