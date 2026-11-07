import sys, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
url = (root / 'index.html').as_uri()
out = root / 'screenshots'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(800)
    pg.screenshot(path=str(out / '0-home.png'))
    pg.click('.chip[data-id=bank]'); pg.wait_for_timeout(1500)
    pg.screenshot(path=str(out / '1-analysis.png'))
    pg.screenshot(path=str(out / '2-analysis-full.png'), full_page=True)
    pg.click('.chip[data-id=vi]'); pg.wait_for_timeout(1500)
    pg.screenshot(path=str(out / '3-vietnamese.png'), full_page=True)
    pg.click('.tab[data-view=train]'); pg.wait_for_timeout(500)
    pg.click('[data-answer=scam]'); pg.wait_for_timeout(600)
    pg.screenshot(path=str(out / '4-quiz.png'))
    pg.click('.tab[data-view=how]'); pg.wait_for_timeout(500)
    pg.screenshot(path=str(out / '5-how.png'))
    print('errors:', errs)
    b.close()
