// FlowServe Social: precios centralizados, validación y endpoint /api/social/enquiry (Supabase simulado).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SOCIAL_PACKAGES, quote, BUNDLE_DISCOUNTS } from '../social-media/pricing.js';
import handler, { validate } from '../api/social/enquiry.js';

const good = {
  business_name: 'Halden Wellness Studio', contact_name: 'Aoife Murphy', email: 'Aoife@Example.ie',
  website_url: 'halden.example', instagram_url: 'instagram.com/halden', facebook_url: '',
  category: 'massage-wellness', package_id: 'social-growth', addons: ['front-desk'], objective: 'bookings',
  language: 'en', posting_frequency: 'monthly', can_supply_media: 'yes', requirements: 'Christmas vouchers', consent: true,
};

test('pricing config: three packages, Growth is the only "most popular", Premium is "from"', () => {
  assert.deepEqual(SOCIAL_PACKAGES.map((p) => [p.id, p.price]), [['social-starter', 299], ['social-growth', 499], ['social-premium', 699]]);
  assert.deepEqual(SOCIAL_PACKAGES.filter((p) => p.popular).map((p) => p.id), ['social-growth']);
  assert.equal(SOCIAL_PACKAGES.find((p) => p.id === 'social-premium').from, true);
});

test('quote: standalone, add-on total, "from" propagates, no discount unless configured', () => {
  assert.equal(quote('social-starter').total, 299);
  const both = quote('social-growth', ['front-desk']);
  assert.equal(both.lines.length, 2); assert.equal(both.total, 748); assert.equal(both.discounts.length, 0);
  assert.equal(quote('social-premium', ['front-desk']).from, true);
  BUNDLE_DISCOUNTS.push({ id: 't', requires: ['social-growth', 'front-desk'], amount: 50, label: { en: 'x', es: 'x' } });
  assert.equal(quote('social-growth', ['front-desk']).total, 698);
  BUNDLE_DISCOUNTS.length = 0;
});

test('validate: accepts a good form and normalises links and email', () => {
  const { data, errors } = validate(good);
  assert.equal(errors, undefined);
  assert.equal(data.email, 'aoife@example.ie');
  assert.equal(data.instagram_url, 'https://instagram.com/halden');
  assert.equal(data.facebook_url, null);
  assert.deepEqual(data.addons, ['front-desk']);
});

test('validate: reports each bad field', () => {
  const { errors } = validate({ ...good, email: 'nope', instagram_url: 'facebook.com/x', category: 'cars', consent: false, package_id: 'gold' });
  assert.deepEqual(Object.keys(errors).sort(), ['category', 'consent', 'email', 'instagram_url', 'package_id']);
});

/* ---------- endpoint ---------- */
const mockReq = (body, headers = {}) => ({ method: 'POST', headers: { origin: 'https://flowserve.test', 'x-forwarded-for': '9.9.9.9', ...headers }, body });
const mockRes = () => { const r = { statusCode: 0, body: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (s) => { r.body = JSON.parse(s); }; return r; };
let rows; let failInsert;

beforeEach(() => {
  rows = []; failInsert = false;
  Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', PUBLIC_BASE_URL: 'https://flowserve.test', TOOL_SECRET: 't' });
  delete process.env.SOCIAL_NOTIFY_EMAIL; delete process.env.RESEND_API_KEY;
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    assert.equal(u.host, 'sb.test'); assert.equal(u.pathname, '/rest/v1/social_enquiries');
    if ((opts.method || 'GET') === 'GET') return new Response(JSON.stringify(rows.filter((r) => u.search.includes(r.ip_hash))), { status: 200 });
    if (failInsert) return new Response('boom', { status: 500 });
    const row = { id: `e${rows.length + 1}`, ...JSON.parse(opts.body) }; rows.push(row);
    return new Response(JSON.stringify([row]), { status: 201 });
  };
});

test('enquiry: 201 only after the row is saved, with the quoted total', async () => {
  const res = mockRes(); await handler(mockReq(good), res);
  assert.equal(res.statusCode, 201); assert.equal(res.body.ok, true); assert.equal(rows.length, 1);
  assert.equal(rows[0].quoted_monthly_eur, 748); assert.equal(rows[0].consent, undefined); assert.ok(rows[0].consent_at);
});

test('enquiry: validation errors return 422 and save nothing', async () => {
  const res = mockRes(); await handler(mockReq({ ...good, email: 'x' }), res);
  assert.equal(res.statusCode, 422); assert.equal(res.body.fields.email, 'email'); assert.equal(rows.length, 0);
});

test('enquiry: database failure is reported as failure, never as success', async () => {
  failInsert = true; const res = mockRes(); await handler(mockReq(good), res);
  assert.equal(res.statusCode, 500); assert.notEqual(res.body.ok, true);
});

test('enquiry: missing configuration returns 503', async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY; const res = mockRes(); await handler(mockReq(good), res);
  assert.equal(res.statusCode, 503);
});

test('enquiry: foreign origin 403, honeypot 400, per-IP limit 429', async () => {
  const a = mockRes(); await handler(mockReq(good, { origin: 'https://evil.example' }), a); assert.equal(a.statusCode, 403);
  const b = mockRes(); await handler(mockReq({ ...good, company_fax: 'spam' }), b); assert.equal(b.statusCode, 400);
  for (let i = 0; i < 5; i++) { const r = mockRes(); await handler(mockReq(good), r); assert.equal(r.statusCode, 201); }
  const c = mockRes(); await handler(mockReq(good), c); assert.equal(c.statusCode, 429);
});
