import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'tools' / 'thumbnail.html').as_uri()
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, w, h in [('thumbnail.png', 1500, 1000), ('thumbnail-16x9.png', 1280, 720)]:
        pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1 if w == 1500 else 1.5)
        pg.goto(src); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(500)
        pg.screenshot(path=str(root / 'screenshots' / name))
    b.close()
