// Small first-party analytics for aarontan.dev.
// Records: one page view, how long each section is on screen, clicks on tracked links,
// "More details" opens and how far down the page people scroll. No cookies, no personal data.
(() => {
  const host = location.hostname;
  if (host !== 'aarontan.dev' && host !== 'www.aarontan.dev') return;   // never count local previews
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.has('notrack')) localStorage.setItem('notrack', '1');         // visit once with ?notrack to exclude yourself
    if (qs.has('track')) localStorage.removeItem('notrack');
    if (localStorage.getItem('notrack')) return;
  } catch (e) {}
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;

  let sid;
  try {
    sid = sessionStorage.getItem('sid');
    if (!sid) { sid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 36); sessionStorage.setItem('sid', sid); }
  } catch (e) { sid = Math.random().toString(36).slice(2); }

  const queue = [];
  const add = (type, name, value) => { if (queue.length < 80) queue.push([type, String(name).slice(0, 80), value | 0]); };

  // section time on screen
  const shown = {}, total = {}, sent = {};
  const io = new IntersectionObserver(es => {
    const now = performance.now();
    es.forEach(e => {
      const id = e.target.id;
      if (e.isIntersecting) shown[id] = now;
      else if (shown[id] != null) { total[id] = (total[id] || 0) + now - shown[id]; delete shown[id]; }
    });
  }, { threshold: 0.35 });
  document.querySelectorAll('main section[id]').forEach(s => io.observe(s));

  // scroll depth
  let depth = 0, sentDepth = 0;
  addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0) depth = Math.max(depth, Math.round(100 * scrollY / max));
  }, { passive: true });

  // clicks on tracked links, and detail panels opened
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-t]');
    if (a && a.tagName === 'A') { add('click', a.dataset.t, 0); flush(); }
  });
  document.querySelectorAll('details[data-t]').forEach(d => d.addEventListener('toggle', () => { if (d.open) add('expand', d.dataset.t, 0); }));

  function flush(first) {
    const now = performance.now();
    for (const id in shown) { total[id] = (total[id] || 0) + now - shown[id]; shown[id] = now; }
    for (const id in total) {
      const secs = Math.round(total[id] / 1000) - (sent[id] || 0);
      if (secs >= 1) { add('section', id, Math.min(secs, 1800)); sent[id] = (sent[id] || 0) + secs; }
    }
    if (depth > sentDepth) { add('depth', 'page', depth); sentDepth = depth; }
    if (!queue.length && !first) return;
    const body = JSON.stringify({
      sid, first: !!first, w: innerWidth,
      ref: first && document.referrer ? (() => { try { return new URL(document.referrer).hostname; } catch (e) { return ''; } })() : '',
      ev: queue.splice(0)
    });
    const blob = new Blob([body], { type: 'text/plain' });
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/t', blob))) fetch('/api/t', { method: 'POST', body, keepalive: true }).catch(() => {});
  }

  add('view', location.pathname, 0);
  flush(true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', () => flush());
  setInterval(() => { if (document.visibilityState === 'visible') flush(); }, 30000);
})();
