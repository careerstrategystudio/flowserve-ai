// Menú principal: desplegables (clic, teclado y Escape) y menú móvil (botón ☰).
(function () {
  var nav = document.getElementById('main-nav'); if (!nav) return;
  var dds = nav.querySelectorAll('.nav-dd-btn');
  function closeAll(except) { dds.forEach(function (b) { if (b !== except) { b.setAttribute('aria-expanded', 'false'); b.parentNode.classList.remove('open'); } }); }
  dds.forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); var open = b.getAttribute('aria-expanded') !== 'true'; closeAll(b); b.setAttribute('aria-expanded', String(open)); b.parentNode.classList.toggle('open', open); });
  });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) closeAll(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var openBtn = nav.querySelector('.nav-dd.open .nav-dd-btn'); closeAll(); if (openBtn) openBtn.focus(); } });
  nav.addEventListener('focusout', function (e) { if (!nav.contains(e.relatedTarget)) closeAll(); });
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) toggle.addEventListener('click', function () { var open = !nav.classList.contains('open'); nav.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); });
  // marcar la página actual
  var here = location.pathname.replace(/index\.html$/, '');
  nav.querySelectorAll('a[href]').forEach(function (a) { if (a.getAttribute('href') === here) { a.setAttribute('aria-current', 'page'); var dd = a.closest('.nav-dd'); if (dd) dd.querySelector('.nav-dd-btn').classList.add('current'); } });
})();
