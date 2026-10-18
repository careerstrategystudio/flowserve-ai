// GET /api/admin/sync-agent?biz=<slug>&key=<ADMIN_SECRET>
// Crea o actualiza en Retell la recepcionista de un negocio con los datos de la base de datos.
// Se abre este enlace cada vez que cambian horarios, servicios o textos.
import { db, q } from '../../lib/db.js';
import { retell } from '../../lib/retell.js';
import { buildLlmBody, buildAgentBody } from '../../lib/agent.js';
import { send, safeEqual, env } from '../../lib/util.js';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  if (!safeEqual(url.searchParams.get('key') || '', env('ADMIN_SECRET'))) return send(res, 401, { error: 'unauthorised' });
  const slug = url.searchParams.get('biz');
  const biz = slug && await db.one('businesses', `slug=eq.${q(slug)}&select=*`);
  if (!biz) return send(res, 404, { error: `No business with slug "${slug}"` });

  const missing = ['calendar_id', 'owner_email'].filter((k) => !biz[k] || String(biz[k]).startsWith('CAMBIA'));
  if (missing.length) return send(res, 400, { error: `Fill these in the businesses table first: ${missing.join(', ')}` });

  const base = (process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
  try {
    const llmBody = buildLlmBody(biz, base, env('TOOL_SECRET'));
    const llm = biz.retell_llm_id ? await retell.updateLlm(biz.retell_llm_id, llmBody) : await retell.createLlm(llmBody);
    const agentBody = buildAgentBody(biz, llm.llm_id, base, env('WEBHOOK_SECRET'));
    const agent = biz.retell_agent_id ? await retell.updateAgent(biz.retell_agent_id, agentBody) : await retell.createAgent(agentBody);
    await db.update('businesses', `id=eq.${q(biz.id)}`, { retell_llm_id: llm.llm_id, retell_agent_id: agent.agent_id });
    return send(res, 200, {
      ok: true, business: biz.name, llm_id: llm.llm_id, agent_id: agent.agent_id,
      next: biz.retell_agent_id ? 'Updated. Calls use the new version straight away (publish it in Retell if you use versions).'
        : 'Created. In Retell → Phone Numbers, set this agent as Inbound and Outbound agent for your number, then call it.',
    });
  } catch (e) {
    console.error('[sync-agent]', e);
    return send(res, 502, { error: e.message });
  }
}
