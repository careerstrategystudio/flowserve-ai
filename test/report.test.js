// Informe semanal: semana correcta, horario, cifras, render y endpoint (Supabase y Resend simulados).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { lastWeek, isOpenAt, computeStats, renderReport } from '../lib/report.js';
import handler from '../api/report/weekly.js';

const BIZ = {
  id: 'b1', slug: 'halden', name: 'Halden Wellness Studio', timezone: 'Europe/Dublin', owner_email: 'owner@example.ie', plan_minutes: 300,
  hours: { mon: [['10:00', '19:00']], tue: [['10:00', '19:00']], wed: [['10:00', '19:00']], thu: [['10:00', '19:00']], fri: [['10:00', '19:00']], sat: [['10:00', '16:00']], sun: [] },
  services: [{ id: 'relax', price_eur: 75 }, { id: 'deep', price_eur: 80 }],
};

test('lastWeek: Monday to Monday in Dublin time, across the October clock change', () => {
  const w = lastWeek('Europe/Dublin', new Date('2026-10-26T09:00:00Z')); // lunes después del cambio de hora (25 oct)
  assert.equal(w.startISO, '2026-10-19'); assert.equal(w.endISO, '2026-10-26');
  assert.equal(w.start.toISOString(), '2026-10-18T23:00:00.000Z'); // 00:00 IST
  assert.equal(w.end.toISOString(), '2026-10-26T00:00:00.000Z');   // 00:00 GMT
  const sun = lastWeek('Europe/Dublin', new Date('2026-10-25T20:00:00Z'));
  assert.equal(sun.startISO, '2026-10-12');
});

test('isOpenAt uses the business hours in local time', () => {
  assert.equal(isOpenAt(BIZ, new Date('2026-10-20T12:00:00Z')), true);  // martes 13:00
  assert.equal(isOpenAt(BIZ, new Date('2026-10-20T20:30:00Z')), false); // martes 21:30
  assert.equal(isOpenAt(BIZ, new Date('2026-10-25T12:00:00Z')), false); // domingo
});

const DATA = {
  calls: [
    { direction: 'inbound', started_at: '2026-10-20T20:30:00Z', duration_s: 120, caller_name: 'Emma', outcome: 'booked', summary: 'Booked a relaxation massage.' },
    { direction: 'inbound', started_at: '2026-10-21T12:00:00Z', duration_s: 60, caller_name: 'Liam', outcome: 'escalated', summary: 'Asked about a group booking.' },
    { direction: 'outbound', started_at: '2026-10-21T15:00:00Z', duration_s: 60, outcome: 'info' },
  ],
  prevCalls: [{ direction: 'inbound' }],
  appts: [{ service_id: 'relax', status: 'booked' }, { service_id: 'deep', status: 'cancelled' }],
  upcoming: [{ id: 1 }, { id: 2 }], inbox: [{ kind: 'escalation' }], openInbox: [{ id: 'i1' }], monthSeconds: 1800,
};

test('computeStats counts only real rows', () => {
  const s = computeStats(BIZ, DATA);
  assert.equal(s.callsAnswered, 2); assert.equal(s.callsPrevWeek, 1); assert.equal(s.afterHours, 1); assert.equal(s.callbacks, 1);
  assert.equal(s.bookingsMade, 1); assert.equal(s.bookingsValue, 75); assert.equal(s.upcoming, 2);
  assert.equal(s.questionsToYou, 1); assert.equal(s.stillOpen, 1); assert.equal(s.monthMinutes, 30); assert.equal(s.byOutcome.booked, 1);
});

test('renderReport: subject and key lines, escapes caller text', () => {
  const w = lastWeek('Europe/Dublin', new Date('2026-10-26T09:00:00Z'));
  const s = computeStats(BIZ, { ...DATA, calls: [{ ...DATA.calls[0], caller_name: '<b>x</b>' }] });
  const { subject, html } = renderReport(BIZ, w, s, 'https://x/app/');
  assert.equal(subject, 'Your week at Halden Wellness Studio: 1 calls, 1 bookings');
  assert.match(html, /19 Oct – 25 Oct/); assert.match(html, /30 of 300/); assert.ok(!html.includes('<b>x</b>'));
});

/* ---------- endpoint ---------- */
let sent; let logged; let mailOk;
const mockRes = () => { const r = { statusCode: 0, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (s) => { r.raw = s; try { r.body = JSON.parse(s); } catch {} }; return r; };
beforeEach(() => {
  sent = []; logged = []; mailOk = true;
  Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', ADMIN_SECRET: 'adm', CRON_SECRET: 'cron', RESEND_API_KEY: 're_test', PUBLIC_BASE_URL: 'https://fs.test' });
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url); const m = opts.method || 'GET';
    if (u.host === 'api.resend.com') { sent.push(JSON.parse(opts.body)); return new Response('{}', { status: mailOk ? 200 : 500 }); }
    const t = u.pathname.split('/').pop();
    if (t === 'businesses') return new Response(JSON.stringify([BIZ]), { status: 200 });
    if (t === 'weekly_reports' && m === 'GET') return new Response(JSON.stringify(logged), { status: 200 });
    if (t === 'weekly_reports' && m === 'POST') { const b = JSON.parse(opts.body); logged.push(b); return new Response(JSON.stringify([b]), { status: 201 }); }
    if (t === 'calls') return new Response(JSON.stringify(u.search.includes('order=') ? DATA.calls : []), { status: 200 });
    return new Response('[]', { status: 200 });
  };
});

test('endpoint: rejects without secret', async () => {
  const r = mockRes(); await handler({ url: '/api/report/weekly', headers: {} }, r); assert.equal(r.statusCode, 401);
  const r2 = mockRes(); await handler({ url: '/api/report/weekly?key=wrong', headers: {} }, r2); assert.equal(r2.statusCode, 401);
});

test('endpoint: preview returns HTML and sends nothing', async () => {
  const r = mockRes(); await handler({ url: '/api/report/weekly?key=adm&biz=halden&preview=1&now=2026-10-26T09:00:00Z', headers: {} }, r);
  assert.equal(r.statusCode, 200); assert.match(r.raw, /Weekly report/); assert.equal(sent.length, 0);
});

test('endpoint: cron sends once per week, logs it, and skips the second run', async () => {
  const req = { url: '/api/report/weekly?now=2026-10-26T07:00:00Z', headers: { authorization: 'Bearer cron' } };
  const r = mockRes(); await handler(req, r);
  assert.equal(r.statusCode, 200); assert.equal(sent.length, 1); assert.deepEqual(sent[0].to, ['owner@example.ie']); assert.equal(logged.length, 1);
  assert.equal(logged[0].week_start, '2026-10-19');
  const r2 = mockRes(); await handler(req, r2); assert.equal(r2.body.results[0].skipped, 'already_sent'); assert.equal(sent.length, 1);
});

test('endpoint: a failed email is not logged as sent', async () => {
  mailOk = false; const r = mockRes();
  await handler({ url: '/api/report/weekly?now=2026-10-26T07:00:00Z', headers: { authorization: 'Bearer cron' } }, r);
  assert.equal(r.body.results[0].sent, false); assert.equal(logged.length, 0);
});

test('endpoint: test send to another address does not mark the week as sent', async () => {
  const r = mockRes(); await handler({ url: '/api/report/weekly?key=adm&biz=halden&to=me@x.ie&now=2026-10-26T07:00:00Z', headers: {} }, r);
  assert.deepEqual(sent[0].to, ['me@x.ie']); assert.equal(logged.length, 0);
});
