"""Records the ScamShield demo video automatically.

1. Serves the app on localhost.
2. Drives Chromium with Playwright, capturing 1920x1080 frames via the CDP screencast.
3. Each narration segment starts at a logged wall-clock time; actions for that segment
   run, then we wait until the narration for that segment has finished.
4. Writes build/frames/*.jpg, build/frames.txt (ffmpeg concat list) and build/timeline.json.
Run tools/make_video.py afterwards to mux frames + narration into the final MP4.
"""
import asyncio, base64, json, pathlib, subprocess, threading, time, wave, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILD = ROOT / 'build'
FRAMES = BUILD / 'frames'
AUDIO = BUILD / 'audio'
PAD = 0.45

segments = json.loads((ROOT / 'tools' / 'video_script.json').read_text(encoding='utf-8'))
for s in segments:
    with wave.open(str(AUDIO / f"{s['id']}.wav")) as w:
        s['dur'] = w.getnframes() / w.getframerate()

OVERLAY_JS = r"""
(() => {
  if (window.__demo) return;
  const css = document.createElement('style');
  css.textContent = `
  #demo-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:9999;pointer-events:none;transition:transform .7s cubic-bezier(.3,.8,.3,1);transform:translate(800px,450px)}
  #demo-cursor svg{width:26px;height:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
  .demo-ripple{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #a78bfa;z-index:9998;pointer-events:none;animation:dr .6s ease-out forwards}
  @keyframes dr{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
  #demo-card{position:fixed;inset:0;z-index:9990;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;
    background:radial-gradient(1000px 600px at 20% 0%,#1d2a6b,transparent 60%),radial-gradient(900px 500px at 100% 100%,#5b21b655,transparent 60%),#0b1020;
    color:#e8ecf8;font-family:Inter,sans-serif;opacity:0;transition:opacity .6s;pointer-events:none;padding:40px}
  #demo-card.show{opacity:1}
  #demo-card h1{font-size:76px;margin:18px 0 8px;letter-spacing:-.04em;font-weight:800}
  #demo-card h1 b{color:#22c55e}
  #demo-card h2{font-size:40px;margin:0 0 30px;letter-spacing:-.03em;font-weight:800;max-width:1100px;line-height:1.2}
  #demo-card p{font-size:24px;color:#94a0c4;margin:6px 0}
  #demo-card .grad{background:linear-gradient(90deg,#4ade80,#60a5fa 50%,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
  #demo-card .pill{display:inline-block;margin-top:26px;padding:8px 18px;border-radius:999px;border:1px solid #24305c;background:#121a36;color:#cbd5f5;font-size:18px}
  .demo-bubbles{display:flex;flex-direction:column;gap:16px;align-items:flex-start;max-width:820px;width:100%}
  .demo-b{background:#1f2a52;border-radius:6px 22px 22px 22px;padding:16px 22px;font-size:22px;text-align:left;opacity:0;transform:translateY(12px);animation:db .6s ease forwards}
  .demo-b small{display:block;color:#94a0c4;font-size:15px;margin-bottom:4px}
  @keyframes db{to{opacity:1;transform:none}}
  .demo-tags{display:flex;gap:12px;margin-top:30px;flex-wrap:wrap;justify-content:center}
  .demo-tags span{font-size:20px;padding:8px 16px;border-radius:999px;background:#ef444422;border:1px solid #ef444466;color:#fecaca}
  `;
  document.head.appendChild(css);
  const c = document.createElement('div'); c.id = 'demo-cursor';
  c.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  const card = document.createElement('div'); card.id = 'demo-card'; document.body.appendChild(card);
  let pos = [800, 450];
  window.__demo = {
    move(x, y, ms = 700) { c.style.transitionDuration = ms + 'ms'; c.style.transform = `translate(${x - 4}px,${y - 2}px)`; pos = [x, y]; },
    ripple() { const r = document.createElement('div'); r.className = 'demo-ripple'; r.style.left = pos[0] + 'px'; r.style.top = pos[1] + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); },
    card(html) { card.innerHTML = html; card.classList.add('show'); c.style.opacity = 0; },
    hide() { card.classList.remove('show'); c.style.opacity = 1; },
    scrollTo(sel, offset = 90) { const el = document.querySelector(sel); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - offset, behavior: 'smooth' }); },
    scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
})();
"""

SHIELD = '<svg width="110" height="110" viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5z" fill="#16a34a33" stroke="#22c55e" stroke-width="1.2"/><path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="#22c55e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CARD_INTRO = f'{SHIELD}<h1>Scam<b>Shield</b></h1><h2 class="grad">Spot scam messages before you click.</h2><p>Explainable · Bilingual (EN / VI) · 100% on-device</p><span class="pill">Next Byte Hacks V5 · Solo project</span>'
CARD_PROBLEM = '''<h2>One message is all it takes.</h2>
<div class="demo-bubbles">
 <div class="demo-b" style="animation-delay:.3s"><small>+1 (415) 555-0199</small>Your account has been suspended. Verify within 24h: paypa1-secure.xyz</div>
 <div class="demo-b" style="animation-delay:1.6s;align-self:flex-end"><small>Unknown</small>Hi Mom, I lost my phone. Can you send me gift card codes? Don't tell Dad.</div>
 <div class="demo-b" style="animation-delay:2.9s"><small>Recruiter</small>Earn $300/day liking videos! No experience needed.</div>
</div>
<div class="demo-tags"><span style="animation:db .6s 4.5s ease forwards;opacity:0">Fear</span><span style="animation:db .6s 5s ease forwards;opacity:0">Urgency</span><span style="animation:db .6s 5.5s ease forwards;opacity:0">Easy money</span><span style="animation:db .6s 6s ease forwards;opacity:0">Secrecy</span></div>'''
CARD_OUTRO = f'''{SHIELD}<h1>Scam<b>Shield</b></h1><h2 class="grad">Know the tactic. Beat the scam.</h2>
<p>Next: browser extension · mobile share target · more languages</p><span class="pill">Open source · Built for Next Byte Hacks V5</span>'''


def serve():
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a, **k: None
    srv = ThreadingHTTPServer(('127.0.0.1', 8765), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def main():
    FRAMES.mkdir(parents=True, exist_ok=True)
    for f in FRAMES.glob('*.jpg'):
        f.unlink()
    srv = serve()
    frames = []  # (wallclock, path)

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--hide-scrollbars'])
        ctx = await browser.new_context(viewport={'width': 1600, 'height': 900}, device_scale_factor=1.2,
                                        permissions=['clipboard-read', 'clipboard-write'])
        page = await ctx.new_page()
        await page.goto('http://127.0.0.1:8765/index.html')
        await page.wait_for_load_state('networkidle')
        await page.evaluate(OVERLAY_JS)
        await page.evaluate(f'__demo.card({json.dumps(CARD_INTRO)})')
        await page.wait_for_timeout(900)

        cdp = await ctx.new_cdp_session(page)

        def on_frame(ev):
            t = time.time()
            path = FRAMES / f'{len(frames):05d}.jpg'
            path.write_bytes(base64.b64decode(ev['data']))
            frames.append((t, path.name))
            asyncio.ensure_future(cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']}))

        cdp.on('Page.screencastFrame', on_frame)
        await cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 92, 'maxWidth': 1920, 'maxHeight': 1080, 'everyNthFrame': 1})
        # keep the compositor producing frames even when the page is static
        await page.evaluate("""(() => { const d = document.createElement('div'); d.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:.01;z-index:99999;pointer-events:none';
          document.body.appendChild(d); let k=0; setInterval(()=>{d.style.background = (k++%2)?'#000':'#010101'}, 33); })()""")
        await page.wait_for_timeout(400)

        async def center(sel, nth=0):
            box = await page.locator(sel).nth(nth).bounding_box()
            return box['x'] + box['width'] / 2, box['y'] + box['height'] / 2

        async def move(sel, nth=0, ms=700, dx=0, dy=0):
            x, y = await center(sel, nth)
            await page.evaluate(f'__demo.move({x + dx},{y + dy},{ms})')
            await page.wait_for_timeout(ms + 80)

        async def click(sel, nth=0, ms=700):
            await move(sel, nth, ms)
            await page.evaluate('__demo.ripple()')
            await page.locator(sel).nth(nth).click()

        async def hover(sel, nth=0, ms=600):
            await move(sel, nth, ms)
            await page.locator(sel).nth(nth).hover()

        async def scroll(sel, offset=90, wait=900):
            await page.evaluate(f'__demo.scrollTo({json.dumps(sel)},{offset})')
            await page.wait_for_timeout(wait)

        async def scroll_top(wait=800):
            await page.evaluate('__demo.scrollTop()')
            await page.wait_for_timeout(wait)

        async def w(ms):
            await page.wait_for_timeout(ms)

        # -------------------- the storyboard --------------------
        async def s_intro():
            await w(500)

        async def s_problem():
            await page.evaluate(f'__demo.card({json.dumps(CARD_PROBLEM)})')

        async def s_home():
            await page.evaluate('__demo.hide()')
            await w(1500)
            await move('#msg', ms=900)
            await w(3500)
            await move('.privacy-pill', ms=900)
            await w(3000)
            await move('#exampleChips .chip', ms=800)

        async def s_bank():
            await click('.chip[data-id=bank]')
            await w(2600)
            await move('#scoreNum', ms=700)
            await w(3200)
            await move('#combos .combo', ms=700)

        async def s_annotate():
            await scroll('#annotated', offset=260)
            await hover('#annotated .hl', 0)
            await w(2600)
            await hover('#annotated .hl', 4)
            await w(2400)
            await hover('#annotated .hl.url')

        async def s_links():
            await page.mouse.move(5, 5)
            await scroll('#links', offset=170)
            await move('#links .link-url', ms=800)
            await w(4200)
            await move('#links .link li', nth=3, ms=700)
            await w(3800)
            await move('#links .link li', nth=0, ms=700)

        async def s_advice():
            await scroll('.advice-card', offset=380)
            await w(1600)
            await click('#copyReport')

        async def s_vietnamese():
            await scroll_top(900)
            await click('.chip[data-id=vi]')
            await w(3800)
            await scroll('#annotated', offset=200, wait=1000)
            await hover('#annotated .hl', 0)
            await w(2800)
            await page.mouse.move(5, 5)
            await scroll('#links', offset=200, wait=1000)
            await move('#links .link li', nth=1, ms=700)

        async def s_legit():
            await scroll_top(700)
            await click('.chip[data-id=legit]')

        async def s_typing():
            await click('#clearBtn', ms=600)
            await click('#msg', ms=500)
            await page.locator('#msg').press_sequentially(
                "Hi Mom, I dropped my phone, this is my new number. I need to pay a bill urgently, "
                "can you buy two Google Play gift cards and send me the codes? Don't tell Dad.", delay=28)
            await w(900)
            await move('#scoreNum', ms=700)

        async def s_train():
            await click('.tab[data-view=train]')
            await w(2200)
            await click('[data-answer=scam]')
            await w(3800)
            await click('#nextQ')
            await w(1200)
            await click('[data-answer=legit]')

        async def s_how():
            await click('.tab[data-view=how]')
            await w(1200)
            for i in range(4):
                await move('.step', nth=i, ms=700, dy=-40)
                await w(1300)
            await page.evaluate("window.scrollTo({top: 500, behavior: 'smooth'})")

        async def s_outro():
            await page.evaluate(f'__demo.card({json.dumps(CARD_OUTRO)})')

        board = {'intro': s_intro, 'problem': s_problem, 'home': s_home, 'bank': s_bank, 'annotate': s_annotate,
                 'links': s_links, 'advice': s_advice, 'vietnamese': s_vietnamese, 'legit': s_legit,
                 'typing': s_typing, 'train': s_train, 'how': s_how, 'outro': s_outro}

        timeline = []
        while not frames:
            await w(50)
        t0 = frames[0][0]
        await w(300)
        for s in segments:
            start = time.time()
            timeline.append({'id': s['id'], 'start': start - t0, 'dur': s['dur']})
            await board[s['id']]()
            remaining = start + s['dur'] + PAD - time.time()
            if remaining > 0:
                await w(int(remaining * 1000))
            else:
                print(f"WARNING segment {s['id']} overran narration by {-remaining:.2f}s")
        await w(1500)
        end = time.time()
        await cdp.send('Page.stopScreencast')
        await browser.close()
    srv.shutdown()

    lines = []
    for i, (t, name) in enumerate(frames):
        nxt = frames[i + 1][0] if i + 1 < len(frames) else end
        lines.append(f"file 'frames/{name}'\nduration {max(0.001, nxt - t):.4f}")
    lines.append(f"file 'frames/{frames[-1][1]}'")
    (BUILD / 'frames.txt').write_text('\n'.join(lines), encoding='utf-8')
    (BUILD / 'timeline.json').write_text(json.dumps({'total': end - t0, 'segments': timeline}, indent=1))
    print(f'{len(frames)} frames, {end - t0:.1f}s, avg fps {len(frames) / (end - t0):.1f}')


asyncio.run(main())
