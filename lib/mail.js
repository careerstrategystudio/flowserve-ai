// Avisos por email al dueño con Resend. Si no hay clave configurada, no falla: solo lo deja en el log.
import { esc } from './util.js';

export async function sendMail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'FlowServe <onboarding@resend.dev>';
  if (!key || !to) { console.log('[mail skipped]', subject); return { skipped: true }; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html }),
  });
  if (!r.ok) console.error('[mail error]', r.status, (await r.text()).slice(0, 200));
  return { ok: r.ok };
}

const wrap = (title, rows, cta) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <p style="font-size:12px;color:#64748b;margin:0 0 8px">FlowServe · AI receptionist</p>
  <h2 style="font-size:18px;margin:0 0 12px">${esc(title)}</h2>
  <table style="border-collapse:collapse;width:100%;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#64748b;width:120px;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`).join('')}</table>
  ${cta ? `<p style="margin:18px 0"><a href="${esc(cta.href)}" style="background:#0ea5e9;color:#04111d;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>` : ''}
</div>`;

const panelUrl = () => `${(process.env.PUBLIC_BASE_URL || 'https://flowserve-ai.vercel.app').replace(/\/$/, '')}/app/`;

export const notify = {
  inbox: (biz, item) => sendMail({
    to: biz.owner_email,
    subject: item.kind === 'escalation' ? `Needs your decision: ${item.caller_name || item.caller_phone}` : `New message from ${item.caller_name || item.caller_phone}`,
    html: wrap(item.kind === 'escalation' ? 'A caller needs your decision' : 'New message', [
      ['Caller', `${item.caller_name || 'Unknown'} · ${item.caller_phone || 'no number'}`],
      ['Summary', item.summary],
      ...(item.question ? [['Question', item.question]] : []),
      ...(item.urgency ? [['Urgency', item.urgency]] : []),
    ], { href: panelUrl(), label: item.kind === 'escalation' ? 'Reply in one sentence' : 'Open inbox' }),
  }),
  booking: (biz, verb, a) => sendMail({
    to: biz.notify_bookings ? biz.owner_email : null,
    subject: `${verb}: ${a.client_name} · ${a.when}`,
    html: wrap(`${verb} by phone`, [['Client', `${a.client_name} · ${a.client_phone || ''}`], ['Service', a.service || ''], ['When', a.when]], { href: panelUrl(), label: 'Open dashboard' }),
  }),
};
