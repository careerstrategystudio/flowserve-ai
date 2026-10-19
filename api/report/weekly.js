// GET /api/report/weekly — informe semanal de Front Desk.
// - Lo llama Vercel Cron los lunes (cabecera Authorization: Bearer CRON_SECRET) y envía a cada negocio activo.
// - A mano: ?key=ADMIN_SECRET&biz=slug&preview=1 enseña el email en el navegador sin enviarlo.
//           ?key=ADMIN_SECRET&biz=slug&to=email lo envía solo a ese email (prueba).
// No envía dos veces el mismo informe: lo apunta en weekly_reports (business_id + semana).
import { db, q } from '../../lib/db.js';
import { sendMail } from '../../lib/mail.js';
import { send, safeEqual } from '../../lib/util.js';
import { lastWeek, loadWeek, computeStats, renderReport } from '../../lib/report.js';

const panelUrl = () => `${(process.env.PUBLIC_BASE_URL || 'https://flowserve-ai.vercel.app').replace(/\/$/, '')}/app/`;

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = Object.fromEntries(url.searchParams);
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const isCron = !!process.env.CRON_SECRET && safeEqual(bearer, process.env.CRON_SECRET);
  const isAdmin = !!process.env.ADMIN_SECRET && safeEqual(p.key || '', process.env.ADMIN_SECRET);
  if (!isCron && !isAdmin) return send(res, 401, { error: 'unauthorized' });

  try {
    const now = p.now ? new Date(p.now) : new Date();
    const filter = p.biz ? `slug=eq.${q(p.biz)}` : 'active=is.true&is_demo=is.false&weekly_report=is.true';
    const list = await db.select('businesses', `${filter}&select=id,slug,name,timezone,hours,services,plan_minutes,owner_email,is_demo`);
    if (!list.length) return send(res, 404, { error: 'no_business' });

    if (p.preview) {
      const biz = list[0]; const week = lastWeek(biz.timezone || 'Europe/Dublin', now);
      const stats = computeStats(biz, await loadWeek(db, q, biz, week));
      const { html } = renderReport(biz, week, stats, panelUrl());
      res.statusCode = 200; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
      return res.end(`<!doctype html><meta charset="utf-8"><title>Weekly report preview</title><body style="background:#f8fafc;padding:24px">${html}</body>`);
    }

    const results = [];
    for (const biz of list) {
      const to = p.to || biz.owner_email;
      if (!to || /CAMBIA_ESTO/.test(to)) { results.push({ slug: biz.slug, skipped: 'no_email' }); continue; }
      const week = lastWeek(biz.timezone || 'Europe/Dublin', now);
      if (!p.to) {
        const done = await db.select('weekly_reports', `business_id=eq.${biz.id}&week_start=eq.${week.startISO}&select=id`);
        if (done.length) { results.push({ slug: biz.slug, skipped: 'already_sent' }); continue; }
      }
      const stats = computeStats(biz, await loadWeek(db, q, biz, week));
      const { subject, html } = renderReport(biz, week, stats, panelUrl());
      const r = await sendMail({ to, subject, html });
      if (r.ok && !p.to) await db.insert('weekly_reports', { business_id: biz.id, week_start: week.startISO, sent_to: to, stats });
      results.push({ slug: biz.slug, to, sent: !!r.ok, skipped: r.skipped ? 'mail_not_configured' : undefined, calls: stats.callsAnswered, bookings: stats.bookingsMade });
    }
    return send(res, 200, { ok: true, results });
  } catch (e) {
    console.error('[weekly report]', e.message);
    return send(res, 500, { error: 'report_failed' });
  }
}
