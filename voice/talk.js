// Widget "Talk to the receptionist": llamada de prueba desde el navegador con la recepcionista demo.
// Usa el SDK web de Retell (copia local en /voice/retell-web.js). El token lo da /api/voice/web-call.
const T = {
  en: { connecting: 'Connecting… allow the microphone', live: 'Live — say hello', speaking: 'Receptionist speaking…', listening: 'Listening…', ended: 'Call ended. Thanks for trying it!', mic: 'We need your microphone to talk. Please allow it in your browser and try again.', fail: 'Could not start the call. Please try again in a minute.', you: 'You', ai: 'AI', start: 'Start the call', end: 'End the call' },
  es: { connecting: 'Conectando… permite el micrófono', live: 'En línea — salúdala (en inglés)', speaking: 'La recepcionista habla…', listening: 'Te escucha…', ended: 'Llamada terminada. ¡Gracias por probarla!', mic: 'Necesitamos tu micrófono para hablar. Permítelo en el navegador y vuelve a intentarlo.', fail: 'No se pudo iniciar la llamada. Inténtalo en un minuto.', you: 'Tú', ai: 'IA', start: 'Empezar la llamada', end: 'Colgar' },
};
const L = () => (document.documentElement.lang === 'es' ? T.es : T.en);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const HANG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15.5c5-4.7 13-4.7 18 0l-2.4 2.4a1 1 0 0 1-1.3.1l-2.2-1.6a1 1 0 0 1-.4-.8v-1.9c-1.8-.6-3.6-.6-5.4 0v1.9a1 1 0 0 1-.4.8l-2.2 1.6a1 1 0 0 1-1.3-.1Z"/></svg>';

function mount(root) {
  const btn = root.querySelector('.talk-btn');
  const status = root.querySelector('.talk-status');
  const timer = root.querySelector('.talk-timer');
  const log = root.querySelector('.talk-log');
  const err = root.querySelector('.talk-err');
  const after = root.querySelector('.talk-after');
  let client = null, state = 'idle', tick = null, started = 0, max = 180;

  const setState = (s) => {
    state = s; btn.dataset.state = s;
    btn.innerHTML = s === 'live' ? HANG : MIC;
    btn.setAttribute('aria-label', s === 'live' ? L().end : L().start);
    btn.disabled = s === 'connecting';
  };
  const clock = () => {
    const sec = Math.floor((Date.now() - started) / 1000);
    const left = Math.max(0, max - sec);
    timer.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}  ·  ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`;
  };
  const renderLog = (items) => {
    const lines = (items || []).filter((u) => (u.role === 'agent' || u.role === 'user') && u.content);
    if (!lines.length) return;
    log.classList.add('on');
    log.innerHTML = lines.slice(-12).map((u) => `<div class="cm-line ${u.role === 'agent' ? 'ai' : ''}"><span class="who">${u.role === 'agent' ? L().ai : L().you}</span><p>${esc(u.content)}</p></div>`).join('');
    log.scrollTop = log.scrollHeight;
  };
  const finish = (failed) => {
    clearInterval(tick); tick = null;
    setState('idle'); status.textContent = failed === true ? '' : L().ended;
    btn.classList.remove('speaking');
    if (failed !== true) after.classList.add('on');
    client = null;
  };

  async function start() {
    err.textContent = ''; after.classList.remove('on'); log.innerHTML = ''; log.classList.remove('on');
    setState('connecting'); status.textContent = L().connecting; timer.textContent = '';
    try {
      // pedir el micro primero: así el error es claro si lo bloquean
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch { setState('idle'); status.textContent = ''; err.textContent = L().mic; return; }
    try {
      const r = await fetch('/api/voice/web-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || L().fail);
      max = j.maxSeconds || 180;
      const { RetellWebClient } = await import('/voice/retell-web.js');
      client = new RetellWebClient();
      client.on('call_started', () => { setState('live'); status.textContent = L().live; started = Date.now(); clock(); tick = setInterval(clock, 1000); });
      client.on('agent_start_talking', () => { btn.classList.add('speaking'); status.textContent = L().speaking; });
      client.on('agent_stop_talking', () => { btn.classList.remove('speaking'); status.textContent = L().listening; });
      client.on('update', (u) => renderLog(u?.transcript));
      client.on('call_ended', () => { if (client) finish(); });
      client.on('error', (e) => { console.error(e); err.textContent = L().fail; try { client.stopCall(); } catch {} finish(true); });
      await client.startCall({ accessToken: j.accessToken, ...(j.callId ? { callId: j.callId } : {}), ...(j.transport ? { transport: j.transport } : {}), ...(j.url ? { url: j.url } : {}) });
    } catch (e) {
      console.error(e); if (client) { try { client.stopCall(); } catch {} } finish(true); err.textContent = e.message || L().fail;
    }
  }

  btn.addEventListener('click', () => {
    if (state === 'idle') start();
    else if (state === 'live' && client) { try { client.stopCall(); } catch {} finish(); }
  });
  setState('idle');
}

document.querySelectorAll('[data-talk]').forEach(mount);
