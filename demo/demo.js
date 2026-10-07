/* FlowServe — motor de demo. Todo ocurre en el navegador: no se guarda ni se envía nada. */
(function () {
  const C = window.DEMO;
  const S = C.s;
  const $ = (q) => document.querySelector(q);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => new Intl.NumberFormat(C.locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] !== undefined ? o[k] : ''));
  const ICON_OK = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const ICON_LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  // fecha de la cita: dentro de 2 días, para que "24 h antes" caiga en el futuro
  const day = new Date(); day.setDate(day.getDate() + 2);
  const dayLong = new Intl.DateTimeFormat(C.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(day);
  const dayShort = (d) => new Intl.DateTimeFormat(C.locale, { weekday: 'short' }).format(d);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  let st, timers = [];

  function reset() {
    timers.forEach(clearTimeout); timers = [];
    st = {
      scr: 'site', phase: 'start', svc: null, time: null,
      name: C.client.name, email: C.client.email,
      clock: S.clockNow, diary: C.diary.map((a) => ({ ...a })), wait: C.waitlist.map((w) => ({ ...w, st: 'wait' })),
      feed: [], mails: [], k: { dep: 0, conf: 0, refill: 0, saved: 0, rem: 0 }, mine: null, path: null,
    };
    st.diary.forEach((a) => { a.st = 'paid'; });
    $('#o-date').textContent = cap(dayLong);
    render(); renderOwner();
    const sc = $('.scr'); if (sc) sc.scrollTop = 0;
  }
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  /* ---------- registro de eventos del panel ---------- */
  function ev(html) {
    st.feed.unshift({ t: st.clock, html, fresh: true });
    renderOwner(); ownerPing();
  }
  function flash(key) {
    const el = document.querySelector('[data-k="' + key + '"]');
    if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 900); }
  }

  /* ---------- pantallas del cliente ---------- */
  const svcById = (id) => C.services.find((s) => s.id === id);

  function screenSite() {
    return `
      <div class="b-hero"><div class="b-name">${esc(C.biz.name)}</div><div class="b-tag">${esc(C.biz.tag)}</div><span class="b-demo">${S.demoTag}</span></div>
      <div class="b-sec"><div class="b-h">${S.services}</div>
        ${C.services.map((s) => `<button class="svc" data-act="svc" data-id="${s.id}"><div><div class="n">${esc(s.n)}</div><div class="m">${s.d} min</div></div><div class="p">${money(s.p)}</div></button>`).join('')}
      </div>
      <p class="b-pol">${fmt(S.policy, { dep: money(C.deposit) })}</p>`;
  }
  function screenTime() {
    const s = svcById(st.svc);
    const taken = st.diary.map((a) => a.t);
    return `
      <button class="b-back" data-act="back" data-to="site">‹ ${S.back}</button>
      <div class="b-pad"><div class="b-h">${S.pickTime}</div>
        <div class="b-sum"><b>${esc(s.n)}</b> · ${s.d} min · ${money(s.p)}</div>
        <div class="daylabel">${cap(dayLong)}</div>
        <div class="slots">${C.slots.map((t) => `<button class="slot" data-act="time" data-t="${t}" ${taken.includes(t) ? 'disabled' : ''}>${t}</button>`).join('')}</div>
        <p class="b-small">${S.greyed}</p>
      </div>`;
  }
  function screenDetails() {
    const s = svcById(st.svc);
    return `
      <button class="b-back" data-act="back" data-to="time">‹ ${S.back}</button>
      <div class="b-pad"><div class="b-h">${S.yourDetails}</div>
        <div class="b-sum"><b>${esc(s.n)}</b><br>${cap(dayLong)} · ${st.time}</div>
        <label class="fld"><span>${S.name}</span><input id="f-name" value="${esc(st.name)}" autocomplete="off"></label>
        <label class="fld"><span>${S.email}</span><input id="f-email" value="${esc(st.email)}" autocomplete="off"></label>
        <div class="b-sum" style="font-size:12.5px">${fmt(S.depositExplain, { dep: money(C.deposit), rest: money(s.p - C.deposit) })}</div>
        <button class="b-cta" data-act="topay">${fmt(S.payDeposit, { dep: money(C.deposit) })}</button>
      </div>`;
  }
  function screenPay() {
    const s = svcById(st.svc);
    return `
      <div class="pay">
        <div class="pay-top">${ICON_LOCK} ${S.securePay}</div>
        <div class="pay-amt">${money(C.deposit)}</div>
        <div class="pay-for">${fmt(S.payFor, { svc: esc(s.n), biz: esc(C.biz.name) })}</div>
        <div class="pay-note">${S.payNote}</div>
        <button class="b-cta" data-act="pay">${fmt(S.payBtn, { dep: money(C.deposit) })}</button>
        <button class="b-cta sec" data-act="back" data-to="details">${S.back}</button>
      </div>`;
  }
  const screenPaying = () => `<div class="spin"></div><p class="center" style="color:var(--b-mut);font-size:14px">${S.processing}</p>`;

  function mailHtml(m, i) {
    const old = i > 0 ? ' old' : '';
    return `<div class="mail${old}"><div class="mail-h"><div class="av">${esc(C.biz.initials)}</div><div><div class="mail-from">${esc(C.biz.name)}</div><div class="mail-meta">${esc(m.when)} · ${S.email}</div></div></div><div class="mail-b">${m.body}</div></div>`;
  }
  function screenInbox() {
    return `<div class="inbox-h">${S.inbox}</div>${st.mails.map(mailHtml).join('')}`;
  }
  function screenCancel() {
    const s = svcById(st.svc);
    return `
      <div class="b-pad" style="padding-top:22px"><div class="b-h">${S.cancelQ}</div>
        <div class="b-sum"><b>${esc(s.n)}</b><br>${cap(dayLong)} · ${st.time}</div>
        <div class="b-sum" style="font-size:13px">${fmt(S.cancelPolicy, { dep: money(C.deposit) })}</div>
        <button class="b-cta" data-act="docancel">${S.cancelYes}</button>
        <button class="b-cta sec" data-act="back" data-to="inbox">${S.keepIt}</button>
      </div>`;
  }
  function screenCancelled() {
    return `<div class="b-pad center"><div class="tick">${ICON_OK}</div><div class="b-h">${S.cancelledH}</div>
      <p style="font-size:14px;color:var(--b-mut)">${fmt(S.cancelledP, { dep: money(C.deposit) })}</p>
      <button class="b-cta sec" style="margin-top:18px" data-act="back" data-to="inbox">${S.seeInbox}</button></div>`;
  }

  function render() {
    const map = { site: screenSite, time: screenTime, details: screenDetails, pay: screenPay, paying: screenPaying, inbox: screenInbox, cancel: screenCancel, cancelled: screenCancelled };
    $('#scr').innerHTML = map[st.scr]();
    renderGuide();
  }

  /* ---------- guía ---------- */
  const PH = {
    start: { step: 1 }, booking: { step: 1 }, booked: { step: 2, jump: 'j24' }, r24: { step: 3 },
    confirmed: { step: 3, jump: 'j4' }, r4: { step: 3, jump: 'jafter' }, done: { step: 4, jump: 'restart' },
    waiting: { step: 4 }, refilled: { step: 4, jump: 'restart' },
  };
  function renderGuide() {
    const p = PH[st.phase];
    $('#steps').innerHTML = S.steps.map((t, i) => {
      const n = i + 1; const cls = n < p.step ? 'done' : n === p.step ? 'on' : '';
      return `<div class="step ${cls}"><i>${n < p.step ? '✓' : n}</i>${t}</div>`;
    }).join('');
    const on = $('#steps .on'); if (on) $('#steps').scrollLeft = on.offsetLeft - 16;
    $('#hint-txt').innerHTML = S.hints[st.phase];
    $('#clock').textContent = st.clock;
    const b = $('#jump');
    if (p.jump) { b.hidden = false; b.dataset.act = p.jump; b.textContent = S.jumps[p.jump]; } else { b.hidden = true; }
  }

  /* ---------- panel del dueño ---------- */
  const CHIP = (a) => {
    const m = { paid: ['pri', S.chips.paid], confirmed: ['ok', S.chips.confirmed], noreply: ['warn', S.chips.noreply], atrisk: ['bad', S.chips.atrisk], released: ['warn', S.chips.released], refilled: ['ok', S.chips.refilled], done: ['ok', S.chips.done] };
    const [c, t] = m[a.st] || ['mut', a.st];
    return `<span class="chip ${c}">${t}</span>`;
  };
  function renderOwner() {
    const rows = [...st.diary].sort((a, b) => a.t.localeCompare(b.t));
    const free = C.slots.filter((t) => !st.diary.some((a) => a.t === t));
    const all = [...rows.map((a) => ({ ...a, kind: 'appt' })), ...free.map((t) => ({ t, kind: 'free' }))].sort((a, b) => a.t.localeCompare(b.t));
    $('#diary').innerHTML = all.map((a) => a.kind === 'free'
      ? `<div class="appt free"><div class="tm">${a.t}</div><div class="who"><b>${S.freeSlot}</b></div></div>`
      : `<div class="appt ${a.mine ? 'hl' : ''}"><div class="tm">${a.t}</div><div class="who"><b>${esc(a.who)}</b><span>${esc(a.svc)}</span></div>${CHIP(a)}</div>`).join('');
    $('#wait').innerHTML = st.wait.map((w, i) => {
      const chip = w.st === 'offered' ? `<span class="chip warn">${S.chips.offered}</span>` : w.st === 'booked' ? `<span class="chip ok">${S.chips.booked}</span>` : '';
      return `<div class="wl"><div class="n">${i + 1}</div><div><b>${esc(w.who)}</b> <span>· ${esc(w.wants)}</span></div>${chip}</div>`;
    }).join('');
    $('#feed').innerHTML = st.feed.length ? st.feed.map((e) => `<div class="ev ${e.fresh ? 'new' : ''}"><time>${esc(e.t.split(' ').pop())}</time><p>${e.html}</p></div>`).join('') : `<div class="empty">${S.noActivity}</div>`;
    st.feed.forEach((e) => { e.fresh = false; });
    const k = st.k;
    $('[data-k="dep"]').textContent = money(k.dep);
    $('[data-k="conf"]').textContent = `${k.conf}/${st.diary.length}`;
    $('[data-k="refill"]').textContent = k.refill;
    $('[data-k="saved"]').textContent = money(k.saved);
    $('#r-dep').textContent = money(k.dep);
    $('#r-rem').textContent = k.rem;
    $('#r-refill').textContent = k.refill;
    $('#r-saved').textContent = money(k.saved);
  }

  /* aviso en móvil cuando cambia el panel y se está mirando el teléfono */
  function ownerPing() {
    if (window.innerWidth > 860 || $('.stage').dataset.view === 'owner') return;
    $('#dot').classList.add('show');
    const t = $('#toast'); t.classList.add('show');
    clearTimeout(ownerPing.h); ownerPing.h = setTimeout(() => t.classList.remove('show'), 3500);
  }
  function setView(v) {
    $('.stage').dataset.view = v;
    document.querySelectorAll('.switch button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    if (v === 'owner') { $('#dot').classList.remove('show'); $('#toast').classList.remove('show'); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- acciones ---------- */
  function go(scr) { st.scr = scr; render(); const sc = $('#scr'); sc.scrollTop = 0; }

  const A = {
    svc(el) { st.svc = el.dataset.id; st.phase = 'booking'; go('time'); },
    time(el) { st.time = el.dataset.t; go('details'); },
    back(el) { go(el.dataset.to); },
    topay() {
      st.name = ($('#f-name').value || C.client.name).trim().slice(0, 40);
      st.email = ($('#f-email').value || C.client.email).trim().slice(0, 60);
      go('pay');
    },
    pay() {
      go('paying');
      later(1300, () => {
        const s = svcById(st.svc);
        const short = shortName(st.name);
        st.mine = { t: st.time, who: short, svc: s.n, st: 'paid', mine: true, p: s.p };
        st.diary.push(st.mine);
        st.k.dep += C.deposit;
        st.clock = S.clockNow;
        ev(fmt(S.ev.booked, { who: esc(short), svc: esc(s.n), t: st.time }));
        later(500, () => { ev(fmt(S.ev.deposit, { dep: money(C.deposit), who: esc(short) })); flash('dep'); });
        st.mails = [{ when: S.justNow, body: `<h4>${S.mailConfH}</h4><p>${fmt(S.mailConfP, { name: esc(firstName(st.name)) })}</p><dl class="kv"><dt>${S.kService}</dt><dd>${esc(s.n)}</dd><dt>${S.kWhen}</dt><dd>${cap(dayLong)} · ${st.time}</dd><dt>${S.kDeposit}</dt><dd>${money(C.deposit)} ✓</dd><dt>${S.kBalance}</dt><dd>${money(s.p - C.deposit)}</dd></dl><p style="font-size:12px;opacity:.75">${S.mailConfFoot}</p>` }];
        st.phase = 'booked';
        go('inbox');
      });
    },
    j24() {
      st.clock = `${cap(dayShort(new Date(day.getTime() - 864e5)))} ${st.time}`;
      st.k.rem += st.diary.length;
      st.mails.unshift({ when: S.r24when, body: `<h4>${fmt(S.mail24H, { t: st.time })}</h4><p>${fmt(S.mail24P, { name: esc(firstName(st.name)), svc: esc(svcById(st.svc).n) })}</p><div class="row"><button data-act="confirm">${S.btnConfirm}</button><button class="sec" data-act="tocancel">${S.btnCancel}</button></div>` });
      st.phase = 'r24'; go('inbox');
      ev(fmt(S.ev.r24, { n: st.diary.length }));
      const others = st.diary.filter((a) => !a.mine);
      later(900, () => { others[0].st = 'confirmed'; st.k.conf++; ev(fmt(S.ev.confirmed, { who: esc(others[0].who) })); flash('conf'); });
      later(1700, () => { if (others[1]) { others[1].st = 'confirmed'; st.k.conf++; ev(fmt(S.ev.confirmed, { who: esc(others[1].who) })); flash('conf'); } });
      later(2300, () => { const o = others[others.length - 1]; o.st = 'noreply'; renderOwner(); });
    },
    confirm() {
      st.mine.st = 'confirmed'; st.k.conf++;
      st.mails[0].body = st.mails[0].body.replace(/<div class="row">[\s\S]*<\/div>$/, `<div class="row"><button disabled>${S.confirmedBtn}</button></div>`);
      st.path = 'confirm'; st.phase = 'confirmed'; go('inbox');
      ev(fmt(S.ev.confirmed, { who: esc(st.mine.who) })); flash('conf');
    },
    tocancel() { go('cancel'); },
    docancel() {
      const s = svcById(st.svc);
      st.path = 'cancel'; st.phase = 'waiting';
      st.mine.st = 'released';
      const m24 = st.mails.find((m) => m.body.includes('data-act="confirm"'));
      if (m24) m24.body = m24.body.replace(/<div class="row">[\s\S]*<\/div>$/, `<div class="row"><button disabled>${S.cancelledBtn}</button></div>`);
      go('cancelled');
      ev(fmt(S.ev.cancelled, { who: esc(st.mine.who), dep: money(C.deposit) }));
      const w = st.wait[0];
      later(1100, () => { w.st = 'offered'; ev(fmt(S.ev.offered, { t: st.time, who: esc(w.who) })); });
      later(3600, () => {
        w.st = 'booked';
        st.mine.who = w.who; st.mine.st = 'refilled'; st.mine.svc = s.n;
        st.k.refill++; st.k.saved += s.p; st.k.dep += C.deposit;
        ev(fmt(S.ev.accepted, { who: esc(w.who), dep: money(C.deposit), t: st.time }));
        flash('refill'); flash('saved'); flash('dep');
        st.phase = 'refilled'; renderGuide();
        st.mails.unshift({ when: S.justNow, body: `<h4>${S.mailCreditH}</h4><p>${fmt(S.mailCreditP, { name: esc(firstName(st.name)), dep: money(C.deposit) })}</p>` });
      });
    },
    j4() {
      const [h, m] = st.time.split(':').map(Number);
      st.clock = `${cap(dayShort(day))} ${String(Math.max(h - 4, 0)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      st.k.rem += 1;
      st.mails.unshift({ when: S.r4when, body: `<h4>${fmt(S.mail4H, { t: st.time })}</h4><p>${fmt(S.mail4P, { addr: esc(C.biz.addr) })}</p>` });
      st.phase = 'r4'; go('inbox');
      ev(fmt(S.ev.r4, { who: esc(st.mine.who) }));
      const o = st.diary.find((a) => a.st === 'noreply');
      if (o) later(1000, () => { o.st = 'atrisk'; ev(fmt(S.ev.atrisk, { who: esc(o.who) })); });
    },
    jafter() {
      const s = svcById(st.svc);
      const [h, m] = st.time.split(':').map(Number);
      const end = h * 60 + m + s.d + 10;
      st.clock = `${cap(dayShort(day))} ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
      st.mine.st = 'done';
      st.mails.unshift({ when: S.justNow, body: `<h4>${fmt(S.mailDoneH, { name: esc(firstName(st.name)) })}</h4><dl class="kv"><dt>${S.kDeposit}</dt><dd>${money(C.deposit)}</dd><dt>${S.kBalancePaid}</dt><dd>${money(s.p - C.deposit)}</dd><dt>${S.kTotal}</dt><dd>${money(s.p)}</dd></dl>` });
      st.phase = 'done'; go('inbox');
      ev(fmt(S.ev.done, { who: esc(st.mine.who), total: money(s.p) }));
    },
    restart() { reset(); },
  };
  const firstName = (n) => n.split(' ')[0];
  const shortName = (n) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled && A[el.dataset.act]) { A[el.dataset.act](el); return; }
    const v = e.target.closest('[data-v]'); if (v) setView(v.dataset.v);
  });

  /* calculadora: números del propio negocio, no resultados de clientes */
  function calc() {
    const n = Math.max(0, +$('#c-n').value || 0), p = Math.max(0, +$('#c-p').value || 0);
    $('#c-out').textContent = money(Math.round(n * p * 4.33));
  }
  $('#c-n').addEventListener('input', calc); $('#c-p').addEventListener('input', calc);
  calc(); reset();
})();
