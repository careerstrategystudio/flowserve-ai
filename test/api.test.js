// Prueba los endpoints HTTP de punta a punta con Supabase, Google y Retell simulados (fetch falso).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BIZ = {
  id: 'b1', slug: 'halden-demo', name: 'Halden Wellness Studio', timezone: 'Europe/Dublin', calendar_id: 'demo@group.calendar.google.com',
  owner_email: 'owner@example.com', active: true, capacity: 1, slot_step_min: 30, min_notice_min: 60, booking_window_days: 60,
  hours: { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [['09:00', '17:00']], thu: [['09:00', '17:00']], fri: [['09:00', '17:00']], sat: [['09:00', '17:00']], sun: [['09:00', '17:00']] },
  services: [{ id: 'relax', name: 'Relaxation Massage', duration_min: 60, price_eur: 75 }],
  phone_e164: '+35315550000', retell_agent_id: null, retell_llm_id: null,
};
const calls = [];
const store = { events: [], inbox: [], members: [{ business_id: 'b1', user_id: 'u1' }] };

before(() => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon',
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'fs@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    TOOL_SECRET: 'tool-secret', WEBHOOK_SECRET: 'hook-secret', ADMIN_SECRET: 'admin-secret', RETELL_API_KEY: 'rk',
    PUBLIC_BASE_URL: 'https://flowserve.test',
  });
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url); const method = opts.method || 'GET';
    const body = opts.body && typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
    calls.push({ host: u.host, path: u.pathname, method, body, headers: opts.headers });
    const json = (status, obj) => new Response(obj == null ? null : JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
    if (u.host === 'oauth2.googleapis.com') {
      const assertion = new URLSearchParams(String(opts.body)).get('assertion');
      assert.equal(assertion.split('.').length, 3, 'JWT firmado');
      return json(200, { access_token: 'gtok', expires_in: 3600 });
    }
    if (u.host === 'www.googleapis.com') {
      assert.equal(opts.headers.Authorization, 'Bearer gtok');
      if (method === 'GET') return json(200, { items: store.events });
      if (method === 'POST') { const e = { id: `ev${store.events.length + 1}`, status: 'confirmed', ...body }; store.events.push(e); return json(200, e); }
    }
    if (u.host === 'sb.test') {
      if (u.pathname === '/auth/v1/user') return opts.headers.Authorization === 'Bearer good-token' ? json(200, { id: 'u1' }) : json(401, {});
      const table = u.pathname.split('/').pop();
      const qs = u.search;
      if (table === 'businesses' && method === 'GET') return json(200, qs.includes('halden-demo') || qs.includes('id=eq.b1') ? [BIZ] : []);
      if (table === 'businesses' && method === 'PATCH') { Object.assign(BIZ, body); return json(200, [BIZ]); }
      if (table === 'members') return json(200, store.members.filter((m) => qs.includes(m.user_id)));
      if (table === 'inbox_items' && method === 'GET') return json(200, store.inbox.filter((i) => qs.includes(i.id)));
      if (table === 'inbox_items' && method === 'POST') { const r = { id: 'i1', ...body }; store.inbox.push(r); return json(201, [r]); }
      if (method === 'PATCH') { const r = store.inbox[0]; if (r) Object.assign(r, body); return json(200, [r]); }
      if (method === 'POST') return json(201, [{ id: 'x', ...body }]);
    }
    if (u.host === 'api.retellai.com') {
      if (u.pathname === '/create-retell-llm') return json(201, { llm_id: 'llm_1' });
      if (u.pathname === '/create-agent') return json(201, { agent_id: 'agent_1' });
      if (u.pathname === '/v2/create-phone-call') return json(201, { call_id: 'out_1' });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  };
});

function mockReq({ method = 'POST', url, headers = {}, body }) { return { method, url, headers, body }; }
function mockRes() {
  const r = { statusCode: 200, headers: {}, body: '' };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (b) => { r.body = b || ''; r.done = true; };
  return r;
}
const parse = (res) => (res.body ? JSON.parse(res.body) : null);

test('tool endpoint rejects calls without the secret', async () => {
  const { default: h } = await import('../api/voice/tool.js');
  const res = mockRes();
  await h(mockReq({ url: '/api/voice/tool?biz=halden-demo&fn=check_availability', body: {} }), res);
  assert.equal(res.statusCode, 401);
});

test('tool endpoint: availability then booking writes to Google Calendar', async () => {
  const { default: h } = await import('../api/voice/tool.js');
  const headers = { 'x-flowserve-secret': 'tool-secret' };
  let res = mockRes();
  await h(mockReq({ url: '/api/voice/tool?biz=halden-demo&fn=check_availability', headers, body: { name: 'check_availability', args: { service: 'relaxation', day: 'tomorrow' }, call: { call_id: 'c1', from_number: '+353871234567' } } }), res);
  const av = parse(res);
  assert.equal(res.statusCode, 200);
  assert.equal(av.ok, true, JSON.stringify(av));
  res = mockRes();
  await h(mockReq({ url: '/api/voice/tool?biz=halden-demo&fn=book_appointment', headers, body: { args: { service: 'relax', start: av.options[0].start, client_name: 'Aoife Murphy' }, call: { call_id: 'c1', from_number: '087 123 4567' } } }), res);
  const b = parse(res);
  assert.equal(b.booked, true, JSON.stringify(b));
  const created = calls.find((c) => c.host === 'www.googleapis.com' && c.method === 'POST');
  assert.equal(created.body.extendedProperties.private.fs_phone, '+353871234567');
  assert.equal(created.body.start.timeZone, 'Europe/Dublin');
});

test('tool endpoint turns crashes into a sentence the assistant can say', async () => {
  const { default: h } = await import('../api/voice/tool.js');
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, o) => { if (String(url).includes('googleapis.com/calendar')) throw new Error('network down'); return saved(url, o); };
  const res = mockRes();
  await h(mockReq({ url: '/api/voice/tool?biz=halden-demo&fn=check_availability', headers: { 'x-flowserve-secret': 'tool-secret' }, body: { args: { service: 'relax', day: 'tomorrow' } } }), res);
  globalThis.fetch = saved;
  assert.equal(res.statusCode, 200);
  assert.match(parse(res).say, /take a message/);
});

test('sync-agent creates the Retell LLM and agent and stores the ids', async () => {
  const { default: h } = await import('../api/admin/sync-agent.js');
  let res = mockRes();
  await h(mockReq({ method: 'GET', url: '/api/admin/sync-agent?biz=halden-demo&key=wrong', headers: {} }), res);
  assert.equal(res.statusCode, 401);
  res = mockRes();
  await h(mockReq({ method: 'GET', url: '/api/admin/sync-agent?biz=halden-demo&key=admin-secret', headers: { host: 'x' } }), res);
  const j = parse(res);
  assert.equal(j.ok, true, JSON.stringify(j));
  assert.equal(BIZ.retell_agent_id, 'agent_1');
  const llmCall = calls.find((c) => c.path === '/create-retell-llm');
  assert.equal(llmCall.headers.Authorization, 'Bearer rk');
  assert.ok(llmCall.body.general_tools.every((t) => t.type !== 'custom' || t.url.startsWith('https://flowserve.test/api/voice/tool')));
});

test('inbox call-back: needs a signed-in member, then asks Retell to call', async () => {
  const { default: h } = await import('../api/inbox/act.js');
  store.inbox = [{ id: 'i1', business_id: 'b1', kind: 'escalation', caller_name: 'Siobhán', caller_phone: '+353871234567', question: 'Can my daughter come?', status: 'open' }];
  let res = mockRes();
  await h(mockReq({ url: '/api/inbox/act', headers: { authorization: 'Bearer bad' }, body: { item_id: 'i1', action: 'callback', instruction: 'Yes' } }), res);
  assert.equal(res.statusCode, 401);

  res = mockRes();
  await h(mockReq({ url: '/api/inbox/act', headers: { authorization: 'Bearer good-token' }, body: { item_id: 'i1', action: 'callback', instruction: '' } }), res);
  assert.equal(res.statusCode, 400);

  res = mockRes();
  await h(mockReq({ url: '/api/inbox/act', headers: { authorization: 'Bearer good-token' }, body: { item_id: 'i1', action: 'callback', instruction: 'Yes, from 14 with a parent present.' } }), res);
  const hour = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', hour: '2-digit', hourCycle: 'h23' }).format(new Date());
  if (hour >= 9 && hour < 20) {
    assert.equal(res.statusCode, 200, res.body);
    const out = calls.find((c) => c.path === '/v2/create-phone-call');
    assert.equal(out.body.to_number, '+353871234567');
    assert.equal(out.body.from_number, '+35315550000');
    assert.equal(out.body.retell_llm_dynamic_variables.call_mode, 'callback');
    assert.equal(out.body.metadata.inbox_item_id, 'i1');
    assert.equal(store.inbox[0].status, 'calling');
  } else {
    assert.equal(res.statusCode, 400); // fuera de horario no llama
  }
});

test('webhook needs its key', async () => {
  const { default: h } = await import('../api/voice/webhook.js');
  const res = mockRes();
  await h(mockReq({ url: '/api/voice/webhook?key=nope', body: {} }), res);
  assert.equal(res.statusCode, 401);
});

test('public config never leaks secrets', async () => {
  const { default: h } = await import('../api/public-config.js');
  const res = mockRes();
  h(mockReq({ method: 'GET', url: '/api/public-config' }), res);
  const txt = res.body;
  for (const s of ['srv', 'tool-secret', 'hook-secret', 'admin-secret', 'rk', 'PRIVATE KEY']) assert.ok(!txt.includes(`"${s}"`) && !txt.includes(s === 'PRIVATE KEY' ? s : `:"${s}"`), s);
  assert.equal(JSON.parse(txt).configured.retell, true);
});
