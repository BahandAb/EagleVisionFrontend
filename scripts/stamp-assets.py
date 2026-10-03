#!/usr/bin/env python3
"""Stamp ?v=<content-hash> onto every local .css/.js reference in the HTML pages.

GitHub Pages serves everything with Cache-Control: max-age=600, so after a deploy a browser can
mix NEW html with 10-minute-old CSS/JS (broken layout until a hard refresh). A content hash in the
URL makes the browser fetch a changed file immediately and keep unchanged ones cached.

Run from the repo root after changing any .css/.js file (idempotent):
    python3 scripts/stamp-assets.py
"""
import glob
import hashlib
import os
import re

PAGES = glob.glob("*.html")
REF = re.compile(r'((?:href|src)="(?!https?:|//)([^"?#]+\.(?:css|js)))(?:\?v=[0-9a-f]+)?"')


def digest(path):
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


changed = 0
for page in PAGES:
    src = open(page, encoding="utf-8").read()

    def stamp(m):
        path = m.group(2)
        if not os.path.exists(path):
            return m.group(0)
        return f'{m.group(1)}?v={digest(path)}"'

    out = REF.sub(stamp, src)
    if out != src:
        open(page, "w", encoding="utf-8").write(out)
        changed += 1
        print("stamped", page)
print(f"{changed} page(s) updated")
