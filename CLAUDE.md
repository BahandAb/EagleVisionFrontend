# EagleVision Frontend — Notes for Claude

Static site (no build step) deployed to **eaglevision.dev** via GitHub Pages.
This repo is **public** — never commit real secrets, passwords, or API keys
here (see "Security" below).

## Pages

| File | Role |
|------|------|
| `index.html` / `about.html` | Landing pages |
| `session.html` → `workspace.html` | Student flow: enter a code, then the collaboration workspace (video + annotations + Eagle AI) |
| `host.html` + `host.js` | Instructor flow: camera setup, live framing, admin controls |
| `tokens.css` | **All design tokens** (colors, layout vars). Loaded FIRST by every page. Never hardcode hex elsewhere; add a token |
| `style.css` | Loaded by every page (incl. homepage). Workspace/host/session styles; uses tokens only |
| `themes.css` | Workspace color themes (`<html data-theme>`), workspace.html only. Light themes use dark text; re-audit contrast after any change |
| `fonts.css` + `assets/fonts/` | Self-hosted Fredoka/Poppins (OFL). Only index/about/session load them; don't swap to Google Fonts |
| `host.css` | Host page styles (was an inline `<style>` in host.html) |
| `landing.css` | Homepage/about-only styles, layered on top of `style.css`; also hardcodes many hexes |
| `sw.js` | Service worker (see gotcha below); only registered from `index.html` |
| `docs/design/` | Design-overhaul spec (`SPEC.md`, `DECISIONS.md`, `SOURCES.md`, `reference/` images). Read before any visual change |

Marketing pages (index/about) use the light-blue `--mk-*` palette; the host page keeps its own dark `--host-*` tokens; the workspace uses the app tokens. Don't mix them. Contrast was audited with a script (WCAG AA) — re-run an equivalent check after color changes.

Body classes: `home-body` = index/about, `landing-body` = `session.html` (the
code-entry page, despite the name), none = host/workspace.

The mobile app repo (`BahandAb/EagleVisionMobileApp`) is **deprecated** —
still works, but don't spend effort on it or keep it in design parity.

Backend is a separate private repo, `BahandAb/EagleVisionBackend` (Flask +
Socket.IO + LiveKit token issuer + Gemini AI proxy), reachable at
`api.eaglevision.dev`. Deployed on an Oracle Cloud free-tier VM.

## Host framing system (host.js)

`#host-canvas` is a **direct-manipulation view**: it always renders exactly
the current crop region (`cropRect = {cx, cy, size}`, normalized fractions
of the source video), filled edge to edge. What the host sees IS what gets
published — there's no separate "preview vs. published" state.

- **Pan** = single-finger drag or mouse drag. Content follows the finger
  (Photos/Maps convention) — dragging right reveals what was off-screen to
  the left, i.e. the crop center moves the *opposite* way from the raw
  cursor delta.
- **Zoom** = two-finger pinch, or mouse wheel for desktop. `size` ranges
  `[0.08, 1.0]`; `1.0` is the full centered square (the largest
  non-stretched square available from the source).
- Default crop (`size: 1.0`, centered) is always applied even with zero
  host interaction — most microscope cameras aren't natively square (or
  even 16:9), so a naive `drawImage` stretch was the original bug.
- "Adjust Framing" just toggles `framingMode` (gates whether drag/pinch/
  wheel do anything) and adds a `framing-mode` class for the accent-ring
  visual cue — it does not turn cropping on/off.

## Eagle AI (script.js)

Access is a two-tier password gate (`basic`/`pro`), but **the frontend never
holds a real password**. `unlockEagleAI()` posts whatever the user types to
the backend's `POST /api/ai/verify-password` and trusts its `{tier}`
response. Do not reintroduce hardcoded `EAGLE_BASIC_PASSWORD`-style consts —
this repo is public and it happened once already (passwords were live in
`script.js` and the README in cleartext for months).

## Security

- No API keys, passwords, or tokens in this repo, ever — not even as
  "demo" values in the README. It's public.
- Real access passwords live only in the backend's `.env` on the Oracle VM.

## Gotchas learned the hard way

1. **Service worker must be network-first, not cache-first.** `sw.js`
   previously did `caches.match(req).then(c => c || fetch(req))` keyed on a
   hand-bumped `CACHE_NAME`. Any device that had visited once kept serving
   stale `host.html`/`script.js`/etc. forever, regardless of what shipped —
   this repo's history has several "bump cache to v3/v4" band-aid commits
   before it was actually fixed. It's now network-first with cache as an
   offline-only fallback (`sw.js`). Don't revert to cache-first. It also
   only handles same-origin GETs and only caches `response.ok` — don't
   widen that (it used to cache 404s/opaque CDN responses).
2. **Never use `position: fixed` for bottom-anchored mobile UI.** Android
   Chrome's own bottom toolbar (and the OS nav bar) can render on top of a
   fixed-bottom element, making it visible but untappable. Use normal flex
   flow with `order` instead (see `workspace.html`'s activity bar, and
   `host.html`'s post-fix version) — it stays inside the properly
   `100dvh`-sized container instead of fighting the raw viewport.
3. **Camera aspect ratios are never a safe assumption.** Don't `drawImage`
   a raw source into a differently-shaped destination without an explicit
   crop/letterbox step — it silently stretches. Default to a centered
   square crop of the smaller source dimension.
4. **When testing touch/pinch gestures with Playwright, dispatch real
   `TouchEvent`/`Touch` objects at the DOM level** (`element.dispatchEvent
   (new TouchEvent(...))`), not direct calls to the handler functions. A
   direct-call test validated the math but missed that the visible canvas
   content never actually changed on-screen — which is exactly what a real
   user reported as "not responsive at all." Also diff actual pixel data
   before/after, not just internal state.
5. Chromium's `--use-fake-device-for-media-stream` is useful for camera
   testing, but it honors whatever resolution you request almost exactly —
   override `getUserMedia` via `page.addInitScript` to force an `exact`
   mismatched resolution (e.g. 640×480) if you need to test aspect-ratio
   bugs realistically.

## Design overhaul (in progress)

A team-researched color/typography overhaul is being specified in
`docs/design/`. Until a spec item is marked `Approved`, don't restyle on
your own. When implementing: `tokens.css` exists (Phase 1 done); no new hardcoded
hexes (`--gray-*` is the neutral ramp, one-off component colors are named by role in `tokens.css`; JS reads colors via `cssVar('--token')`), and move inline `style="..."`
into classes (done for static HTML; only JS-toggled `display:none` stays inline,
and a few JS-generated style strings in script.js/host.js remain). Inline styles
beat class rules, so new variant classes use compound selectors
(`.btn-leave.btn-danger`) — and note Google's `.material-icons` loads after
style.css, hence `.material-icons.icon-16`. Verify style refactors with a
computed-style diff over all elements, not just screenshots.

## Known weaknesses (audit, not yet fixed)

- `style.css` is shared by every page and its `body { overflow: hidden }`
  has to be overridden by `.home-body`. (Tokens are now split out into `tokens.css`.)
- `landing.css?v=8` is hand-bumped cache busting — the same trap as the old
  `CACHE_NAME` problem. Prefer relying on the network-first SW, or make
  version strings part of a deploy step.
- `_headers` (Netlify/Cloudflare syntax) has **no effect on GitHub Pages**;
  Pages serves `max-age=600`. Don't rely on it for no-cache guarantees.
- The SW is only registered on `index.html`, so a user landing directly on
  `workspace.html`/`host.html` never gets it (no offline fallback, and the
  SW only starts controlling those pages after a visit to the homepage).
- `workspace.html` loads `opencv.js` (~10 MB) from docs.opencv.org on every
  visit and `livekit-client` from jsDelivr with no SRI hash. Consider
  lazy-loading opencv only when the feature is used, and self-hosting/SRI.
- Only 2 `@media` blocks in `style.css` and 7 in `landing.css`; no
  `prefers-reduced-motion`. Mobile/accessibility coverage is thin — the
  overhaul spec must include a contrast/a11y pass.
- Large unoptimized JPEG/PNG assets (~7 MB total in `assets/`) hurt first
  load on school Wi-Fi; convert to WebP/resize when touching them.
- README still describes things (e.g. admin-key flow) that should be
  re-verified against the code after the overhaul.

## Workspace themes

`script.js` (`applyTheme/setTheme/setThemesLocked`) + `themes.css`. The host can lock themes for students over the socket (`admin_set_themes_locked`; backend must be deployed for this to work — without it students simply stay unlocked). `.btn-leave` etc. use `transition: all .3s`, so measure computed colors only after transitions finish or contrast audits will report false failures.

## Deferred / discussed but not built

- Real per-user auth for Eagle AI (currently shared tier passwords, chosen
  deliberately over a bigger auth system for now).
- A Python sandbox / custom-tools feature — discussed, explicitly deferred.
