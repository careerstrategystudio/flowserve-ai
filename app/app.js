// Panel del dueño: Bandeja, Llamadas, Citas y Consumo.
// Lee de Supabase con la sesión del dueño (RLS). Las acciones (devolver llamada) van por /api/inbox/act.
// /app/?preview=1 enseña el panel con datos de ejemplo, sin cuentas (para ver el diseño).
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PREVIEW = new URLSearchParams(location.search).has('preview');
const TZ = 'Europe/Dublin';
const fmtWhen = (iso) => new Intl.DateTimeFormat('en-IE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  return fmtWhen(iso);
};
const toast = (t) => { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), 3500); };

let sb = null, session = null, bizList = [], biz = null, data = { inbox: [], calls: [], appts: [] };

/* ---------- datos ---------- */
const real = {
  async businesses() {
    const { data: m, error } = await sb.from('members').select('business_id');
    if (error) throw error;
    if (!m.length) return [];
    const { data: b, error: e2 } = await sb.from('businesses').select('id,slug,name,city,phone_e164,plan_minutes,is_demo').in('id', m.map((x) => x.business_id));
    if (e2) throw e2;
    return b;
  },
  async load(bizId) {
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
    const [inbox, calls, appts, month] = await Promise.all([
      sb.from('inbox_items').select('*').eq('business_id', bizId).order('created_at', { ascending: false }).limit(60),
      sb.from('calls').select('id,retell_call_id,direction,from_number,to_number,started_at,duration_s,caller_name,outcome,summary,sentiment,transcript,disconnection_reason').eq('business_id', bizId).order('started_at', { ascending: false, nullsFirst: false }).limit(60),
      sb.from('appointments').select('*').eq('business_id', bizId).gte('starts_at', new Date(Date.now() - 864e5).toISOString()).order('starts_at').limit(60),
      sb.from('calls').select('duration_s').eq('business_id', bizId).gte('started_at', since.toISOString()),
    ]);
    for (const r of [inbox, calls, appts, month]) if (r.error) throw r.error;
    return { inbox: inbox.data, calls: calls.data, appts: appts.data, monthSeconds: month.data.reduce((a, c) => a + (c.duration_s || 0), 0) };
  },
  async act(item_id, action, instruction) {
    const r = await fetch('/api/inbox/act', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ item_id, action, instruction }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Something went wrong');
    return j;
  },
};

const preview = (() => {
  const t = (min) => new Date(Date.now() - min * 60000).toISOString();
  const f = (days, h, m) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const db = {
    inbox: [
      { id: 'i1', kind: 'escalation', status: 'open', caller_name: 'Siobhán Kelly', caller_phone: '+353871234567', question: 'Can she bring her daughter (14) for a back massage at the same time?', summary: 'Wants two back massages together on Saturday morning. Asked about treating a 14-year-old.', created_at: t(12) },
      { id: 'i2', kind: 'message', status: 'open', caller_name: 'Ronan Byrne', caller_phone: '+353861112233', summary: 'Lost a gift voucher bought in July. Wants to know if it can be reissued.', urgency: 'normal', created_at: t(95) },
      { id: 'i3', kind: 'escalation', status: 'done', caller_name: 'Aisling Walsh', caller_phone: '+353851234999', question: 'Group booking for a hen party of 6?', owner_instruction: 'Yes, Saturday 3 Nov from 11am, €65 each, €100 deposit.', callback_result: 'Client accepted and asked for the payment link by email.', created_at: t(60 * 26) },
    ],
    calls: [
      { id: 'c1', direction: 'inbound', from_number: '+353871234567', started_at: t(12), duration_s: 154, caller_name: 'Siobhán Kelly', outcome: 'escalated', summary: 'Asked for two back massages on Saturday and whether a 14-year-old can be treated. Assistant asked the owner.', transcript: 'Agent: Hi, you\'re through to Halden Wellness Studio...\nUser: Hi, I was wondering...' },
      { id: 'c2', direction: 'inbound', from_number: '+353899876543', started_at: t(48), duration_s: 96, caller_name: 'Emma Doyle', outcome: 'booked', summary: 'Booked a Deep Tissue Massage for Thursday at 6pm.' },
      { id: 'c3', direction: 'inbound', from_number: '+353861112233', started_at: t(95), duration_s: 71, caller_name: 'Ronan Byrne', outcome: 'message', summary: 'Left a message about a lost gift voucher.' },
      { id: 'c4', direction: 'inbound', from_number: '+353857770001', started_at: t(60 * 5), duration_s: 64, caller_name: 'Cian Murphy', outcome: 'rescheduled', summary: 'Moved his Hot Stone Massage from Friday 2pm to Saturday 11am.' },
      { id: 'c5', direction: 'outbound', to_number: '+353851234999', started_at: t(60 * 25), duration_s: 118, caller_name: 'Aisling Walsh', outcome: 'info', summary: 'Call-back: passed on the owner\'s answer about the hen party. Client accepted.' },
    ],
    appts: [
      { id: 'a1', client_name: 'Emma Doyle', client_phone: '+353899876543', service_name: 'Deep Tissue Massage', starts_at: f(1, 18, 0), status: 'booked' },
      { id: 'a2', client_name: 'Cian Murphy', client_phone: '+353857770001', service_name: 'Hot Stone Massage', starts_at: f(2, 11, 0), status: 'booked' },
      { id: 'a3', client_name: 'Laura Quinn', client_phone: '+353830001112', service_name: 'Relaxation Massage', starts_at: f(3, 15, 30), status: 'cancelled' },
    ],
    monthSeconds: 187 * 60,
  };
  return {
    async businesses() { return [{ id: 'demo', name: 'Halden Wellness Studio (preview)', plan_minutes: 300, is_demo: true }]; },
    async load() { return structuredClone(db); },
    async act(id, action, instruction) {
      const it = db.inbox.find((x) => x.id === id);
      if (action === 'done') { it.status = 'done'; } else { it.status = 'calling'; it.owner_instruction = instruction; setTimeout(() => { it.status = 'done'; it.callback_result = 'Preview: the assistant called back and passed on your answer.'; refresh(); }, 2500); }
      return { ok: true };
    },
  };
})();
const api = () => (PREVIEW ? preview : real);

/* ---------- pintar ---------- */
const OUTCOME = { booked: ['ok', 'Booked'], rescheduled: ['pri', 'Moved'], cancelled: ['bad', 'Cancelled'], message: ['warn', 'Message'], escalated: ['warn', 'Needs you'], info: ['', 'Info'], spam: ['', 'Spam'], other: ['', 'Other'] };
const chip = (k) => { const [c, t] = OUTCOME[k] || ['', k || '—']; return `<span class="chip ${c}">${esc(t)}</span>`; };
const mins = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');

function renderKpis(d) {
  const open = d.inbox.filter((i) => i.status !== 'done').length;
  const today = new Date().toDateString();
  const callsToday = d.calls.filter((c) => c.started_at && new Date(c.started_at).toDateString() === today).length;
  const booked = d.calls.filter((c) => c.outcome === 'booked').length;
  const used = Math.round(d.monthSeconds / 60);
  $('#kpis').innerHTML = [
    ['Needs your reply', open], ['Calls today', callsToday], ['Booked by phone (recent)', booked], ['Minutes this month', `${used}/${biz.plan_minutes || 300}`],
  ].map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${esc(v)}</div></div>`).join('');
  const b = $('#badge'); b.hidden = !open; b.textContent = open;
}

function renderInbox(d) {
  const items = [...d.inbox].sort((a, b) => (a.status === 'done') - (b.status === 'done'));
  $('#tab-inbox').innerHTML = items.length ? items.map((i) => {
    const st = i.status === 'done' ? '<span class="chip ok">Done</span>' : i.status === 'calling' ? '<span class="chip pri">Calling back…</span>' : i.kind === 'escalation' ? '<span class="chip warn">Needs your decision</span>' : '<span class="chip warn">Message</span>';
    const action = i.status === 'open' ? `
      <div class="act">
        <textarea data-ins="${esc(i.id)}" placeholder="${i.kind === 'escalation' ? 'Write the answer in one sentence. The assistant will call them back and tell them.' : 'Optional: write a reply and the assistant will call them back.'}"></textarea>
        <div class="btns">
          <button class="pri" data-act="callback" data-id="${esc(i.id)}" ${i.caller_phone ? '' : 'disabled'}>Call them back with this</button>
          <button class="ghost" data-act="done" data-id="${esc(i.id)}">I'll handle it myself</button>
        </div>
      </div>` : '';
    return `<article class="item ${esc(i.status)} ${esc(i.kind)}">
      <div class="row"><span class="who">${esc(i.caller_name || 'Unknown caller')}</span><span class="mut small">${esc(i.caller_phone || 'no number')}</span>${st}<span class="when">${ago(i.created_at)}</span></div>
      ${i.question ? `<p class="q">${esc(i.question)}</p>` : ''}
      <p class="sum mut">${esc(i.summary || '')}</p>
      ${i.owner_instruction ? `<div class="res"><b>Your answer:</b> ${esc(i.owner_instruction)}</div>` : ''}
      ${i.callback_result ? `<div class="res"><b>Result:</b> ${esc(i.callback_result)}</div>` : ''}
      ${action}
    </article>`;
  }).join('') : '<div class="empty">Nothing needs you right now.</div>';
}

function renderCalls(d) {
  $('#tab-calls').innerHTML = d.calls.length ? d.calls.map((c) => `
    <article class="item">
      <div class="row"><span class="who">${esc(c.caller_name || c.from_number || c.to_number || 'Unknown')}</span>${chip(c.outcome)}<span class="chip">${c.direction === 'outbound' ? 'Call-back' : 'Incoming'}</span><span class="mut small">${mins(c.duration_s)}</span><span class="when">${c.started_at ? ago(c.started_at) : ''}</span></div>
      <p class="sum" style="margin-top:6px">${esc(c.summary || (c.disconnection_reason ? `Ended: ${c.disconnection_reason}` : 'Summary coming…'))}</p>
      ${c.transcript ? `<details><summary>Transcript</summary><pre class="tr">${esc(c.transcript)}</pre></details>` : ''}
    </article>`).join('') : '<div class="empty">No calls yet. Call your FlowServe number to try it.</div>';
}

function renderBookings(d) {
  $('#tab-bookings').innerHTML = `<p class="mut small" style="margin-bottom:10px">Bookings made or changed by the assistant. Your Google Calendar is always the master copy.</p>` + (d.appts.length ? d.appts.map((a) => `
    <article class="item"><div class="row"><span class="who">${esc(fmtWhen(a.starts_at))}</span><span>${esc(a.service_name || '')}</span>${a.status === 'cancelled' ? '<span class="chip bad">Cancelled</span>' : '<span class="chip ok">Booked</span>'}<span class="when">${esc(a.client_name)} · ${esc(a.client_phone || '')}</span></div></article>`).join('') : '<div class="empty">No bookings by phone yet.</div>');
}

function renderUsage(d) {
  const used = Math.round(d.monthSeconds / 60), plan = biz.plan_minutes || 300, pct = Math.min(100, Math.round((used / plan) * 100));
  $('#tab-usage').innerHTML = `<div class="card">
    <h3 style="color:var(--t1)">Call minutes this month</h3>
    <div class="bar"><i class="${pct >= 80 ? 'hot' : ''}" style="width:${pct}%"></i></div>
    <p><b style="color:var(--t1)">${used}</b> of ${plan} minutes used (${pct}%).</p>
    <p class="mut small" style="margin-top:6px">${pct >= 80 ? 'You are close to your plan. Extra minutes are added as a top-up. We will let you know before anything is charged.' : 'Includes incoming calls and call-backs.'}</p></div>`;
}

function render() { renderKpis(data); renderInbox(data); renderCalls(data); renderBookings(data); renderUsage(data); }

async function refresh() {
  if (!biz) return;
  try { data = await api().load(biz.id); render(); } catch (e) { console.error(e); toast('Could not load the latest data.'); }
}

/* ---------- eventos ---------- */
document.addEventListener('click', async (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b === tab));
    document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== `tab-${tab.dataset.tab}`; });
    return;
  }
  const btn = e.target.closest('[data-act]');
  if (btn) {
    const id = btn.dataset.id, action = btn.dataset.act;
    const ins = document.querySelector(`[data-ins="${CSS.escape(id)}"]`)?.value.trim() || '';
    if (action === 'callback' && !ins) { toast('Write what the assistant should tell them first.'); return; }
    btn.disabled = true;
    try { await api().act(id, action, ins); toast(action === 'callback' ? 'Calling them back now.' : 'Marked as done.'); await refresh(); }
    catch (err) { toast(err.message); btn.disabled = false; }
  }
});
$('#biz').addEventListener('change', () => { biz = bizList.find((b) => b.id === $('#biz').value); refresh(); });
$('#signout').addEventListener('click', async () => { if (sb) await sb.auth.signOut(); location.reload(); });

/* ---------- arranque ---------- */
function show(id) { for (const s of ['login', 'dash', 'setup']) $(`#${s}`).hidden = s !== id; }

async function enterDashboard() {
  bizList = await api().businesses();
  if (!bizList.length) { show('setup'); $('#setup-msg').textContent = 'Your account is not linked to a business yet. Send us the email you signed in with and we will connect it.'; $('#signout').hidden = PREVIEW; return; }
  biz = bizList[0];
  if (bizList.length > 1) { $('#biz').hidden = false; $('#biz').innerHTML = bizList.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join(''); }
  $('#signout').hidden = PREVIEW;
  if (PREVIEW) $('#kpis').insertAdjacentHTML('beforebegin', '<p class="card small" style="margin-bottom:12px;border-color:rgba(251,191,36,.4)"><b style="color:var(--warn)">Preview</b> · sample data, nothing is real or sent.</p>');
  show('dash');
  await refresh();
  setInterval(refresh, 20000);
}

async function boot() {
  if (PREVIEW) return enterDashboard();
  const cfg = await fetch('/api/public-config').then((r) => r.json()).catch(() => null);
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) { show('setup'); $('#setup-msg').textContent = 'The dashboard is not connected yet (Supabase keys missing in Vercel). Open /app/?preview=1 to see how it will look.'; return; }
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  session = (await sb.auth.getSession()).data.session;
  sb.auth.onAuthStateChange((_e, s) => { const was = !!session; session = s; if (s && !was) enterDashboard(); });
  if (session) return enterDashboard();
  show('login');
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim();
    $('#login-msg').textContent = 'Sending…';
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/app/`, shouldCreateUser: true } });
    $('#login-msg').textContent = error ? `Could not send the link: ${error.message}` : 'Check your email and tap the link to sign in.';
  });
}
boot();
