# DECISIONS.md

| # | Question / conflict | Options | Decision | Who | Date |
|---|---|---|---|---|---|
| D1 | Top bar color: msg 1 says #202642; image 14 samples #1e253f; homepage nav (image 7) samples #1d253f | A) #202642 per message. B) #1e253f per mockup. C) One shared value for workspace top bar and homepage nav | C (shared #1e253f; homepage nav moves in Phase 4) | Claude (default, pending team review) | 2026-10-03 |
| D2 | Code chip: msg 8 says #27486c; image 14 samples #25486c | A) #27486c. B) #25486c | B (#25486c) | Claude (default, pending team review) | 2026-10-03 |
| D3 | Msg 3 says #1b4a71 is used "on other pages". Enter-code card uses #27496e instead | A) #1b4a71 is workspace-only. B) Reuse #1b4a71 for the enter-code card and other pages. C) Keep #27496e there | A (#1b4a71 workspace-only; enter-code card moves to #25486c in Phase 4) | Claude (default, pending team review) | 2026-10-03 |
| D4 | Many near-duplicate navy blues: #1b4a71, #194a71, #25486c, #27486c, #27496e, #003e62, #1d253f, #1e253f, #202642 | A) Keep each as its own token. B) Collapse to 3 or 4 navy tokens | B (app uses 4 navies: #1e253f, #1b4a71, #25486c, #003e62; legacy navy stays under --mk-* until Phase 4) | Claude (default, pending team review) | 2026-10-03 |
| D5 | Gold #FFD700: msg 12 changes only "selection" to #fdd257, but images use #fdd257 for all yellow buttons and accents | A) Replace --accent globally with #fdd257. B) Selection only, keep #FFD700 elsewhere | A (--accent #fdd257 globally) | Claude (default, pending team review) | 2026-10-03 |
| D6 | Enter-code Join button is #f6d46c, homepage buttons are #fdd257 | A) Use #fdd257 everywhere. B) Keep both | A (#fdd257 everywhere) | Claude (default, pending team review) | 2026-10-03 |
| D7 | Two selection colors: yellow #fdd257 (msg 12) vs blue #2f84b6 (msg 7). Images show no #fdd257 selection; yellowish selection appears only in the rail stripe (#f9ebb4) and stroke-button border (approx #b0aa96) | A) Yellow for side panel and rail, blue for right column. B) One color everywhere. C) Rail stripe and stroke border become #fdd257 | A (yellow for side panel + rail, blue #2f84b6 for right tool column) | Claude (default, pending team review) | 2026-10-03 |
| D8 | Msg 13 says glow is white. Images show the selected swatch glowing in its own color (red). A white glow on the white swatch is invisible | A) White glow on everything, plus a different marker (dark ring or check) for the white swatch. B) Keep own-color glow from images. C) Glow only on tools, not swatches | A (white glow + a non-glow marker for the white swatch; implemented Phase 4) | Claude (default, pending team review) | 2026-10-03 |
| D9 | Red filter label #e84e53 on #1b4a71 is 2.49:1 (fails 4.5:1 and 3:1). On theme 2/3 panels it is 1.43 and 1.67 | A) Lighter red for text only (separate token). B) Colored dot or bar next to a white label. C) Bold large labels on a dark chip. D) Accept | | | |
| D10 | Filter slider panel is not in any image | A) Teammate provides a mockup. B) Developer builds from existing layout with new tokens | | | |
| D11 | Themes 2 and 3 exist in images but not in messages. Scope, names, persistence (per device, per student, per session) unknown | A) Ship all three. B) Ship theme 1 only for now. C) Ship themes later | | | |
| D12 | Theme 2 and 3 fail contrast with white text/icons: panels 2.60 and 2.23, tool columns 2.47 and 2.38, theme 3 selection circle 1.92 | A) Dark text/icons in light themes. B) Darken panel colors. C) Accept as decorative themes | | | |
| D13 | Theme 2/3 page backgrounds add decorative shapes (#2b2b2b). Could distract on projectors or compete with the feed | A) Keep. B) Remove. C) Lower opacity further | | | |
| D14 | Theme names are unknown ("theme2Flower" from filename) | Team to name | | | |
| D15 | Disabled state (image 17): only theme switching is shown disabled. Which other features can teachers disable, and do they all use this pattern? | A) Themes only. B) Same pattern for any teacher-locked feature | | | |
| D16 | Homepage uses light mid-blue #577092, conflicting with "dark theme, dim rooms" | A) Marketing pages light, app pages dark. B) Darken homepage | | | |
| D17 | Homepage contrast failures: body #c6c6c6 2.97, Patent Pending 2.46, "Microworld" 2.94, "Every" 2.55, yellow eyebrow and button text 3.51, yellow-on-blue outline buttons 3.51, "Medical Ed." 2.87 | A) Adjust each color. B) Darken --mk-bg. C) Accept for decorative text only and fix body/button text | | | |
| D18 | Headline accent words use different colors (green, teal) | A) Intentional variety. B) Pick one | | | |
| D19 | Fonts not specified. Images resemble Fredoka (display) and Poppins (body). Workspace appears to keep Segoe UI/Roboto. Web fonts need a network request (Google Fonts) or self-hosted files | A) Confirm names, self-host. B) Load from Google Fonts. C) Marketing fonts on marketing pages only | A+C (confirm names via visual match; self-host; marketing + enter-code only, workspace keeps system sans) | Claude (default) | 2026-10-03 |
| D20 | Custom flat color icons (images 1 to 3, 9 to 12) replace Google Material Icons? Gear and "<>" in rail look like Material icons. Icons are approx 600px PNGs | A) Replace all with custom icons as SVG. B) Mixed set. C) Keep PNG, resized | | | |
| D21 | Low-contrast icon parts: pen handle #4d402b on rail 1.78; snapshot grays on #003e62 1.35 to 1.82 | A) Recolor icons. B) Add light outline. C) Accept | | | |
| D22 | Hover, focus, pressed, disabled states and focus ring color are not defined anywhere | Teammate or developer to propose | | | |
| D23 | --danger and --success not addressed. #ff4444 on #1b4a71 is 2.72 | A) Keep current. B) Align with --draw-red / --draw-green. C) New values | | | |
| D24 | Selection circle #2f84b6 vs tool column #003e62 is 2.73:1 (under 3:1) | A) Lighter circle. B) Add ring. C) Accept, white icon distinguishes it (4.12) | | | |
| D25 | Control boundaries under 3:1: panel button border 1.61, stroke buttons 1.17, enter-code input fill vs card 1.79 | A) Lighter borders. B) Accept | | | |
| D26 | Muted text fails: Exit #898989 4.31, "I am the instructor." #9fa2a7 3.62, rail label #626262 2.94 | A) One muted token that passes 4.5:1. B) Accept | | | |
| D27 | Naming: msg 2 calls the left icon rail the "side bar"; current site has an "activity bar" and a "side panel" | Confirm: rail = activity bar, 305px panel = side panel? | | | |
| D28 | Is the right tool column the "annotation toolbar"? It also holds pause and snapshot | Confirm name and contents | | | |
| D29 | Enter-code placeholders are white uppercase and look like typed values | A) Muted placeholder color. B) Keep | | | |
| D30 | "I am the instructor." on enter-code page has no visible control. Link, checkbox, or toggle? | Team to decide | | | |
| D31 | No reference for: About, Host, AI panel, other side-panel tabs (filters, gallery, roster, settings), modals, activity-feed items | A) Teammate provides mockups. B) Developer applies tokens to current layouts | | | |
| D32 | Two mascot versions (images 4, 5). Which goes where? | Team to decide | | | |
| D33 | Purpose of "<>" icon at bottom of rail | Team to confirm | | | |
| D34 | Corner radii vary (2px to 30px). Standardize to a small scale? | A) Keep per component. B) Define 3 radius tokens | | | |
| D35 | All mockups are desktop (1366 wide). No phone or projector layout shown | Team to provide or developer to adapt | | | |
| D36 | Image 15/16 show a navy edge (#083e62) on the right column border, likely a leftover from theme 1 | Confirm it is an artifact | | | |
| D37 | Red annotations on the empty microscope area are 2.92:1, and real specimen colors will vary | A) Add stroke outline/halo option. B) Accept | | | |
| D38 | Messages have no author or date | Fill in | | | |
