/* FlowServe — selector de idioma compartido (ES/EN)
   Se carga desde la raiz con ruta absoluta: /i18n.js

   Uso en el HTML:
     <p data-es="Hola" data-en="Hi">Hola</p>
     <p data-es-html="<b>Hola</b>" data-en-html="<b>Hi</b>"><b>Hola</b></p>
     <a data-es-aria="Cerrar" data-en-aria="Close">
     <img data-es-alt="..." data-en-alt="...">
     <input data-es-placeholder="..." data-en-placeholder="...">
   Botones: <button class="lang-btn" data-lang="es">ES</button>
*/
(function () {
  'use strict';

  var STORAGE_KEY = 'flowserve-lang';
  var SUPPORTED = ['es', 'en'];
  var DEFAULT = 'es';

  var ATTR_MAP = {
    placeholder: 'placeholder',
    aria: 'aria-label',
    alt: 'alt',
    title: 'title',
    content: 'content'
  };

  function read() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (e) { /* modo privado o storage bloqueado */ }

    var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (nav.indexOf('es') === 0) return 'es';
    if (nav.indexOf('en') === 0) return 'en';
    return DEFAULT;
  }

  function save(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* noop */ }
  }

  function apply(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT;

    document.documentElement.setAttribute('lang', lang);

    // Texto plano
    var nodes = document.querySelectorAll('[data-' + lang + ']');
    for (var i = 0; i < nodes.length; i++) {
      var value = nodes[i].getAttribute('data-' + lang);
      if (value !== null) nodes[i].textContent = value;
    }

    // Contenido con HTML anidado
    var htmlNodes = document.querySelectorAll('[data-' + lang + '-html]');
    for (var j = 0; j < htmlNodes.length; j++) {
      var html = htmlNodes[j].getAttribute('data-' + lang + '-html');
      if (html !== null) htmlNodes[j].innerHTML = html;
    }

    // Atributos traducibles
    for (var key in ATTR_MAP) {
      if (!Object.prototype.hasOwnProperty.call(ATTR_MAP, key)) continue;
      var selector = '[data-' + lang + '-' + key + ']';
      var attrNodes = document.querySelectorAll(selector);
      for (var k = 0; k < attrNodes.length; k++) {
        var attrValue = attrNodes[k].getAttribute('data-' + lang + '-' + key);
        if (attrValue !== null) attrNodes[k].setAttribute(ATTR_MAP[key], attrValue);
      }
    }

    // Estado de los botones
    var buttons = document.querySelectorAll('.lang-btn[data-lang]');
    for (var m = 0; m < buttons.length; m++) {
      var isActive = buttons[m].getAttribute('data-lang') === lang;
      buttons[m].classList.toggle('active', isActive);
      buttons[m].setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    window.FlowServeLang = lang;
    document.dispatchEvent(new CustomEvent('flowserve:lang', { detail: { lang: lang } }));
  }

  function setLang(lang) {
    apply(lang);
    save(lang);
  }

  // Delegacion: sirve para los botones del header y para cualquier enlace con data-lang
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest ? event.target.closest('[data-lang]') : null;
    if (!trigger) return;
    event.preventDefault();
    setLang(trigger.getAttribute('data-lang'));
  });

  // API publica por si alguna pagina la necesita
  window.FlowServeSetLang = setLang;
  window.FlowServeGetLang = function () { return window.FlowServeLang || DEFAULT; };

  apply(read());
})();
