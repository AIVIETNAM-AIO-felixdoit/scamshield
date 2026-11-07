(function () {
  'use strict';
  const { analyze, CATEGORIES } = window.ScamShield;
  const { EXAMPLES, QUIZ } = window.ScamSamples;
  const $ = id => document.getElementById(id);
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LEVEL = {
    low:    { color: '#22c55e', badge: 'LOW RISK',    title: 'No major red flags' },
    medium: { color: '#f59e0b', badge: 'SUSPICIOUS',  title: 'Be careful with this one' },
    high:   { color: '#ef4444', badge: 'HIGH RISK',   title: 'This looks like a scam' }
  };

  // ---------------- tabs ----------------
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
  function showView(v) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------------- tooltip ----------------
  const tip = document.createElement('div');
  tip.className = 'tip';
  document.body.appendChild(tip);
  function showTip(el) {
    tip.innerHTML = `<b style="color:${el.style.getPropertyValue('--c')}">${esc(el.dataset.label)}</b>${esc(el.dataset.why)}`;
    const r = el.getBoundingClientRect();
    tip.classList.add('show');
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), innerWidth - tw - 8);
    let y = r.top - th - 10; if (y < 70) y = r.bottom + 10;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  document.addEventListener('mouseover', e => { const h = e.target.closest('.hl'); if (h) showTip(h); });
  document.addEventListener('mouseout', e => { if (e.target.closest('.hl')) tip.classList.remove('show'); });
  document.addEventListener('click', e => { const h = e.target.closest('.hl'); if (h) showTip(h); else tip.classList.remove('show'); });
  window.addEventListener('scroll', () => tip.classList.remove('show'), { passive: true });

  // ---------------- analyze view ----------------
  const msg = $('msg');
  EXAMPLES.forEach(ex => {
    const b = document.createElement('button');
    b.className = 'chip'; b.dataset.id = ex.id;
    b.textContent = `${ex.icon} ${ex.label}`;
    b.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === b));
      msg.value = ex.text; updateCount(); run();
    });
    $('exampleChips').appendChild(b);
  });

  function updateCount() { $('charcount').textContent = `${msg.value.length} characters`; }
  let debounce;
  msg.addEventListener('input', () => { updateCount(); clearTimeout(debounce); debounce = setTimeout(() => msg.value.trim() && run(), 600); });
  $('analyzeBtn').addEventListener('click', run);
  $('clearBtn').addEventListener('click', () => { msg.value = ''; updateCount(); reset(); msg.focus(); });
  $('pasteBtn').addEventListener('click', async () => {
    try { msg.value = await navigator.clipboard.readText(); updateCount(); run(); }
    catch { toast('Clipboard blocked – press Ctrl+V instead'); msg.focus(); }
  });

  function reset() {
    $('emptyState').classList.remove('hidden');
    $('verdict').classList.add('hidden');
    $('details').classList.add('hidden');
    $('verdictCard').style.setProperty('--glow', 'transparent');
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  }

  let lastResult = null;
  function run() {
    const text = msg.value;
    if (!text.trim()) { reset(); return; }
    const r = analyze(text);
    lastResult = r;
    renderVerdict(r);
    renderAnnotated(r, $('annotated'));
    renderLegend(r);
    renderFlags(r);
    renderLinks(r);
    renderAdvice(r);
    $('details').classList.remove('hidden');
  }

  let anim;
  function renderVerdict(r) {
    const L = LEVEL[r.level];
    $('emptyState').classList.add('hidden');
    $('verdict').classList.remove('hidden');
    const card = $('verdictCard');
    card.style.setProperty('--lvl', L.color);
    card.style.setProperty('--glow', L.color + '55');
    $('levelBadge').textContent = L.badge;
    $('verdictTitle').textContent = L.title;
    $('scamType').textContent = r.type.name;
    const meter = $('meter');
    meter.style.strokeDashoffset = 326.7;
    requestAnimationFrame(() => requestAnimationFrame(() => { meter.style.strokeDashoffset = 326.7 * (1 - r.score / 100); }));
    cancelAnimationFrame(anim);
    const start = performance.now(), num = $('scoreNum');
    const tick = now => {
      const p = Math.min(1, (now - start) / 1000), e = 1 - Math.pow(1 - p, 3);
      num.textContent = Math.round(r.score * e);
      if (p < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
    $('combos').innerHTML = r.combos.map(c => `<span class="combo">⚡ ${esc(c)}</span>`).join('');
  }

  function renderAnnotated(r, target) {
    let html = '', pos = 0, i = 0;
    for (const m of r.matches) {
      const cat = CATEGORIES[m.category];
      html += esc(r.text.slice(pos, m.start));
      html += `<mark class="hl${m.url ? ' url' : ''}" style="--c:${cat.color};animation-delay:${0.05 * i++}s" data-label="${esc(cat.label)}" data-why="${esc(m.why)}">${esc(r.text.slice(m.start, m.end))}</mark>`;
      pos = m.end;
    }
    html += esc(r.text.slice(pos));
    target.innerHTML = html;
  }

  function renderLegend(r) {
    const used = [...new Set(r.matches.map(m => m.category))];
    $('legend').innerHTML = used.map(c => `<span style="--c:${CATEGORIES[c].color}">${esc(CATEGORIES[c].label)}</span>`).join('');
  }

  function renderFlags(r) {
    const flags = r.categories.filter(c => c.id !== 'trust');
    $('flagCount').textContent = flags.length;
    if (!flags.length) { $('flags').innerHTML = '<div class="none">✅ No manipulation tactics detected.</div>'; return; }
    $('flags').innerHTML = flags.map((c, i) => {
      const why = c.id === 'link' ? 'One or more links show signs of deception – see the Link inspector.' : c.why;
      return `<div class="flag" style="--c:${c.color};animation-delay:${i * 0.06}s"><div>
        <h4>${esc(c.label)}</h4><p>${esc(why || '')}</p>
        <div class="ex">${c.examples.map(e => `<code>${esc(e.length > 48 ? e.slice(0, 46) + '…' : e)}</code>`).join('')}</div>
      </div></div>`;
    }).join('');
  }

  function renderLinks(r) {
    if (!r.urls.length) { $('links').innerHTML = '<div class="none">No links found in this message.</div>'; return; }
    $('links').innerHTML = r.urls.map((u, i) => {
      const cls = u.score >= 25 ? 'bad' : u.score > 0 ? 'warn' : 'ok';
      const label = cls === 'bad' ? 'DANGEROUS' : cls === 'warn' ? 'CAUTION' : 'LOOKS OK';
      const shown = esc(u.raw).replace(esc(u.registrable), `<span class="reg">${esc(u.registrable)}</span>`);
      return `<div class="link" style="animation-delay:${i * 0.08}s">
        <div class="link-head"><div class="link-url">${shown}</div><span class="badge ${cls}">${label}</span></div>
        <div class="real-dest">Real destination: <b>${esc(u.registrable)}</b>${u.official ? ' (official)' : ''}</div>
        <ul>${u.findings.map(f => `<li>${esc(f.text)}</li>`).join('') || '<li>No suspicious traits found.</li>'}</ul>
      </div>`;
    }).join('');
  }

  function renderAdvice(r) {
    $('advice').innerHTML = r.type.advice.map(a => `<li>${esc(a)}</li>`).join('');
  }

  $('copyReport').addEventListener('click', async () => {
    if (!lastResult) return;
    const r = lastResult;
    const lines = [
      `🛡️ ScamShield report – ${LEVEL[r.level].badge} (${r.score}/100)`,
      `Pattern: ${r.type.name}`, '',
      'Red flags:', ...r.categories.filter(c => c.id !== 'trust').map(c => `• ${c.label}: "${c.examples[0] || ''}"`), '',
      ...(r.urls.length ? ['Links:', ...r.urls.map(u => `• ${u.registrable} – ${u.findings.map(f => f.text).join(' ') || 'no issues found'}`), ''] : []),
      'What to do:', ...r.type.advice.map((a, i) => `${i + 1}. ${a}`)
    ];
    try { await navigator.clipboard.writeText(lines.join('\n')); toast('Report copied – paste it anywhere'); }
    catch { toast('Copy failed – select the text manually'); }
  });

  function toast(t) {
    const el = $('toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------------- quiz ----------------
  let qi = 0, correct = 0;
  const results = [];
  function renderProgress() {
    $('quizProgress').innerHTML = QUIZ.map((_, i) => `<span class="${results[i] === true ? 'right' : results[i] === false ? 'wrong' : i === qi ? 'cur' : ''}"></span>`).join('');
  }
  function loadQ() {
    renderProgress();
    const q = QUIZ[qi];
    $('quizFrom').textContent = q.from;
    $('quizAvatar').textContent = q.from.replace(/[^A-Za-z]/g, '').charAt(0) || '#';
    $('quizBubble').textContent = q.text;
    $('quizActions').classList.remove('hidden');
    $('quizFeedback').classList.add('hidden');
  }
  $('quizActions').addEventListener('click', e => {
    const b = e.target.closest('[data-answer]'); if (!b) return;
    const q = QUIZ[qi], saidScam = b.dataset.answer === 'scam', ok = saidScam === q.scam;
    results[qi] = ok; if (ok) correct++;
    const r = analyze(q.text);
    renderAnnotated(r, $('quizBubble'));
    const flags = r.categories.filter(c => c.id !== 'trust' && c.id !== 'impersonation' || (c.id === 'impersonation' && q.scam));
    const fb = $('quizFeedback');
    fb.innerHTML = `
      <div class="fb-head ${ok ? 'right' : 'wrong'}">${ok ? '✔ Correct!' : '✘ Not quite.'} <span class="muted small">This message is ${q.scam ? 'a scam' : 'legit'} · ScamShield risk ${r.score}/100</span></div>
      ${q.scam ? `<div>What gave it away:</div><ul class="fb-list">${flags.map(c => `<li><b style="color:${c.color}">${esc(c.label)}</b> — ${esc(c.id === 'link' ? (r.urls[0] && r.urls[0].findings[0] ? r.urls[0].findings[0].text : 'Suspicious link') : c.why)}</li>`).join('')}</ul>`
               : `<ul class="fb-list"><li>Known sender, no requests for money, codes or links to log in. That's what normal looks like.</li></ul>`}
      <button class="btn primary" id="nextQ">${qi === QUIZ.length - 1 ? 'See my score' : 'Next message →'}</button>`;
    $('quizActions').classList.add('hidden');
    fb.classList.remove('hidden');
    renderProgress();
    $('nextQ').addEventListener('click', () => { qi++; qi < QUIZ.length ? loadQ() : finish(); });
  });
  function finish() {
    renderProgress();
    const pct = Math.round(100 * correct / QUIZ.length);
    const msgTxt = pct === 100 ? 'Scam-proof! Share this with someone who needs it.' : pct >= 75 ? 'Sharp eye – just a couple slipped through.' : 'Scammers are good at this. Use ScamShield before you click.';
    $('quizCard').innerHTML = `<div class="final"><div class="muted">Your score</div><div class="big-score grad">${correct}/${QUIZ.length}</div><p>${msgTxt}</p><button class="btn primary" id="restartQ">Try again</button></div>`;
    $('restartQ').addEventListener('click', () => location.reload());
  }
  loadQ();

  // ---------------- how ----------------
  $('ruleCount').textContent = window.ScamShield.ruleCount || '60+';
  $('catCount').textContent = Object.keys(CATEGORIES).length - 2;

  // deep-link: #example=bank
  const m = location.hash.match(/example=(\w+)/);
  if (m) { const chip = document.querySelector(`.chip[data-id="${m[1]}"]`); if (chip) chip.click(); }
})();
