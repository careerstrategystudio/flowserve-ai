// Procesa los eventos de llamada de Retell (separado del endpoint para poder probarlo).

const NO_ANSWER = new Set(['dial_no_answer', 'dial_busy', 'dial_failed', 'voicemail_reached', 'invalid_destination', 'telephony_provider_permission_denied', 'telephony_provider_unavailable', 'sip_routing_error', 'machine_detected']);

export async function processCallEvent(body, { db, q, clip }) {
  const { event, call } = body || {};
  if (!event || !call?.call_id) return { skipped: 'no call' };

  const meta = call.metadata || {};
  let biz = null;
  if (meta.business_id) biz = await db.one('businesses', `id=eq.${q(meta.business_id)}&select=id`);
  if (!biz && call.agent_id) biz = await db.one('businesses', `retell_agent_id=eq.${q(call.agent_id)}&select=id`);
  if (!biz) return { skipped: 'unknown business' };

  const row = {
    business_id: biz.id,
    retell_call_id: call.call_id,
    direction: call.direction || null,
    from_number: call.from_number || null,
    to_number: call.to_number || null,
    status: call.call_status || event,
    inbox_item_id: meta.inbox_item_id || null,
  };
  if (call.start_timestamp) row.started_at = new Date(call.start_timestamp).toISOString();
  if (call.end_timestamp) row.ended_at = new Date(call.end_timestamp).toISOString();
  if (call.start_timestamp && call.end_timestamp) row.duration_s = Math.round((call.end_timestamp - call.start_timestamp) / 1000);
  else if (call.duration_ms) row.duration_s = Math.round(call.duration_ms / 1000);
  if (call.transcript) row.transcript = clip(call.transcript, 20000);
  if (call.disconnection_reason) row.disconnection_reason = call.disconnection_reason;

  const a = call.call_analysis;
  if (a) {
    if (a.call_summary) row.summary = clip(a.call_summary, 2000);
    if (a.user_sentiment) row.sentiment = a.user_sentiment;
    const c = a.custom_analysis_data || {};
    if (c.outcome) row.outcome = String(c.outcome).toLowerCase().slice(0, 20);
    if (c.caller_name) row.caller_name = clip(c.caller_name, 80);
  }
  await db.upsert('calls', row, 'retell_call_id');

  // Devolución de llamada desde la Bandeja: cerrar o reabrir el asunto
  if (meta.inbox_item_id && (event === 'call_ended' || event === 'call_analyzed')) {
    const failed = NO_ANSWER.has(call.disconnection_reason) || (row.duration_s !== undefined && row.duration_s < 5);
    const patch = failed
      ? { status: 'open', callback_result: 'No answer on the call-back. Try again or call them yourself.' }
      : { status: 'done', resolved_at: new Date().toISOString(), ...(row.summary ? { callback_result: row.summary } : {}) };
    await db.update('inbox_items', `id=eq.${q(meta.inbox_item_id)}`, patch);
  }
  return { ok: true };
}
