# EagleVision Design Spec

Status legend: `Draft` -> `Approved` -> `Implemented`

## 1. Principles
_TBD (from research: audience = students/teachers, projected on classroom screens, low-end Chromebooks, dim rooms around microscopes)._

## 2. Color tokens
Current tokens (for reference, to be replaced):

| Token | Current | New | Role | Contrast notes | Status |
|-------|---------|-----|------|----------------|--------|
| `--bg-dark` | `#0a0f1c` | | page background | | Draft |
| `--bg-panel` | `#161b2e` | | panels/cards | | Draft |
| `--accent` | `#FFD700` | | primary accent | | Draft |
| `--text` | `#ffffff` | | body text | | Draft |
| `--danger` | `#ff4444` | | errors/destructive | | Draft |
| `--success` | `#44FF44` | | success | | Draft |

Add rows for any new tokens (secondary accent, borders, muted text, focus ring, annotation colors, etc.).
Every text/background pair must list its WCAG contrast ratio (AA >= 4.5:1 body, 3:1 large/UI).

## 3. Typography
_Font families, scale, weights, line-height._

## 4. Spacing, radius, elevation
_Scale and tokens._

## 5. Components
_Buttons, inputs, cards, nav, activity bar, side panel, annotation toolbar, Eagle AI panel, modals._

## 6. Per-page changes
| Page | File(s) | Changes | Status |
|------|---------|---------|--------|
| Homepage | `index.html`, `landing.css` | | Draft |
| About | `about.html`, `landing.css` | | Draft |
| Enter code | `session.html` | | Draft |
| Workspace | `workspace.html`, `style.css`, `script.js` | | Draft |
| Host | `host.html`, `host.js`, `style.css` | | Draft |

## 7. Rollout
1. Phase 1 — `tokens.css` + replace hardcoded hexes (no visual change except new palette).
2. Phase 2 — migrate inline styles to classes.
3. Phase 3 — typography + spacing.
4. Phase 4 — component restyle + page layouts.
5. Phase 5 — cleanup, a11y pass, README/CLAUDE.md update.

## 8. Constraints (from CLAUDE.md — do not violate)
No build step; no `position: fixed` bottom-anchored mobile UI; no secrets in repo; service worker stays network-first.
