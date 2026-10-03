# SPEC.md

Every item in this file is **Draft**. Values marked "(sampled from image N)" were read from the PNG with code. Values from Discord are marked "(msg N)". Anything with a D number is unresolved; see DECISIONS.md. Measurements are in CSS px at the mockup's resolution (1366x768 unless stated).

## 1. Principles (Draft)

From the project brief (not stated in the research messages):
- P1. Used on classroom projectors, school Chromebooks, and phones, often in dim rooms next to microscopes. Dark app surfaces, high contrast text, large touch targets.
- P2. Plain HTML/CSS/JS, no build step. All colors and sizes are CSS variables (custom properties declared on :root).

Inferred from the reference images (confirm, see D16, D19, D20):
- P3. Friendly, kid-oriented look: eagle mascot, rounded headline type, pastel decorations (clouds, stars, flowers), flat colored icons.
- P4. Workspace keeps a dark canvas (#1e1e1e) so the microscope feed is the brightest thing on screen; color goes on the chrome (bars and panels).
- P5. Workspace supports user-selectable color themes that a teacher can disable (images 15 to 17).

## 2. Color tokens (Draft)

Contrast = WCAG 2.x ratio. AA thresholds: 4.5:1 body text, 3:1 large text (24px, or 18.66px bold) and UI parts/icons. FAIL marks anything under its threshold.

### 2a. Workspace, theme 1 (default)

| Token | Current | New hex | Role | Contrast notes |
|---|---|---|---|---|
| --bg-dark | #0a0f1c | #1e1e1e (msg 5; matches image 14) | Workspace and enter-code page background | #ffffff 16.67 |
| --bg-topbar | none | #202642 (msg 1) or #1e253f (sampled from image 14), D1 | Top bar | #ffffff 14.82 / 15.09; --text-muted #898989 4.31 FAIL |
| --bg-rail | none (maybe replaces --bg-panel, D31) | #171717 (msg 2; matches image 14) | Left icon rail | Rail icons #686868 3.22 pass; "EAGLE AI" label #626262 2.94 FAIL; pen icon handle #4d402b 1.78 FAIL (D21); roster #8882d8 5.32 |
| --bg-rail-active | none | #252019 (sampled from image 14) | Background of active rail tab | Pen icon tip #88704f 3.45; handle #4d402b 1.60 FAIL |
| --rail-active-indicator | none | #f9ebb4 (sampled from image 14) | 3px stripe on left edge of active rail tab | 15.00 vs #171717. Possibly the "yellow selection" in msg 12, D7 |
| --bg-panel | #161b2e | #1b4a71 (msg 3; matches image 14) | Side panel (drawing tools etc.) | #ffffff 9.27 |
| --bg-toolcol | none | #003e62 (msg 4; matches image 14) | Right tool column | #ffffff icons 11.26; pencil icon #edd67c 7.78; snapshot icon grays #4e4e4e 1.35 / #616161 1.82 FAIL (D21) |
| --select-toolcol | none | #2f84b6 (msg 7; matches image 14) | Selected tool circle in right column | White icon on it 4.12 pass (UI); circle vs column 2.73 FAIL (D24) |
| --bg-code | none | #27486c (msg 8) or #25486c (sampled from image 14), D2 | Session code chip in top bar | #ffffff 9.42 / 9.45 |
| --bg-scope-empty | none | #3d3d3d (msg 6; matches image 14) | Empty microscope area | vs --bg-dark 1.53 (boundary carried by --border-scope) |
| --border-scope | none | #697076 (sampled from image 14) | 2px frame around microscope area | 3.32 vs #1e1e1e pass |
| --border-control | none | #586875 (sampled from image 14) | Outline of panel action buttons | 1.61 vs #1b4a71 FAIL (D25) |
| --border-divider | none | approx #435562 (sampled from image 14; 1px antialiased line, ambiguous) | Divider under panel header | Decorative, no requirement |
| --border-topbar-btn | none | #3b3c42 (sampled from image 14; antialiased, ambiguous) | Exit button outline | Not measured reliably |
| --bg-stroke-btn | none | #3d3d3d (sampled from image 14) | Stroke thickness option | 1.17 vs #1b4a71 FAIL (D25) |
| --bg-stroke-btn-selected | none | #787878 (sampled from image 14) | Selected stroke option | 2.10 vs #1b4a71. Its 1px border samples as #b0aa96 / #b5bda9 (antialiased, yellowish, exact hex ambiguous, D7) |
| --text | #ffffff | #ffffff | Primary text, icons on dark | See per-background values |
| --text-label | none | #ffffff assumed; small antialiased text peaks at #f1f0ef to #fbf8f5 (sampled from image 14) | Panel section labels (DRAW COLOR etc.) | 8.15 to 9.27 vs #1b4a71 |
| --text-secondary | none | approx #d8d6d5 (sampled from image 14; antialiased, ambiguous) | Panel header "DRAWING TOOLS", panel button text | 6.40 vs #1b4a71 |
| --text-muted | none | #898989 (sampled from image 14, EXIT) | De-emphasized text | 4.31 vs #1e253f FAIL for small text (D26) |
| --accent | #FFD700 | #fdd257 (msg 12; also image 7/8 buttons) | Yellow accent, selection, primary buttons | On #1e253f 10.44; #1b4a71 6.42; #577092 3.51 FAIL for text (D17) |
| --glow-selected | none | #ffffff (msg 13); images show the glow in the swatch's own color (red glow on red), D8 | Glow on selected swatch/tool | White glow on white swatch is invisible (D8) |
| --disabled-fill | none | #cecece (sampled from image 17) | Grayed theme-picker bubble | Message text #ffffff on #1b4a71 9.27 |
| --draw-red | none | #e84e53 (msg 10) | Annotation color | Image 14 renders #e84e52 (1 off, rounding). vs --bg-scope-empty 2.92 FAIL; vs #1e1e1e 4.48 |
| --draw-yellow | none | #fdd257 (msg 10) | Annotation color | vs #3d3d3d 7.52 |
| --draw-green | none | #adf66d (msg 10) | Annotation color | vs #3d3d3d 8.37 |
| --draw-blue | none | #5dd8ff (msg 10) | Annotation color | vs #3d3d3d 6.59 |
| --draw-white | none | #ffffff (msg 10) | Annotation color | vs #3d3d3d 10.86 |
| --filter-label-r | none | #e84e53 (msg 11) | Red filter slider label text | vs #1b4a71 2.49 FAIL (D9) |
| --filter-label-g | none | #adf66d (msg 11) | Green filter slider label text | vs #1b4a71 7.14 |
| --filter-label-b | none | #5dd8ff (msg 11) | Blue filter slider label text | vs #1b4a71 5.62 |
| --danger | #ff4444 | no source, D23 | Errors, destructive actions | vs #1e1e1e 4.89; vs #1b4a71 2.72 FAIL |
| --success | #44FF44 | no source, D23 | Success states | vs #1e1e1e 12.41 |
| --focus-ring | none | TBD, D22 | Keyboard focus outline | Must reach 3:1 against every surface it sits on |

### 2b. Workspace, theme 2 (pink, sakura) (all sampled from image 15)

| Token | Theme 1 value | Theme 2 hex | Contrast notes |
|---|---|---|---|
| --bg-topbar | see 2a | #82295b | #ffffff 8.69 |
| --bg-code | see 2a | #a44d76 | #ffffff 5.38 |
| --bg-topbar-btn | #1e253f | #7c2b57 | Exit text #dfe2e0 6.88 |
| --bg-panel | #1b4a71 | #d889a9 | #ffffff 2.60 FAIL; --filter-label-r 1.43 FAIL (D12) |
| --bg-swatch-row | #194a71 | #de87a9 | Faint highlight band behind swatches |
| --bg-toolcol | #003e62 | #e18ca6 | #ffffff 2.47 FAIL |
| --select-toolcol | #2f84b6 | #bb6c84 | #ffffff icon 3.76 |
| --bg-stroke-btn / selected | #3d3d3d / #787878 | #9f9f9f / #c2c2c2 | |
| --border-control | #586875 | #c9aeb9 | |
| --bg-decor | none | #2b2b2b sakura shapes on #1e1e1e | 1.18 vs bg (decorative) |
| --bg-rail, --bg-dark, --bg-scope-empty, --draw-* | | unchanged | |

Image 15 also shows a navy edge (#083e62) on the right column border, likely left over from theme 1 (D36).

### 2c. Workspace, theme 3 (blue, teal, olive, stars) (all sampled from image 16)

| Token | Theme 1 value | Theme 3 hex | Contrast notes |
|---|---|---|---|
| --bg-topbar | see 2a | #4468ad | #ffffff 5.48 |
| --bg-code | see 2a | #3c72b0 | #ffffff 4.97 |
| --bg-topbar-btn | #1e253f | #4468a1 | Exit text #f7f5f3 high |
| --bg-panel | #1b4a71 | #82b8b0 | #ffffff 2.23 FAIL; --filter-label-r 1.67 FAIL (D12) |
| --bg-swatch-row | #194a71 | #80bbb4 | |
| --bg-toolcol | #003e62 | #9caf7a | #ffffff 2.38 FAIL |
| --select-toolcol | #2f84b6 | #efae6a | #ffffff icon 1.92 FAIL (D12) |
| --bg-stroke-btn / selected | #3d3d3d / #787878 | #a6a6a6 / #c6c6c6 | |
| --border-control | #586875 | #afc1be | |
| --bg-decor | none | #2b2b2b star shapes on #1e1e1e | 1.18 vs bg (decorative) |

Theme picker (eagle speech bubble, image 14) swatches sample as #3084b6, a pink, and a teal; exact values ambiguous at that size.

### 2d. Marketing pages (homepage) (sampled from images 7 and 8)

| Token | Current | New hex | Role | Contrast notes |
|---|---|---|---|---|
| --mk-nav-bg | none | #1d253f (sampled from image 7) | Homepage nav bar | #ffffff 15.12. 1 step off the workspace top bar (D1) |
| --mk-bg | none | #577092 (sampled from images 7, 8) | Hero and section background | #ffffff 5.07 (D16) |
| --mk-card | none | #4b6280 (sampled from image 8) | "Who it's for" cards | #ffffff 6.25 |
| --mk-text-body | none | #c6c6c6 (sampled from image 7) | Hero paragraph | 2.97 vs #577092 FAIL |
| --mk-text-fine | none | #b0b5bc (sampled from image 7; small text, ambiguous) | "Patent Pending" | 2.46 FAIL |
| --mk-hl-green | none | #b7cd92 (sampled from image 7) | "Microworld" headline word | 2.94 FAIL even as large text |
| --mk-hl-teal | none | #94bfc8 (sampled from image 8) | "Every" headline word | 2.55 FAIL |
| --mk-hl-pink | none | #ff8cb2 (sampled from image 8) | "Medical Ed." card title | 2.87 vs #4b6280 FAIL |
| (accent on card) | | #fdd257 | "College Labs" card title | 4.33 vs #4b6280, passes as large text |
| --mk-btn-text | none | #577092 (sampled from image 7) | Text on yellow hero buttons | 3.51 vs #fdd257 FAIL at button size |
| --mk-btn-text-nav | none | #194a71 (sampled from image 7) | Text on nav "Join Session" button | 6.43 vs #fdd257 |
| Decor colors | none | stars #fabdd1, #81bab4, #8fe4ff, #b3adff; tiles #b7ce92, #c8a6df, #f1b385; cross #ed5a5e; clouds #ffffff (sampled from images 7, 8) | Illustrations | Decorative, no requirement |
| Logo colors | none | microscope #6fb2c5, speed bars #fcd259 (sampled from image 14), wordmark #ffffff | Logo | |

### 2e. Enter-code page (sampled from image 6, 1894x912)

| Token | Current | New hex | Role | Contrast notes |
|---|---|---|---|---|
| --bg-dark | #0a0f1c | #1e1e1e | Background | |
| --bg-decor-wedge | none | #252525 | Diagonal wedge shapes | 1.09 vs bg (decorative) |
| --join-card | none | #27496e | Card | #ffffff 9.27. Near-duplicate of --bg-code (D4) |
| --join-card-border | none | #6b7075 | Card and input borders | 1.85 vs #27496e |
| --join-input | none | #487099 | Input fill | Text/placeholder #ffffff 5.18. Fill vs card 1.79 FAIL as boundary (D25) |
| --join-btn | none | #f6d46c | Join button | Text #27496e 6.43. Differs from --accent #fdd257 (D6) |
| --join-text-muted | none | #9fa2a7 (small text, antialiased) | "I am the instructor." | 3.62 FAIL (D26) |

### 2f. Icon palette (Draft)

Rail and tool icons are flat color illustrations (images 1 to 3, 9 to 12), not single-color Material Icons. See D20 and D21. Colors are listed in SOURCES.md.

## 3. Typography (Draft)

No typography was specified in the messages. Observations only:

| Use | Family (visual match, unconfirmed, D19) | Size | Weight / case | Line height | Source |
|---|---|---|---|---|---|
| Marketing display (H1/H2) | Rounded geometric sans (resembles Fredoka) | approx 52 to 58px | Bold | approx 1.1 | images 7, 8 |
| Card titles (College Labs etc.) | Same rounded display | approx 32px | Bold | | image 8 |
| Body, nav, buttons, eyebrows | Geometric sans (resembles Poppins) | Body approx 15 to 16px; nav approx 15px; eyebrow approx 14px; buttons approx 12px | Body regular; nav, eyebrow, buttons bold uppercase | Body 26px (measured line spacing, image 7, 8) | images 6, 7, 8 |
| Enter-code inputs | Geometric sans | approx 24px | Regular, uppercase placeholder | | image 6 |
| Workspace panel labels and buttons | Appears to be the current system sans (Segoe UI / Roboto) | Labels approx 12px; header approx 13px | Bold uppercase, letter-spaced | | image 14 |
| Session code | Light sans, wide tracking | approx 26px | Light | | image 14 |

All sizes are estimates from glyph heights, about ±2px.

## 4. Spacing, radius, elevation (Draft)

Measured from image 14 (1366x768):
- Top bar height: 56px.
- Left rail width: 58px. Active tab has 3px left stripe.
- Side panel width: approx 305px, inner left padding approx 19px.
- Draw-color swatches: approx 42px circles on approx 51px centers; selected swatch drawn larger (approx 52px) with glow.
- Stroke buttons: approx 82x30px, three in a row.
- Panel action buttons: approx 265x40px, full panel width.
- Exit button: approx 73x40px. Code chip: approx 112x40px.
- Right tool column: approx 71px wide, fully rounded ends (pill). Selection circle approx 46px.
- Microscope area: approx 528x557px, centered in remaining space.

From image 6 (1894x912): card approx 532x570px; inputs approx 394x80px; button approx 394x67px; vertical gap between inputs approx 22px.
From images 7, 8: content left edge 200px; hero buttons approx 165x40px; "Who it's for" cards approx 317x340px with approx 18px gaps.

Radius (visual estimates): enter-code card approx 30px; inputs and buttons approx 4 to 6px; homepage cards approx 10px; microscope area approx 6px; workspace panel buttons approx 2 to 3px; right column fully rounded. D34 covers whether to standardize these.

Elevation (shadow depth): none visible in any mockup. Design is flat. Only effect is the selection glow (D8).

## 5. Components (Draft)

Only default and selected states appear in the images. Hover, focus, pressed, and disabled states are not defined for any component (D22).

- **Buttons.** Primary: filled --accent, dark text, bold uppercase (images 6, 7). Secondary (homepage): transparent with 3 to 4px --accent border and --accent text (image 7; text contrast FAIL, D17). Panel action buttons (workspace): transparent, 1px --border-control, --text-secondary bold uppercase (image 14; border FAIL, D25). Ghost (Exit): top bar bg, thin border, --text-muted (D26).
- **Inputs (enter-code).** Fill --join-input, 1px --join-card-border, centered white uppercase placeholder (image 6). Placeholder and typed text look identical (D29).
- **Cards.** Homepage: --mk-card, no border, approx 10px radius, mascot art clipped to the bottom edge (image 8). Enter-code: --join-card, 1px border, mascot overlapping the top edge (image 6).
- **Nav (homepage).** --mk-nav-bg, logo left, centered white bold uppercase links (Use cases, How it works, About, Contact), yellow Join Session button right (image 7).
- **Top bar (workspace).** --bg-topbar, logo left, session code chip and Exit button right (image 14).
- **Activity bar / left rail.** --bg-rail. Icons top to bottom: drawing tools (image 10), color controls (image 1), gallery (image 3), Eagle AI (mascot with "EAGLE AI" label), roster (image 11), settings (gear). Bottom: "<>" icon (purpose unknown, D33). Active tab: --bg-rail-active plus --rail-active-indicator stripe. Name mapping, D27.
- **Side panel.** --bg-panel. Header with small icon, uppercase title, divider. Drawing tools tab contains: Draw color (5 swatches), Stroke thickness (3 options), Actions (Clear my screen, Hide/show annotations), then theme picker (mascot with speech bubble of 3 theme dots, selected dot shows a check). Other tabs have no reference (D31).
- **Annotation toolbar / right tool column.** --bg-toolcol pill. Top to bottom: pan (selected in all mockups), divider, pencil, eraser, text, counter (image 2), divider, pause, snapshot (image 12). Selected tool: --select-toolcol circle. Name mapping, D28.
- **Theme picker.** In side panel (image 14). When teacher disables it: message "Your teacher has disabled this feature." in white above, bubble turns --disabled-fill and dots desaturate (image 17). D11, D15.
- **Filter sliders.** Label colors per msg 11. Layout not shown (D10).
- **AI panel.** No reference. Rail has an "EAGLE AI" tab, so it presumably lives in the side panel (D31).
- **Modals.** No reference (D31).

## 6. Per-page changes (Draft)

- **Homepage (images 7, 8).** Replace dark background with --mk-bg #577092 and nav --mk-nav-bg (D16). Hero: yellow eyebrow "LIVE MICROSCOPY STREAMING", two-line rounded headline with one word in --mk-hl-green, gray body paragraph, "Patent Pending", three buttons (Join Session filled; Host Session and Get Access for Your School outlined). Product photo in white rounded frame right; mascot peeking from right edge; white clouds and pastel stars. "Who it's for" section: yellow eyebrow, headline with one teal word, three cards with mascot art. Multiple contrast failures (D17). Phone layout not shown (D35).
- **About.** No reference. Inherit homepage tokens? (D31)
- **Enter-code (image 6).** --bg-dark with --bg-decor-wedge diagonals. Centered card with mascot over the top edge, logo, tagline "Connect to a live microscope session.", Code input, Your name input, "I am the instructor." (D30), Join Session button in --join-btn.
- **Workspace (images 14 to 17).** Layout: top bar, left rail, side panel, dark canvas with centered microscope area, floating right tool column. Theme 1 colors per msgs 1 to 10. Themes 2 and 3 recolor top bar, code chip, side panel, tool column, and selection, and add background decoration (D11, D12). Teacher can disable theme switching (D15).
- **Host.** No reference (D31).

## 7. Rollout (Draft)
1. **Phase 1 (Implemented):** `tokens.css` is loaded first by every page; `:root` removed from `style.css`. Every hardcoded hex in CSS/HTML/JS is now a token; neutrals and one-offs keep their exact old values (`--gray-*`, `--legacy-*`). Workspace adopts the new palette (D1-D8 defaults); homepage and enter-code keep the old navy under `--mk-*` (only the yellow changed to #fdd257). Draw swatches use `--draw-*` tokens. Not yet done: borders/inactive states, glow (D8), canvas/scope colors, layouts. Original text: `tokens.css` loaded first by every page; replace hardcoded hexes (resolve D1-D6 first).
2. **Phase 2 (Implemented):** every static inline `style=` is now a class (only JS-toggled `display:none` state remains inline); host.html's `<style>` block moved to `host.css`. Verified with a computed-style diff of every element on all 5 pages (0 unintended differences). Also landed from Phase 4: scope square (#3d3d3d + 2px #697076 frame), `--bg-dark` canvas, blue tool selection circle, rail active bg, stroke buttons, white swatch glow + check marker (D8), session-code chip, lighter control borders (`--border-control` #7f97a8, D25), `--text-muted` #a0a0a0 (D26), red filter label text #ff9a9d (D9). Remaining Phase 2 debt: inline styles generated in JS strings (script.js, host.js).
3. **Phase 3 (Implemented, typography only):** D19 resolved as option A+C: Fredoka (display) and Poppins (body/UI) are self-hosted in `assets/fonts/` (woff2, latin subset, OFL licenses included, `font-display: swap`, loaded via `fonts.css` by index/about/session only); workspace and host keep the system stack (`--font-ui`). Tokens: `--font-display/-body/-ui/-mono`, `--fs-*`, `--lh-*`. Marketing headings use Fredoka 600/700 (no more 900 weight/negative tracking), body is Poppins 16px/1.65. Spacing and radius scales (D34) are deferred to Phase 4, where the restyled components will define them.
4. **Phase 4 (Implemented for enter-code + homepage/about; workspace done in Phase 2):** Enter-code: `#1e1e1e` background with two diagonal `#252525` wedges, `#25486c` card (30px radius, `#6b7075` border), `#487099` inputs with a readable placeholder (D29), yellow button with navy text; mascot omitted (image files 04/05 not in the repo yet, D32). Homepage/About: `--mk-*` tokens retuned to the light-blue palette (`#577092` bg, `#4b6280` cards, `#1e253f` nav/footer, white outline buttons with yellow border, headline accent words via `.hl-*`). Contrast fixes (D17): body `#f1f4f8` (4.6:1), yellow small text `#fff5c8`, button text `#1e253f` (10.4:1), highlight words lightened (4.0/3.7/4.2:1). A scripted contrast audit over index/about reports 0 failures. Global `:focus-visible` ring (D22). Host page is unchanged apart from its font (`--host-bg` keeps the old navy). Still open: mascot art, theme 2/3 + teacher-disable (D11-D15), radius/spacing scales (D34), phone layouts review (D35).
5. Phase 5: themes 2/3 and teacher-disable (needs D11-D15), a11y pass, README/CLAUDE.md update.

## 8. Constraints (from CLAUDE.md, do not violate)
No build step; no `position: fixed` bottom-anchored mobile UI; no secrets in repo; service worker stays network-first.
