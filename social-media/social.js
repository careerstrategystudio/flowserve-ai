// FlowServe Social — página /social-media/: tarjetas de precios, configurador, calendario de ejemplo y formulario.
// Todo el contenido dinámico sale de pricing.js y se vuelve a pintar al cambiar de idioma (evento flowserve:lang).
import { SOCIAL_PACKAGES, AUTOMATION_ADDONS, PACKAGE_TERMS, FORM_OPTIONS, VAT_NOTE, quote, packageById } from './pricing.js';

const FALLBACK_EMAIL = 'javierignacioayala@gmail.com'; // el mismo contacto que ya aparece en la web

const T = {
  en: {
    perMonth: 'per month, excl. VAT', from: 'From', popular: 'Most popular', choose: 'Choose', choosePkg: (n) => `Choose ${n}`,
    socialPkg: 'Social package', none: 'No social package', addFd: (p) => `Add FlowServe Front Desk (€${p}/month)`, breakdown: 'Monthly breakdown',
    total: 'Total per month', totalFrom: 'Total per month, from', noDiscount: 'No bundle discount applies.', discount: 'Discount',
    continue: 'Continue with this selection', pickOne: 'Choose a social package to see the total.', fdOnly: 'Front Desk on its own? See the Front Desk plan',
    // calendario y posts de ejemplo
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], post: 'Post', story: 'Stories', reel: 'Reel',
    theme: 'Theme', caption: 'Caption', visual: 'Suggested visual', platform: 'Platform', date: 'Publication date', status: 'Status',
    st: { draft: 'Draft', awaiting: 'Awaiting approval', approved: 'Approved' }, demo: 'Demo',
    // formulario
    f: {
      business_name: 'Business name', contact_name: 'Your name', email: 'Business email', website_url: 'Website', instagram_url: 'Instagram profile', facebook_url: 'Facebook Page',
      category: 'Business category', package_id: 'Package', objective: 'Main objective', language: 'Preferred language', posting_frequency: 'How often do you post now?',
      can_supply_media: 'Can you supply photos and videos?', requirements: 'Anything else we should know?', addons: 'Also interested in FlowServe Front Desk (€249/month)',
      optional: 'optional', choose: 'Choose…', undecided: 'Not sure yet — recommend one',
      consent: 'I agree that FlowServe stores these details to reply to my enquiry, as described in the', privacy: 'privacy policy',
      consentNote: 'We only use this to reply to you. No newsletters, and we don’t share it.',
      submit: 'Send my enquiry', sending: 'Sending…',
      errSummary: 'Please fix the highlighted fields.',
      err: { required: 'This field is required.', email: 'Enter a valid email address, like name@business.ie.', url: 'Enter a valid link, or leave it empty.', consent: 'Please accept so we can reply to you.' },
      hintIg: 'e.g. instagram.com/yourbusiness', hintFb: 'e.g. facebook.com/yourbusiness',
      okH: 'Thanks — your enquiry has been received.', okP: 'We’ll review your profiles and reply to', okP2: 'within two working days.', again: 'Send another enquiry',
      failH: 'We couldn’t send your enquiry.', failP: 'Nothing was saved. Please try again in a minute, or email us your details directly:',
      failMail: 'Email us your enquiry', busy: 'Too many enquiries from this connection today. Please email us instead:',
    },
  },
  es: {
    perMonth: 'al mes, sin IVA', from: 'Desde', popular: 'Más elegido', choose: 'Elegir', choosePkg: (n) => `Elegir ${n}`,
    socialPkg: 'Paquete de redes', none: 'Sin paquete de redes', addFd: (p) => `Sumar FlowServe Front Desk (€${p}/mes)`, breakdown: 'Desglose mensual',
    total: 'Total al mes', totalFrom: 'Total al mes, desde', noDiscount: 'No se aplica ningún descuento por combinar.', discount: 'Descuento',
    continue: 'Seguir con esta selección', pickOne: 'Elige un paquete de redes para ver el total.', fdOnly: '¿Solo Front Desk? Mira el plan Front Desk',
    days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], post: 'Post', story: 'Stories', reel: 'Reel',
    theme: 'Tema', caption: 'Texto', visual: 'Visual sugerido', platform: 'Plataforma', date: 'Fecha de publicación', status: 'Estado',
    st: { draft: 'Borrador', awaiting: 'Pendiente de aprobar', approved: 'Aprobado' }, demo: 'Demo',
    f: {
      business_name: 'Nombre del negocio', contact_name: 'Tu nombre', email: 'Email del negocio', website_url: 'Web', instagram_url: 'Perfil de Instagram', facebook_url: 'Página de Facebook',
      category: 'Tipo de negocio', package_id: 'Paquete', objective: 'Objetivo principal', language: 'Idioma preferido', posting_frequency: '¿Cada cuánto publicas ahora?',
      can_supply_media: '¿Puedes aportar fotos y vídeos?', requirements: '¿Algo más que debamos saber?', addons: 'También me interesa FlowServe Front Desk (€249/mes)',
      optional: 'opcional', choose: 'Elige…', undecided: 'Aún no lo sé — recomiéndame uno',
      consent: 'Acepto que FlowServe guarde estos datos para responder a mi consulta, según la', privacy: 'política de privacidad',
      consentNote: 'Solo lo usamos para responderte. Sin newsletters, y no lo compartimos.',
      submit: 'Enviar mi consulta', sending: 'Enviando…',
      errSummary: 'Revisa los campos marcados.',
      err: { required: 'Este campo es obligatorio.', email: 'Escribe un email válido, como nombre@negocio.ie.', url: 'Escribe un enlace válido o déjalo vacío.', consent: 'Acéptalo para que podamos responderte.' },
      hintIg: 'p. ej. instagram.com/tunegocio', hintFb: 'p. ej. facebook.com/tunegocio',
      okH: 'Gracias — hemos recibido tu consulta.', okP: 'Revisaremos tus perfiles y te responderemos a', okP2: 'en dos días laborables.', again: 'Enviar otra consulta',
      failH: 'No pudimos enviar tu consulta.', failP: 'No se ha guardado nada. Inténtalo en un minuto o mándanos tus datos por email:',
      failMail: 'Mándanos tu consulta por email', busy: 'Demasiadas consultas desde esta conexión hoy. Escríbenos por email:',
    },
  },
};

const lang = () => (document.documentElement.lang === 'es' ? 'es' : 'en');
const L = () => T[lang()];
const tx = (o) => (o && typeof o === 'object' ? o[lang()] ?? o.en : o);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => `€${Number(n).toLocaleString(lang() === 'es' ? 'es-IE' : 'en-IE')}`;
const $ = (s, r = document) => r.querySelector(s);

const state = { pkg: 'social-growth', fd: false };

/* ---------- Tarjetas de precios ---------- */
function renderPlans() {
  const el = $('#sm-plans'); if (!el) return;
  el.innerHTML = SOCIAL_PACKAGES.map((p) => `
    <article class="price-card ${p.popular ? 'featured-plan' : ''}" aria-labelledby="pl-${p.id}">
      ${p.popular ? `<span class="plan-badge">${L().popular}</span>` : ''}
      <h3 id="pl-${p.id}">${esc(p.name)}</h3>
      <span class="tier-size">${esc(tx(p.audience))}</span>
      <div class="price">${p.from ? `<span class="sm-from">${L().from}</span> ` : ''}${eur(p.price)}</div>
      <span class="price-period">${L().perMonth}</span>
      <div class="price-features">${p.features.map((f) => `<span class="check">${esc(tx(f))}</span>`).join('')}</div>
      <a href="#enquiry" class="${p.popular ? 'btn-primary' : 'btn-secondary'}" data-pick="${p.id}">${esc(L().choosePkg(p.name))}</a>
    </article>`).join('');
  $('#sm-terms').innerHTML = PACKAGE_TERMS.map((t) => `<li>${esc(tx(t))}</li>`).join('') + `<li>${esc(tx(VAT_NOTE))}</li>`;
}

/* ---------- Configurador con desglose ---------- */
function renderBuilder() {
  const el = $('#sm-builder-ui'); if (!el) return;
  const fd = AUTOMATION_ADDONS[0];
  const opts = [...SOCIAL_PACKAGES.map((p) => [p.id, `${p.name} — ${p.from ? `${L().from.toLowerCase()} ` : ''}${eur(p.price)}`]), ['', L().none]];
  el.innerHTML = `
    <div class="sm-builder-grid">
      <fieldset class="sm-radios"><legend>${L().socialPkg}</legend>
        ${opts.map(([v, label]) => `<label class="sm-radio"><input type="radio" name="b-pkg" value="${v}" ${state.pkg === v ? 'checked' : ''}> <span>${esc(label)}</span></label>`).join('')}
        <label class="sm-check"><input type="checkbox" id="b-fd" ${state.fd ? 'checked' : ''}> <span>${esc(L().addFd(fd.price))}</span></label>
      </fieldset>
      <div class="sm-breakdown" aria-live="polite" id="b-out"></div>
    </div>`;
  el.querySelectorAll('input[name="b-pkg"]').forEach((r) => r.addEventListener('change', () => { state.pkg = r.value; renderBreakdown(); }));
  $('#b-fd').addEventListener('change', (e) => { state.fd = e.target.checked; renderBreakdown(); });
  renderBreakdown();
}
function renderBreakdown() {
  const out = $('#b-out'); if (!out) return;
  const fd = AUTOMATION_ADDONS[0];
  if (!state.pkg) {
    out.innerHTML = state.fd
      ? `<p class="sm-muted">${esc(L().pickOne)}</p><a class="btn-secondary" href="${fd.href}">${esc(L().fdOnly)}</a>`
      : `<p class="sm-muted">${esc(L().pickOne)}</p>`;
    return;
  }
  const qt = quote(state.pkg, state.fd ? [fd.id] : []);
  out.innerHTML = `
    <h4>${L().breakdown}</h4>
    <dl class="sm-lines">${qt.lines.map((l) => `<div><dt>${esc(l.name)}</dt><dd>${l.from ? `${L().from} ` : ''}${eur(l.price)}</dd></div>`).join('')}
    ${qt.discounts.map((d) => `<div class="disc"><dt>${L().discount}: ${esc(tx(d.label))}</dt><dd>−${eur(d.amount)}</dd></div>`).join('')}</dl>
    <div class="sm-total"><span>${qt.from ? L().totalFrom : L().total}</span><b>${eur(qt.total)}</b></div>
    <p class="sm-small">${qt.discounts.length ? '' : esc(L().noDiscount) + ' '}${esc(tx(VAT_NOTE))}</p>
    <a href="#enquiry" class="btn-primary" data-pick="${state.pkg}" data-fd="${state.fd ? 1 : 0}">${esc(L().continue)}</a>`;
}

/* ---------- Calendario y publicaciones de ejemplo (ficticios) ---------- */
const SAMPLE_MONTH = { y: 2026, m: 10 }; // noviembre 2026 (mes 0-index)
const CAL = [
  [3, 'post', { en: 'Meet your therapist', es: 'Conoce a tu terapeuta' }, 'IG · FB'],
  [6, 'story', { en: 'Free slots this weekend', es: 'Huecos libres este finde' }, 'IG'],
  [10, 'post', { en: 'Hot stone is back', es: 'Vuelven las piedras' }, 'IG · FB'],
  [13, 'reel', { en: 'Behind the scenes', es: 'Detrás de cámaras' }, 'IG'],
  [17, 'post', { en: 'Desk-neck tips', es: 'Consejos cuello de oficina' }, 'IG · FB'],
  [20, 'story', { en: 'Client question', es: 'Pregunta de cliente' }, 'IG'],
  [24, 'post', { en: 'Gift vouchers', es: 'Bonos regalo' }, 'IG · FB'],
  [27, 'post', { en: 'December dates', es: 'Fechas de diciembre' }, 'IG · FB'],
];
const POSTS = [
  { day: 10, status: 'approved', platform: 'Instagram · Facebook', tone: 'sage',
    theme: { en: 'Seasonal treatment', es: 'Tratamiento de temporada' },
    caption: { en: 'Cooler evenings, warmer stones. Our 75-minute hot stone massage is back for autumn. Book through the link in bio.', es: 'Tardes más frías, piedras más cálidas. Vuelve nuestro masaje de 75 minutos con piedras calientes. Reserva en el enlace de la bio.' },
    visual: { en: 'Close-up of basalt stones on a warm towel, studio colours', es: 'Primer plano de piedras de basalto sobre una toalla, colores del estudio' } },
  { day: 17, status: 'awaiting', platform: 'Instagram · Facebook', tone: 'sand',
    theme: { en: 'Helpful tip', es: 'Consejo útil' },
    caption: { en: 'Working at a desk all day? Three two-minute stretches for your neck and shoulders, from our therapists.', es: '¿Todo el día en el escritorio? Tres estiramientos de dos minutos para cuello y hombros, de nuestras terapeutas.' },
    visual: { en: 'Carousel: 3 simple illustrated stretches', es: 'Carrusel: 3 estiramientos ilustrados sencillos' } },
  { day: 24, status: 'draft', platform: 'Instagram · Facebook', tone: 'rose',
    theme: { en: 'Gift vouchers', es: 'Bonos regalo' },
    caption: { en: 'The gift that actually gets used. Massage vouchers from €45, sent by email in minutes.', es: 'El regalo que sí se usa. Bonos de masaje desde €45, enviados por email en minutos.' },
    visual: { en: 'Branded voucher card on a gift-wrapped box', es: 'Tarjeta regalo con la marca sobre una caja envuelta' } },
  { day: 13, status: 'approved', platform: 'Instagram', tone: 'ink',
    theme: { en: 'Reel · behind the scenes', es: 'Reel · detrás de cámaras' },
    caption: { en: 'What happens before you arrive: fresh linen, warm oils, quiet music. 15 seconds of calm.', es: 'Lo que pasa antes de que llegues: sábanas limpias, aceites templados, música suave. 15 segundos de calma.' },
    visual: { en: 'Client-filmed clips of the room being prepared', es: 'Clips grabados por el negocio preparando la cabina' } },
];
function renderCalendar() {
  const el = $('#sm-calendar'); if (!el) return;
  const { y, m } = SAMPLE_MONTH;
  const first = new Date(Date.UTC(y, m, 1)); const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const title = first.toLocaleDateString(lang() === 'es' ? 'es-ES' : 'en-IE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const byDay = Object.fromEntries(CAL.map((c) => [c[0], c]));
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="sm-day empty" aria-hidden="true"></div>';
  for (let d = 1; d <= days; d++) {
    const c = byDay[d];
    cells += `<div class="sm-day${c ? ' has' : ''}"><span class="n">${d}</span>${c ? `<span class="sm-chip ${c[1]}">${L()[c[1]]}</span><span class="t">${esc(tx(c[2]))}</span><span class="p">${c[3]}</span>` : ''}</div>`;
  }
  el.innerHTML = `<div class="sm-cal-h"><b>${esc(title.charAt(0).toUpperCase() + title.slice(1))}</b><span class="sm-badge-demo">${L().demo}</span></div>
    <div class="sm-cal-grid" role="list">${L().days.map((d) => `<div class="sm-dow" aria-hidden="true">${d}</div>`).join('')}${cells}</div>`;
}
function renderPosts() {
  const el = $('#sm-posts'); if (!el) return;
  const fmt = (d) => new Date(Date.UTC(SAMPLE_MONTH.y, SAMPLE_MONTH.m, d)).toLocaleDateString(lang() === 'es' ? 'es-ES' : 'en-IE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  el.innerHTML = POSTS.map((p) => `
    <article class="sm-post">
      <div class="sm-visual sm-tile--${p.tone}" role="img" aria-label="${esc(L().visual)}: ${esc(tx(p.visual))}"><span class="sm-badge-demo">${L().demo}</span><small>${esc(tx(p.visual))}</small></div>
      <div class="sm-post-b">
        <div class="sm-post-top"><span class="sm-status ${p.status}">${L().st[p.status]}</span><span class="sm-muted">${esc(fmt(p.day))}</span></div>
        <dl>
          <dt>${L().theme}</dt><dd>${esc(tx(p.theme))}</dd>
          <dt>${L().caption}</dt><dd>${esc(tx(p.caption))}</dd>
          <dt>${L().platform}</dt><dd>${esc(p.platform)}</dd>
        </dl>
      </div>
    </article>`).join('');
}

/* ---------- Formulario ---------- */
const FIELDS = [
  ['business_name', 'text', true, { autocomplete: 'organization' }],
  ['contact_name', 'text', true, { autocomplete: 'name' }],
  ['email', 'email', true, { autocomplete: 'email' }],
  ['website_url', 'url', false, { autocomplete: 'url', placeholder: 'https://' }],
  ['instagram_url', 'url', false, { hint: 'hintIg' }],
  ['facebook_url', 'url', false, { hint: 'hintFb' }],
  ['category', 'select', true, { options: 'category' }],
  ['package_id', 'select', true, { options: 'package' }],
  ['objective', 'select', true, { options: 'objective' }],
  ['language', 'select', true, { options: 'language' }],
  ['posting_frequency', 'select', true, { options: 'frequency' }],
  ['can_supply_media', 'select', true, { options: 'media' }],
  ['requirements', 'textarea', false, {}],
];
function optionsFor(kind) {
  if (kind === 'package') return [...SOCIAL_PACKAGES.map((p) => [p.id, `${p.name} — ${p.from ? `${L().from.toLowerCase()} ` : ''}${eur(p.price)}/${lang() === 'es' ? 'mes' : 'month'}`]), ['undecided', L().f.undecided]];
  return FORM_OPTIONS[kind].map(([v, label]) => [v, tx(label)]);
}
function renderForm() {
  const root = $('#sm-form-root'); if (!root) return;
  const F = L().f;
  const prev = root.querySelector('form') ? Object.fromEntries(new FormData(root.querySelector('form'))) : null;
  const prevFd = root.querySelector('#f-addons')?.checked;
  const done = root.dataset.done;
  if (done) { renderDone(done); return; }
  root.innerHTML = `
  <form class="sm-form" novalidate>
    <div class="sm-err-summary" role="alert" tabindex="-1" hidden></div>
    <div class="sm-form-grid">
      ${FIELDS.map(([name, type, req, o]) => {
        const id = `f-${name}`; const hint = o.hint ? `<small class="sm-hint" id="${id}-hint">${F[o.hint]}</small>` : '';
        const label = `<label for="${id}">${F[name]}${req ? ' <span aria-hidden="true" class="req">*</span>' : ` <span class="opt">(${F.optional})</span>`}</label>`;
        const common = `id="${id}" name="${name}" ${req ? 'required aria-required="true"' : ''} aria-describedby="${o.hint ? `${id}-hint ` : ''}${id}-err"`;
        let input;
        if (type === 'select') input = `<select ${common}><option value="">${F.choose}</option>${optionsFor(o.options).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>`;
        else if (type === 'textarea') input = `<textarea ${common} rows="4" maxlength="2000"></textarea>`;
        else input = `<input ${common} type="${type === 'url' ? 'text' : type}" inputmode="${type === 'url' ? 'url' : type === 'email' ? 'email' : 'text'}" ${o.autocomplete ? `autocomplete="${o.autocomplete}"` : ''} ${o.placeholder ? `placeholder="${o.placeholder}"` : ''} maxlength="${name === 'email' ? 200 : 300}">`;
        return `<div class="sm-field ${type === 'textarea' ? 'wide' : ''}">${label}${hint}${input}<span class="sm-err" id="${id}-err"></span></div>`;
      }).join('')}
      <div class="sm-field wide"><label class="sm-check"><input type="checkbox" id="f-addons" name="addons_fd"> <span>${F.addons}</span></label></div>
      <div class="sm-hp" aria-hidden="true"><label for="f-company_fax">Fax</label><input id="f-company_fax" name="company_fax" tabindex="-1" autocomplete="off"></div>
      <div class="sm-field wide">
        <label class="sm-check"><input type="checkbox" id="f-consent" name="consent" required aria-describedby="f-consent-err f-consent-note"> <span>${F.consent} <a href="/privacy/">${F.privacy}</a>. <span class="req" aria-hidden="true">*</span></span></label>
        <small class="sm-hint" id="f-consent-note">${F.consentNote}</small>
        <span class="sm-err" id="f-consent-err"></span>
      </div>
    </div>
    <div class="sm-total-line" id="f-quote" aria-live="polite"></div>
    <button type="submit" class="btn-primary sm-submit">${F.submit}</button>
    <div class="sm-fail" role="alert" hidden></div>
  </form>`;
  const form = root.querySelector('form');
  if (prev) { for (const [k, v] of Object.entries(prev)) { const f = form.elements[k]; if (f && f.type !== 'checkbox') f.value = v; } form.elements.consent.checked = prev.consent === 'on'; }
  else { form.elements.language.value = lang(); form.elements.package_id.value = state.pkg || ''; }
  $('#f-addons').checked = prev ? !!prevFd : state.fd;
  form.addEventListener('submit', onSubmit);
  form.addEventListener('change', updateFormQuote);
  form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') setErr(e.target.name, ''); });
  updateFormQuote();
}
function updateFormQuote() {
  const form = $('#sm-form-root form'); if (!form) return;
  const pkg = form.elements.package_id.value; const fd = $('#f-addons').checked;
  const out = $('#f-quote');
  if (!packageById(pkg)) { out.textContent = ''; return; }
  const qt = quote(pkg, fd ? ['front-desk'] : []);
  out.innerHTML = `${qt.lines.map((l) => `${esc(l.name)} ${l.from ? `${L().from.toLowerCase()} ` : ''}${eur(l.price)}`).join(' + ')} = <b>${qt.from ? `${L().from.toLowerCase()} ` : ''}${eur(qt.total)}</b> ${lang() === 'es' ? 'al mes' : 'per month'} · ${esc(tx(VAT_NOTE))}`;
}
function setErr(name, code) {
  const F = L().f; const field = name === 'consent' ? $('#f-consent') : $(`#f-${name}`); const span = $(`#f-${name}-err`);
  if (!field || !span) return;
  span.textContent = code ? F.err[code] || F.err.required : '';
  if (code) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
}
function clientValidate(data) {
  const errors = {};
  if ((data.business_name || '').trim().length < 2) errors.business_name = 'required';
  if ((data.contact_name || '').trim().length < 2) errors.contact_name = 'required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((data.email || '').trim())) errors.email = 'email';
  const urlOk = (v, re) => { if (!v.trim()) return true; try { const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); return u.hostname.includes('.') && (!re || re.test(u.hostname)); } catch { return false; } };
  if (!urlOk(data.website_url || '')) errors.website_url = 'url';
  if (!urlOk(data.instagram_url || '', /(^|\.)instagram\.com$/i)) errors.instagram_url = 'url';
  if (!urlOk(data.facebook_url || '', /(^|\.)(facebook|fb)\.com$/i)) errors.facebook_url = 'url';
  for (const k of ['category', 'package_id', 'objective', 'language', 'posting_frequency', 'can_supply_media']) if (!data[k]) errors[k] = 'required';
  if (!data.consent) errors.consent = 'consent';
  return errors;
}
function showErrors(errors) {
  const form = $('#sm-form-root form'); const F = L().f;
  ['business_name', 'contact_name', 'email', 'website_url', 'instagram_url', 'facebook_url', 'category', 'package_id', 'objective', 'language', 'posting_frequency', 'can_supply_media', 'consent'].forEach((k) => setErr(k, errors[k] || ''));
  const sum = form.querySelector('.sm-err-summary');
  const keys = Object.keys(errors);
  if (!keys.length) { sum.hidden = true; return; }
  sum.hidden = false;
  sum.innerHTML = `<b>${F.errSummary}</b><ul>${keys.map((k) => `<li><a href="#f-${k}">${esc(k === 'consent' ? F.privacy : F[k])}</a></li>`).join('')}</ul>`;
  const first = k => (k === 'consent' ? $('#f-consent') : $(`#f-${k}`));
  (first(keys[0]) || sum).focus();
}
function mailtoFor(data) {
  const body = Object.entries(data).filter(([k, v]) => v && !['consent', 'company_fax'].includes(k)).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent('FlowServe Social enquiry')}&body=${encodeURIComponent(body)}`;
}
async function onSubmit(e) {
  e.preventDefault();
  const form = e.target; const F = L().f; const fail = form.querySelector('.sm-fail'); fail.hidden = true;
  const raw = Object.fromEntries(new FormData(form));
  const data = { ...raw, consent: form.elements.consent.checked, addons: $('#f-addons').checked ? ['front-desk'] : [] };
  delete data.addons_fd;
  const errors = clientValidate(data);
  showErrors(errors);
  if (Object.keys(errors).length) return;
  const btn = form.querySelector('.sm-submit'); btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = F.sending;
  let res, body = {};
  try {
    res = await fetch('/api/social/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    body = await res.json().catch(() => ({}));
  } catch { res = null; }
  btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = F.submit;
  if (res && res.status === 201 && body.ok) { const root = $('#sm-form-root'); root.dataset.done = data.email; renderDone(data.email); return; }
  if (res && res.status === 422 && body.fields) { showErrors(body.fields); return; }
  const mail = mailtoFor({ ...data, addons: data.addons.join(',') });
  fail.hidden = false;
  fail.innerHTML = `<b>${F.failH}</b><p>${res && res.status === 429 ? F.busy : F.failP} <a href="mailto:${FALLBACK_EMAIL}">${FALLBACK_EMAIL}</a></p><a class="btn-secondary" href="${esc(mail)}">${F.failMail}</a>`;
  fail.focus?.();
}
function renderDone(email) {
  const F = L().f; const root = $('#sm-form-root');
  root.innerHTML = `<div class="sm-done" role="status" tabindex="-1"><div class="sm-done-ico" aria-hidden="true">✓</div><h3>${F.okH}</h3><p>${F.okP} <b>${esc(email)}</b> ${F.okP2}</p><button type="button" class="btn-secondary" id="f-again">${F.again}</button></div>`;
  root.querySelector('.sm-done').focus();
  $('#f-again').addEventListener('click', () => { delete root.dataset.done; root.innerHTML = ''; renderForm(); });
}

/* ---------- Enlaces "Elegir" y "Seguir" → preseleccionan el formulario ---------- */
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-pick]'); if (!a) return;
  state.pkg = a.dataset.pick; if (a.dataset.fd !== undefined) state.fd = a.dataset.fd === '1';
  const form = $('#sm-form-root form');
  if (form) { form.elements.package_id.value = state.pkg; $('#f-addons').checked = state.fd; updateFormQuote(); }
  renderBuilder();
  setTimeout(() => $('#f-business_name')?.focus({ preventScroll: true }), 400);
});

function renderAll() { renderPlans(); renderBuilder(); renderCalendar(); renderPosts(); renderForm(); }
document.addEventListener('flowserve:lang', renderAll);
renderAll();
