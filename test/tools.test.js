import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tools } from '../lib/tools.js';
import { processCallEvent } from '../lib/calls.js';
import { buildLlmBody, buildAgentBody, buildPrompt } from '../lib/agent.js';
import { parseLocalDateTime } from '../lib/time.js';

const TZ = 'Europe/Dublin';
const biz = {
  id: 'b1', slug: 'halden-demo', name: 'Halden Wellness Studio', timezone: TZ, calendar_id: 'cal@group', owner_email: 'o@x.ie',
  capacity: 1, slot_step_min: 30, min_notice_min: 60, booking_window_days: 60, cancel_policy_hours: 24, deposit_eur: 20,
  hours: { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [], thu: [['09:00', '17:00']], fri: [['09:00', '17:00']], sat: [], sun: [] },
  services: [{ id: 'relax', name: 'Relaxation Massage', duration_min: 60, price_eur: 75 }],
};

// Calendario y base de datos falsos en memoria
function fakeDeps(now) {
  const events = [];
  const rows = { appointments: [], inbox_items: [] };
  let n = 0;
  const gcal = {
    async busy(cal, a, b) { return events.filter((e) => e.start < b && e.end > a); },
    async byPhone(cal, phone, from) { return events.filter((e) => e.props.fs_phone === phone && e.start >= from); },
    async get(cal, id) { const e = events.find((x) => x.id === id); if (!e) throw new Error('404'); return e; },
    async create(cal, e) { const ev = { id: `ev${++n}`, start: e.start, end: e.end, summary: e.summary, props: e.props }; events.push(ev); return ev; },
    async move(cal, id, { start, end }) { const e = events.find((x) => x.id === id); e.start = start; e.end = end; return e; },
    async cancel(cal, id) { events.splice(events.findIndex((x) => x.id === id), 1); },
  };
  const db = {
    async insert(t, r) { const row = { id: `r${++n}`, ...r }; rows[t].push(row); return row; },
    async update(t, query, patch) { return [patch]; },
  };
  const sent = [];
  const notify = { booking: async (...a) => sent.push(['booking', ...a]), inbox: async (...a) => sent.push(['inbox', ...a]) };
  return { deps: { gcal, db, notify, now }, events, rows, sent };
}
const call = { call_id: 'call_1', from_number: '+353871234567' };

test('full phone journey: check, book, double-book refused, find, move, cancel', async () => {
  const now = new Date('2026-10-16T10:00:00Z'); // viernes
  const { deps, events, rows, sent } = fakeDeps(now);

  const av = await tools.check_availability(biz, { service: 'relaxation', day: 'monday', preferred_time: 'afternoon' }, call, deps);
  assert.equal(av.ok, true);
  assert.equal(av.day, 'Monday 19 October');
  assert.ok(av.options.length >= 1 && av.options.every((o) => o.start.startsWith('2026-10-19T1')));

  const start = av.options[0].start;
  const b = await tools.book_appointment(biz, { service: 'Relaxation Massage', start, client_name: 'Aoife Murphy' }, call, deps);
  assert.equal(b.booked, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].props.fs_phone, '+353871234567');
  assert.equal(rows.appointments.length, 1);
  assert.equal(sent[0][0], 'booking');

  // el mismo hueco ya no se puede reservar
  const dup = await tools.book_appointment(biz, { service: 'relax', start, client_name: 'Other Person' }, { call_id: 'c2', from_number: '+353860000000' }, deps);
  assert.equal(dup.booked, false);
  assert.ok(Array.isArray(dup.alternatives));

  // sin nombre no reserva
  assert.equal((await tools.book_appointment(biz, { service: 'relax', start: '2026-10-19T09:00' }, call, deps)).booked, false);

  const f = await tools.find_appointments(biz, {}, call, deps);
  assert.equal(f.found, 1);
  const id = f.appointments[0].appointment_id;

  // otro número no puede mover ni cancelar la cita
  assert.equal((await tools.cancel_appointment(biz, { appointment_id: id }, { from_number: '+353860000000' }, deps)).cancelled, false);

  const mv = await tools.reschedule_appointment(biz, { appointment_id: id, new_start: '2026-10-20T11:00' }, call, deps);
  assert.equal(mv.moved, true);
  assert.equal(events[0].start.toISOString(), parseLocalDateTime('2026-10-20T11:00', TZ).toISOString());

  const c = await tools.cancel_appointment(biz, { appointment_id: id }, call, deps);
  assert.equal(c.cancelled, true);
  assert.equal(c.late_cancellation, false);
  assert.equal(events.length, 0);
});

test('closed day offers the next open day; unknown service asks again', async () => {
  const now = new Date('2026-10-16T10:00:00Z');
  const { deps } = fakeDeps(now);
  const r = await tools.check_availability(biz, { service: 'relax', day: 'wednesday' }, call, deps);
  assert.equal(r.ok, true);
  assert.equal(r.requested_day_full, 'Wednesday 21 October');
  assert.equal(r.day, 'Thursday 22 October');
  const u = await tools.check_availability(biz, { service: 'facial', day: 'monday' }, call, deps);
  assert.equal(u.ok, false);
  assert.match(u.say, /Relaxation Massage/);
});

test('late cancellation is flagged', async () => {
  const now = new Date('2026-10-19T07:00:00Z'); // lunes 8:00 Dublín
  const { deps } = fakeDeps(now);
  const b = await tools.book_appointment(biz, { service: 'relax', start: '2026-10-19T15:00', client_name: 'Late Person' }, call, deps);
  assert.equal(b.booked, true);
  const c = await tools.cancel_appointment(biz, { appointment_id: b.appointment_id }, call, deps);
  assert.equal(c.late_cancellation, true);
  assert.ok(c.policy);
});

test('messages and owner questions land in the inbox and notify', async () => {
  const { deps, rows, sent } = fakeDeps(new Date());
  await tools.take_message(biz, { caller_name: 'Ronan', message: 'Lost voucher', urgency: 'urgent' }, call, deps);
  await tools.ask_owner(biz, { caller_name: 'Siobhán', question: 'Can my 14 year old get a massage?' }, call, deps);
  assert.equal(rows.inbox_items.length, 2);
  assert.equal(rows.inbox_items[0].kind, 'message');
  assert.equal(rows.inbox_items[0].urgency, 'urgent');
  assert.equal(rows.inbox_items[1].kind, 'escalation');
  assert.equal(rows.inbox_items[1].caller_phone, '+353871234567');
  assert.equal(sent.filter((s) => s[0] === 'inbox').length, 2);
});

test('webhook stores calls and closes or reopens call-backs', async () => {
  const ops = [];
  const db = {
    async one(t, query) { return query.includes('retell_agent_id=eq.agent_1') || query.includes('id=eq.b1') ? { id: 'b1' } : null; },
    async upsert(t, row) { ops.push(['upsert', t, row]); return row; },
    async update(t, query, patch) { ops.push(['update', t, query, patch]); return [patch]; },
  };
  const deps = { db, q: encodeURIComponent, clip: (s, n) => String(s).slice(0, n) };
  await processCallEvent({ event: 'call_analyzed', call: { call_id: 'c1', agent_id: 'agent_1', direction: 'inbound', from_number: '+3538', start_timestamp: 1000, end_timestamp: 61000, transcript: 'hi', call_analysis: { call_summary: 'Booked a massage', user_sentiment: 'Positive', custom_analysis_data: { outcome: 'Booked', caller_name: 'Aoife' } } } }, deps);
  assert.deepEqual(ops[0][2].duration_s, 60);
  assert.equal(ops[0][2].outcome, 'booked');
  assert.equal(ops[0][2].summary, 'Booked a massage');

  await processCallEvent({ event: 'call_ended', call: { call_id: 'c2', metadata: { business_id: 'b1', inbox_item_id: 'i9' }, disconnection_reason: 'dial_no_answer' } }, deps);
  assert.equal(ops.at(-1)[3].status, 'open');
  await processCallEvent({ event: 'call_analyzed', call: { call_id: 'c3', metadata: { business_id: 'b1', inbox_item_id: 'i9' }, start_timestamp: 0, end_timestamp: 90000, disconnection_reason: 'user_hangup', call_analysis: { call_summary: 'Passed on answer' } } }, deps);
  assert.equal(ops.at(-1)[3].status, 'done');
  assert.equal(ops.at(-1)[3].callback_result, 'Passed on answer');

  assert.deepEqual(await processCallEvent({ event: 'call_ended', call: { call_id: 'x', agent_id: 'nope' } }, deps), { skipped: 'unknown business' });
});

test('agent config: AI disclosure, every tool wired with secret, valid schemas', () => {
  const llm = buildLlmBody(biz, 'https://fs.example', 's3cret');
  assert.match(llm.begin_message, /AI/);
  assert.match(llm.begin_message, /transcribed/);
  assert.equal(llm.start_speaker, 'agent');
  const custom = llm.general_tools.filter((t) => t.type === 'custom');
  assert.deepEqual(custom.map((t) => t.name).sort(), ['ask_owner', 'book_appointment', 'cancel_appointment', 'check_availability', 'find_appointments', 'reschedule_appointment', 'take_message']);
  for (const t of custom) {
    assert.equal(t.headers['x-flowserve-secret'], 's3cret');
    assert.equal(t.parameters.type, 'object');
    assert.ok(t.url.startsWith('https://fs.example/api/voice/tool?biz=halden-demo&fn='));
  }
  assert.ok(llm.general_tools.some((t) => t.type === 'end_call'));
  const p = buildPrompt(biz);
  assert.match(p, /Relaxation Massage: 60 min, €75/);
  assert.match(p, /Wednesday: closed/);
  assert.match(p, /€20 deposit/);
  const agent = buildAgentBody(biz, 'llm_1', 'https://fs.example', 'whk');
  assert.equal(agent.response_engine.llm_id, 'llm_1');
  assert.equal(agent.webhook_url, 'https://fs.example/api/voice/webhook?key=whk');
  assert.ok(agent.max_call_duration_ms <= 600000);
});
