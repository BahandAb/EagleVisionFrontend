# EagleVision Design Overhaul

Single source of truth for the color/typography/layout overhaul. Written by
humans + Claude from the team's color-theory research (originally scattered
across Discord). **Nothing here is implemented until it is marked `Approved`
in `SPEC.md`.**

## Files

| File | Purpose |
|------|---------|
| `SPEC.md` | The organized spec. Tokens, type, spacing, components, per-page changes. |
| `DECISIONS.md` | Resolved/open questions and conflicts between Discord messages. |
| `SUMMARY.md` | One-paragraph status from the extraction pass: what is solid vs. needs team input. |
| `SOURCES.md` | Raw-ish extraction log: every Discord claim -> who/when (if known) -> where it landed in the spec. |
| `reference/` | Reference images. Name them `NN-page-or-topic.png` (e.g. `01-palette.png`, `02-workspace-dark.png`) and list each in `SOURCES.md`. |

## Workflow

1. Extraction chat fills `SOURCES.md`, then `SPEC.md` and `DECISIONS.md`.
2. Team resolves open items in `DECISIONS.md`.
3. Implementation happens in phases (see "Rollout" in `SPEC.md`), tokens first.

## Current CSS architecture (what the overhaul touches)

- `style.css` is loaded by **every** page, including the landing pages. It
  owns the `:root` tokens (`--bg-dark`, `--bg-panel`, `--accent`, `--text`,
  `--danger`, `--success`) plus the workspace/host/session styles.
- `landing.css` is loaded only by `index.html` and `about.html`, on top of
  `style.css`. It uses the `:root` tokens from `style.css` but also hardcodes
  many hex values (~58) of its own. `style.css` has ~23 hardcoded hexes.
- Body classes: `home-body` (index, about), `landing-body` (session.html —
  the *code-entry* page, despite the name), none (host, workspace).
- Heavy inline `style="..."` use: workspace.html (80), host.html (11),
  session.html (10), index.html (7), about.html (4). These bypass any token
  change and must be migrated to classes as part of the overhaul.
- Fonts: system stack `'Segoe UI', Roboto, sans-serif`; icons are Google
  Material Icons (CDN).

So `style.css` is **not** workspace-only: tokens defined there reach the
homepage too. Phase 1 should move tokens to a dedicated `tokens.css` loaded
first by every page.
