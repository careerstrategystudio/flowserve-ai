// POST /api/social/enquiry — guarda una solicitud de FlowServe Social.
// Solo responde 201 cuando la fila queda guardada en Supabase. Si falta configuración, responde 503 y la web
// ofrece el email como alternativa: nunca se muestra un "enviado" que no se haya guardado.
import crypto from 'node:crypto';
import { db, q } from '../../lib/db.js';
import { sendMail } from '../../lib/mail.js';
import { readJson, send, esc } from '../../lib/util.js';
import { FORM_OPTIONS, packageById, addonById, quote } from '../../social-media/pricing.js';

const PER_IP_DAILY = 5;
const allowed = (key) => FORM_OPTIONS[key].map(([v]) => v);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanUrl(v, hostHint) {
  const s = String(v || '').trim();
  if (!s) return null;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return undefined; }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return undefined;
  if (hostHint && !hostHint.test(u.hostname)) return undefined;
  return u.toString().slice(0, 300);
}

/** Valida el formulario. Devuelve { data } o { errors: { campo: código } }. */
export function validate(b) {
  const errors = {};
  const str = (k, max) => String(b[k] ?? '').trim().slice(0, max);
  const data = {
    business_name: str('business_name', 120),
    contact_name: str('contact_name', 120),
    email: str('email', 200).toLowerCase(),
    website_url: cleanUrl(b.website_url),
    instagram_url: cleanUrl(b.instagram_url, /(^|\.)instagram\.com$/i),
    facebook_url: cleanUrl(b.facebook_url, /(^|\.)(facebook|fb)\.com$/i),
    category: str('category', 40),
    package_id: str('package_id', 40),
    addons: Array.isArray(b.addons) ? [...new Set(b.addons.map(String))].filter((a) => addonById(a)) : [],
    objective: str('objective', 40),
    language: str('language', 4),
    posting_frequency: str('posting_frequency', 40),
    can_supply_media: str('can_supply_media', 10),
    requirements: str('requirements', 2000) || null,
    consent: b.consent === true || b.consent === 'on' || b.consent === 'true',
  };
  if (data.business_name.length < 2) errors.business_name = 'required';
  if (data.contact_name.length < 2) errors.contact_name = 'required';
  if (!EMAIL_RE.test(data.email)) errors.email = 'email';
  for (const k of ['website_url', 'instagram_url', 'facebook_url']) if (data[k] === undefined) errors[k] = 'url';
  if (!allowed('category').includes(data.category)) errors.category = 'required';
  if (data.package_id !== 'undecided' && !packageById(data.package_id)) errors.package_id = 'required';
  if (!allowed('objective').includes(data.objective)) errors.objective = 'required';
  if (!allowed('language').includes(data.language)) errors.language = 'required';
  if (!allowed('frequency').includes(data.posting_frequency)) errors.posting_frequency = 'required';
  if (!allowed('media').includes(data.can_supply_media)) errors.can_supply_media = 'required';
  if (!data.consent) errors.consent = 'consent';
  return Object.keys(errors).length ? { errors } : { data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const origin = String(req.headers.origin || '');
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (origin && base && origin !== base && !origin.endsWith('.vercel.app')) return send(res, 403, { error: 'not_allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return send(res, 503, { error: 'not_configured' });

  const body = await readJson(req);
  if (body.company_fax) return send(res, 400, { error: 'invalid' }); // campo trampa para bots
  const { data, errors } = validate(body);
  if (errors) return send(res, 422, { error: 'validation', fields: errors });

  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const ipHash = crypto.createHash('sha256').update(`${ip}|${process.env.TOOL_SECRET || 'fs'}`).digest('hex').slice(0, 32);
    const since = new Date(Date.now() - 864e5).toISOString();
    const recent = await db.select('social_enquiries', `created_at=gte.${q(since)}&ip_hash=eq.${ipHash}&select=id`);
    if (recent.length >= PER_IP_DAILY) return send(res, 429, { error: 'rate_limited' });

    const qt = data.package_id === 'undecided' ? null : quote(data.package_id, data.addons);
    const { consent, ...row } = data;
    const saved = await db.insert('social_enquiries', {
      ...row, ip_hash: ipHash, consent_at: new Date().toISOString(),
      quoted_monthly_eur: qt ? qt.total : null, quoted_from: qt ? qt.from : null,
    });

    // Aviso interno opcional (solo si hay RESEND_API_KEY y SOCIAL_NOTIFY_EMAIL). No afecta a la respuesta.
    const to = process.env.SOCIAL_NOTIFY_EMAIL;
    if (to) {
      const rows = Object.entries({ ...row, quote: qt ? `${qt.from ? 'from ' : ''}€${qt.total}/month` : 'undecided' })
        .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
        .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${esc(k)}</td><td>${esc(Array.isArray(v) ? v.join(', ') : v)}</td></tr>`).join('');
      await sendMail({ to, subject: `FlowServe Social enquiry: ${data.business_name}`, html: `<table style="font-family:sans-serif;font-size:14px">${rows}</table>` })
        .catch((e) => console.error('[social mail]', e.message));
    }
    return send(res, 201, { ok: true, id: saved?.id ?? null });
  } catch (e) {
    console.error('[social enquiry]', e.message);
    return send(res, 500, { error: 'save_failed' });
  }
}
