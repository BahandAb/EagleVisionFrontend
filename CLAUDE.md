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
| `style.css` | Shared workspace/host styles (dark theme, CSS vars) |
| `landing.css` | Landing/about page styles |
| `sw.js` | Service worker (see gotcha below) |

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
   offline-only fallback (`sw.js`). Don't revert to cache-first.
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

## Deferred / discussed but not built

- Real per-user auth for Eagle AI (currently shared tier passwords, chosen
  deliberately over a bigger auth system for now).
- A Python sandbox / custom-tools feature — discussed, explicitly deferred.
