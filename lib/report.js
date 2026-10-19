// Informe semanal de Front Desk: qué pasó la semana pasada (lunes a domingo, hora del negocio).
// Solo usa datos reales de las tablas calls, appointments e inbox_items. Nada estimado salvo el valor
// de las reservas, que sale del precio de cada servicio configurado por el negocio.
import { localParts, localToUtc, addDaysISO, isoDate, WEEKDAY_KEYS, hm } from './time.js';
import { esc } from './util.js';

/** Semana anterior completa en la zona del negocio: [inicio, fin) en UTC + etiqueta. */
export function lastWeek(tz, now = new Date()) {
  const p = localParts(tz, now);
  const today = isoDate(p);
  const back = (p.wd + 6) % 7; // días desde el lunes de esta semana
  const thisMon = addDaysISO(today, -back);
  const prevMon = addDaysISO(thisMon, -7);
  const toUtc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return localToUtc(tz, y, m, d, 0, 0); };
  return { startISO: prevMon, endISO: thisMon, start: toUtc(prevMon), end: toUtc(thisMon), prevStart: toUtc(addDaysISO(prevMon, -7)) };
}

/** ¿Estaba abierto el negocio en ese instante? (según biz.hours) */
export function isOpenAt(biz, date) {
  const p = localParts(biz.timezone || 'Europe/Dublin', date);
  const ranges = (biz.hours || {})[WEEKDAY_KEYS[p.wd]] || [];
  const mins = p.hh * 60 + p.mm;
  return ranges.some(([a, b]) => mins >= hm(a) && mins < hm(b));
}

const OUTCOMES = ['booked', 'rescheduled', 'cancelled', 'message', 'escalated', 'info', 'spam', 'other'];

/** Calcula las cifras de la semana a partir de las filas ya cargadas. */
export function computeStats(biz, { calls, prevCalls, appts, upcoming, inbox, openInbox, monthSeconds }) {
  const inbound = calls.filter((c) => c.direction !== 'outbound');
  const priceOf = (id) => (biz.services || []).find((s) => s.id === id)?.price_eur || 0;
  const booked = appts.filter((a) => a.status !== 'cancelled');
  const byOutcome = Object.fromEntries(OUTCOMES.map((o) => [o, 0]));
  for (const c of inbound) byOutcome[OUTCOMES.includes(c.outcome) ? c.outcome : 'other']++;
  return {
    callsAnswered: inbound.length,
    callsPrevWeek: prevCalls.filter((c) => c.direction !== 'outbound').length,
    afterHours: inbound.filter((c) => c.started_at && !isOpenAt(biz, new Date(c.started_at))).length,
    callbacks: calls.filter((c) => c.direction === 'outbound').length,
    minutes: Math.round(calls.reduce((s, c) => s + (c.duration_s || 0), 0) / 60),
    byOutcome,
    bookingsMade: booked.length,
    bookingsValue: booked.reduce((s, a) => s + priceOf(a.service_id), 0),
    upcoming: upcoming.length,
    questionsToYou: inbox.filter((i) => i.kind === 'escalation').length,
    messages: inbox.filter((i) => i.kind === 'message').length,
    stillOpen: openInbox.length,
    monthMinutes: Math.round(monthSeconds / 60),
    planMinutes: biz.plan_minutes || 300,
    recent: inbound.filter((c) => c.summary).slice(0, 5).map((c) => ({ when: c.started_at, name: c.caller_name, outcome: c.outcome, summary: c.summary })),
  };
}

/** Carga los datos de la semana desde Supabase. */
export async function loadWeek(db, q, biz, week) {
  const B = `business_id=eq.${biz.id}`;
  const tz = biz.timezone || 'Europe/Dublin';
  const lp = localParts(tz, week.end);
  const monthStart = localToUtc(tz, lp.y, lp.m, 1);
  const [calls, prevCalls, appts, upcoming, inbox, openInbox, month] = await Promise.all([
    db.select('calls', `${B}&started_at=gte.${q(week.start.toISOString())}&started_at=lt.${q(week.end.toISOString())}&select=direction,started_at,duration_s,caller_name,outcome,summary&order=started_at.desc`),
    db.select('calls', `${B}&started_at=gte.${q(week.prevStart.toISOString())}&started_at=lt.${q(week.start.toISOString())}&select=direction`),
    db.select('appointments', `${B}&created_at=gte.${q(week.start.toISOString())}&created_at=lt.${q(week.end.toISOString())}&select=service_id,status`),
    db.select('appointments', `${B}&status=eq.booked&starts_at=gte.${q(week.end.toISOString())}&starts_at=lt.${q(new Date(week.end.getTime() + 7 * 864e5).toISOString())}&select=id`),
    db.select('inbox_items', `${B}&created_at=gte.${q(week.start.toISOString())}&created_at=lt.${q(week.end.toISOString())}&select=kind`),
    db.select('inbox_items', `${B}&status=eq.open&select=id`),
    db.select('calls', `${B}&started_at=gte.${q(monthStart.toISOString())}&started_at=lt.${q(week.end.toISOString())}&select=duration_s`),
  ]);
  return { calls, prevCalls, appts, upcoming, inbox, openInbox, monthSeconds: month.reduce((s, c) => s + (c.duration_s || 0), 0) };
}

const fmtDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const OUT_LABEL = { booked: 'Booked', rescheduled: 'Moved', cancelled: 'Cancelled', message: 'Message', escalated: 'Asked you', info: 'Info', spam: 'Spam', other: 'Other' };

/** Asunto + HTML del email. */
export function renderReport(biz, week, s, panelUrl) {
  const range = `${fmtDay(week.startISO)} – ${fmtDay(addDaysISO(week.endISO, -1))}`;
  const delta = s.callsAnswered - s.callsPrevWeek;
  const deltaTxt = s.callsPrevWeek ? `${delta >= 0 ? '+' : ''}${delta} vs the week before` : '';
  const kpi = (n, l, sub = '') => `<td style="padding:12px;border:1px solid #e2e8f0;border-radius:10px;width:33%;vertical-align:top"><div style="font-size:26px;font-weight:700;color:#0f172a">${esc(n)}</div><div style="font-size:13px;color:#475569">${esc(l)}</div>${sub ? `<div style="font-size:12px;color:#94a3b8;margin-top:2px">${esc(sub)}</div>` : ''}</td>`;
  const row = (k, v) => `<tr><td style="padding:6px 0;color:#475569">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a">${esc(v)}</td></tr>`;
  const usedPct = Math.min(100, Math.round((s.monthMinutes / s.planMinutes) * 100));
  const quiet = s.callsAnswered === 0 && s.bookingsMade === 0 && s.questionsToYou === 0 && s.messages === 0;
  const outcomes = Object.entries(s.byOutcome).filter(([, n]) => n).map(([o, n]) => `${OUT_LABEL[o]} ${n}`).join(' · ') || '—';
  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;line-height:1.5">
  <p style="font-size:12px;color:#64748b;margin:0 0 4px">FlowServe · Weekly report</p>
  <h2 style="font-size:20px;margin:0 0 2px">${esc(biz.name)}</h2>
  <p style="font-size:14px;color:#475569;margin:0 0 18px">${esc(range)}</p>
  ${quiet ? '<p style="background:#f1f5f9;border-radius:10px;padding:12px;font-size:14px">A quiet week: no calls or messages came through FlowServe.</p>' : ''}
  <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:6px;margin:0 -6px 12px">
    <tr>${kpi(s.callsAnswered, 'Calls answered', deltaTxt)}${kpi(s.bookingsMade, 'Bookings made by phone', s.bookingsValue ? `€${s.bookingsValue} in services` : '')}${kpi(s.afterHours, 'Calls outside opening hours', 'answered while you were closed')}</tr>
  </table>
  <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #e2e8f0">
    ${row('What callers wanted', outcomes)}
    ${row('Questions sent to you', s.questionsToYou)}
    ${row('Messages taken', s.messages)}
    ${row('Call-backs made for you', s.callbacks)}
    ${row('Still waiting in your Inbox', s.stillOpen)}
    ${row('Bookings in the next 7 days (by phone)', s.upcoming)}
    ${row('Call minutes this month', `${s.monthMinutes} of ${s.planMinutes} (${usedPct}%)`)}
  </table>
  ${s.recent.length ? `<h3 style="font-size:15px;margin:20px 0 8px">Recent calls</h3><ul style="padding-left:18px;margin:0;font-size:14px;color:#334155">${s.recent.map((c) => `<li style="margin-bottom:6px"><b>${esc(c.name || 'Caller')}</b> — ${esc(c.summary)}</li>`).join('')}</ul>` : ''}
  ${s.stillOpen ? `<p style="margin:18px 0 0;font-size:14px"><b>${s.stillOpen}</b> ${s.stillOpen === 1 ? 'item is' : 'items are'} waiting for your answer.</p>` : ''}
  <p style="margin:20px 0"><a href="${esc(panelUrl)}" style="background:#0ea5e9;color:#04111d;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open your dashboard</a></p>
  <p style="font-size:12px;color:#94a3b8">Figures come from the calls handled by your FlowServe receptionist. Booking value uses your listed service prices. Reply to this email if anything looks wrong.</p>
</div>`;
  return { subject: `Your week at ${biz.name}: ${s.callsAnswered} calls, ${s.bookingsMade} bookings`, html };
}
