// Webhook de Instagram: verificación, firma, guardado de eventos y borrado de datos.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import webhook from '../api/meta/webhook.js';
import deletion, { parseSignedRequest } from '../api/meta/data-deletion.js';

let inserted; let deleted;
const mockRes = () => { const r = { statusCode: 0, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (s) => { r.raw = s; try { r.body = JSON.parse(s); } catch {} }; return r; };
const streamReq = (method, url, raw, headers = {}) => ({ method, url, headers, async *[Symbol.asyncIterator]() { if (raw) yield Buffer.from(raw); } });
const sign = (raw) => 'sha256=' + crypto.createHmac('sha256', 'appsecret').update(raw).digest('hex');

beforeEach(() => {
  inserted = []; deleted = [];
  Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', META_VERIFY_TOKEN: 'vt', META_APP_SECRET: 'appsecret', PUBLIC_BASE_URL: 'https://fs.test' });
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    if (opts.method === 'DELETE') { deleted.push(u.search); return new Response(null, { status: 204 }); }
    const b = JSON.parse(opts.body); inserted.push({ table: u.pathname.split('/').pop(), ...b });
    return new Response(JSON.stringify([b]), { status: 201 });
  };
});

test('GET verification echoes the challenge only with the right token', async () => {
  const ok = mockRes(); await webhook(streamReq('GET', '/api/meta/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123'), ok);
  assert.equal(ok.statusCode, 200); assert.equal(ok.raw, '123');
  const bad = mockRes(); await webhook(streamReq('GET', '/api/meta/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=123'), bad);
  assert.equal(bad.statusCode, 403);
});

test('POST with a valid signature stores the DM; invalid signature is rejected', async () => {
  const raw = JSON.stringify({ object: 'instagram', entry: [{ id: '178', time: 1, messaging: [{ sender: { id: 'u1' }, recipient: { id: '178' }, timestamp: 1, message: { mid: 'm1', text: 'Hi, price for gel nails?' } }] }] });
  const r = mockRes(); await webhook(streamReq('POST', '/api/meta/webhook', raw, { 'x-hub-signature-256': sign(raw) }), r);
  assert.equal(r.statusCode, 200); assert.equal(inserted.length, 1);
  assert.equal(inserted[0].kind, 'message'); assert.equal(inserted[0].text, 'Hi, price for gel nails?'); assert.equal(inserted[0].sender_id, 'u1');
  const bad = mockRes(); await webhook(streamReq('POST', '/api/meta/webhook', raw, { 'x-hub-signature-256': 'sha256=00' }), bad);
  assert.equal(bad.statusCode, 401); assert.equal(inserted.length, 1);
});

test('data deletion: valid signed_request deletes the user events and returns a confirmation', async () => {
  const payload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: 'u1' })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'appsecret').update(payload).digest('base64url');
  assert.equal(parseSignedRequest(`${sig}.${payload}`, 'appsecret').user_id, 'u1');
  assert.equal(parseSignedRequest(`${sig}.${payload}`, 'other'), null);
  const r = mockRes(); await deletion({ method: 'POST', headers: {}, body: { signed_request: `${sig}.${payload}` } }, r);
  assert.equal(r.statusCode, 200); assert.ok(r.body.confirmation_code); assert.match(r.body.url, /code=/);
  assert.match(deleted[0], /sender_id=eq.u1/); assert.equal(inserted[0].table, 'meta_deletions');
  const bad = mockRes(); await deletion({ method: 'POST', headers: {}, body: { signed_request: 'x.y' } }, bad); assert.equal(bad.statusCode, 400);
});
