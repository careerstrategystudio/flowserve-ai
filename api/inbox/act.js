// POST /api/inbox/act   { item_id, action: "callback" | "done", instruction }
// El dueño responde desde el panel. "callback" hace que la recepcionista llame al cliente con esa respuesta.
import { db, q, userFromToken } from '../../lib/db.js';
import { retell } from '../../lib/retell.js';
import { callbackBegin } from '../../lib/agent.js';
import { localParts } from '../../lib/time.js';
import { readJson, send, clip } from '../../lib/util.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = await userFromToken(token).catch(() => null);
  if (!user?.id) return send(res, 401, { error: 'Please sign in again.' });

  const { item_id, action, instruction } = await readJson(req);
  const item = item_id && await db.one('inbox_items', `id=eq.${q(item_id)}&select=*`);
  if (!item) return send(res, 404, { error: 'Not found' });
  const member = await db.one('members', `business_id=eq.${q(item.business_id)}&user_id=eq.${q(user.id)}&select=user_id`);
  if (!member) return send(res, 403, { error: 'Not allowed' });

  if (action === 'done') {
    await db.update('inbox_items', `id=eq.${q(item.id)}`, { status: 'done', resolved_at: new Date().toISOString(), owner_instruction: clip(instruction, 600) || item.owner_instruction });
    return send(res, 200, { ok: true });
  }

  if (action !== 'callback') return send(res, 400, { error: 'Unknown action' });
  const text = clip((instruction || '').trim(), 600);
  if (!text) return send(res, 400, { error: 'Write what the assistant should tell the client.' });
  if (!item.caller_phone) return send(res, 400, { error: 'This caller had no number. Mark it done instead.' });
  if (item.status === 'calling') return send(res, 409, { error: 'A call-back is already in progress.' });

  const biz = await db.one('businesses', `id=eq.${q(item.business_id)}&select=*`);
  if (!biz?.phone_e164 || !biz?.retell_agent_id) return send(res, 400, { error: 'The phone line is not set up yet.' });

  // Nada de llamar a deshoras: de 9:00 a 20:00, hora del negocio
  const h = localParts(biz.timezone || 'Europe/Dublin', new Date()).hh;
  if (h < 9 || h >= 20) return send(res, 400, { error: 'It is outside 9:00–20:00. Save it and send the call-back in the morning.' });

  const call = await retell.createPhoneCall({
    from_number: biz.phone_e164,
    to_number: item.caller_phone,
    override_agent_id: biz.retell_agent_id,
    metadata: { business_id: biz.id, inbox_item_id: item.id },
    retell_llm_dynamic_variables: {
      call_mode: 'callback',
      caller_name: item.caller_name || 'there',
      callback_context: [item.question, item.summary].filter(Boolean).join(' — ').slice(0, 800),
      owner_instruction: text,
    },
    agent_override: { retell_llm: { start_speaker: 'agent', begin_message: callbackBegin(biz) } },
    idempotency_key: `cb_${item.id.replace(/-/g, '')}_${Date.now()}`,
  });
  await db.update('inbox_items', `id=eq.${q(item.id)}`, { status: 'calling', owner_instruction: text, callback_call_id: call.call_id });
  return send(res, 200, { ok: true, call_id: call.call_id });
}
