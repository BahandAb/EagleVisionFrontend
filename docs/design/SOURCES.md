# SOURCES.md

## Reference images

All files are lossless PNG. Workspace and homepage mockups are 1366x768; the enter-code mockup is 1894x912. The workspace and homepage mockups have black letterbox bars above and below. These are treated as screenshot framing, not design.

| # | Save as | Original file | What it shows | Notes |
|---|---|---|---|---|
| 1 | 01-icon-color-controls.png | colorControlsIcon.png | Three overlapping circles (magenta, teal, gold) | Rail icon for filters/color controls. Opaque colors #d01399, #1f97a4, #d0ab18, overlaps #859fd8, #f7ae41 (sampled from image 1) |
| 2 | 02-icon-counter.png | counterToolIcon.png | Green "1" and purple "2" circles | Counter tool icon. #89bc5c, #8782d5, white numerals (sampled from image 2) |
| 3 | 03-icon-gallery.png | galleryIcon.png | Stacked photo cards with sun and mountains | Gallery rail icon. #60d9ff, #34788c, #adf66d, #fcd255 (sampled from image 3). Uses near-copies of the drawing palette |
| 4 | 04-mascot-eagle-happier.png | happierEagleIcon.png | Eagle mascot with goggles, curved beak | Differs from image 5 only in the beak/goggle area. Main colors #fff5e9, #b97a57, #946246, #d6a381, #c4a977 (sampled from image 4) |
| 5 | 05-mascot-eagle-happy.png | happyEagleIcon.png | Eagle mascot with goggles, straight beak | Same palette as image 4 |
| 6 | 06-page-enter-code.png | joinSessionPage.png | Enter-code page: centered navy card, mascot on top, two inputs, yellow Join button | Background has diagonal wedges #1e1e1e and #252525 |
| 7 | 07-page-home-hero.png | LandingPageLiveMicroscopyStreaming.png | Homepage hero: nav bar, headline, three CTAs, product photo, clouds, stars, mascot | Mid-blue background #577092, not dark |
| 8 | 08-page-home-who-its-for.png | landingPageWhoItsForExample.png | Homepage "Who it's for" section with K12 / College Labs / Medical Ed cards | Cards #4b6280 |
| 9 | 09-icon-pan.png | panToolIcon.png | White hand | Pan tool icon, white only |
| 10 | 10-icon-pen.png | penToolIcon.png | Brown paintbrush | Drawing-tools rail icon. #4d402b handle, #88704f tip (sampled from image 10) |
| 11 | 11-icon-roster.png | rosterIcon.png | Purple person silhouette | Roster rail icon. #8882d8 (sampled from image 11) |
| 12 | 12-icon-snapshot.png | snapshotIcon.png | Gray camera | Snapshot icon. #4e4e4e, #616161, #b5b5b5, #8c8c8c (sampled from image 12) |
| 13 | 13-icon-theme2-flower.png | theme2FlowerIcon.png | Pink sakura flower | Decoration for theme 2. #c9668c, #df86a8 (sampled from image 13) |
| 14 | 14-workspace-theme1.png | workspaceAnnotationsTabTheme1.png | Workspace, drawing tools tab open, navy theme | Matches Discord messages 1 to 10 closely |
| 15 | 15-workspace-theme2.png | workspaceAnnotationsTabTheme2.png | Same, pink/magenta theme with sakura background shapes | Not mentioned in messages |
| 16 | 16-workspace-theme3.png | workspaceAnnotationsTabTheme3.png | Same, blue/teal/olive theme with star background shapes | Not mentioned in messages |
| 17 | 17-workspace-themes-disabled.png | workspaceAnnotationsTabThemesDiabled.png | Theme 1 with "Your teacher has disabled this feature." above a grayed theme picker | Original filename misspells "Disabled" |

## Discord claims

Author and date were not provided for any message.

| # | Author | Date | Claim (close to verbatim) | Category | Where it landed |
|---|---|---|---|---|---|
| 1 | not given | not given | Top bar #202642 | color | SPEC Color tokens (--bg-topbar); DECISIONS D1 (image shows #1e253f) |
| 2 | not given | not given | Side bar (paintbrush, filters, etc. buttons) #171717 | color | SPEC --bg-rail; DECISIONS D27 (naming) |
| 3 | not given | not given | Background of box holding drawing tools/other functions on other pages #1b4a71 | color | SPEC --bg-panel (matches image 14); DECISIONS D3 ("other pages") |
| 4 | not given | not given | Background of the column with tools on the right side #003e62 | color | SPEC --bg-toolcol |
| 5 | not given | not given | Background of entire screen #1e1e1e | color | SPEC --bg-dark |
| 6 | not given | not given | Blank microscope square #3d3d3d | color | SPEC --bg-scope-empty |
| 7 | not given | not given | Selection circle for right side tool column #2f84b6 | color, component | SPEC --select-toolcol; DECISIONS D7, D24 |
| 8 | not given | not given | Little corner box for the code #27486c | color, component | SPEC --bg-code; DECISIONS D2 (image shows #25486c) |
| 9 | not given | not given | "for drawing colors" (heading for #10) | color | Merged with #10 |
| 10 | not given | not given | Drawing colors: red #e84e53, yellow #fdd257, green #adf66d, blue #5dd8ff, white #ffffff | color | SPEC --draw-* tokens |
| 11 | not given | not given | Change font color on filter slides to red #e84e53, green #adf66d, blue #5dd8ff | color, component | SPEC --filter-label-*; DECISIONS D9, D10 |
| 12 | not given | not given | Change yellow selection color to #fdd257 | color | SPEC --accent; DECISIONS D5, D7 |
| 13 | not given | not given | Change glow from yellow to white | color, component | SPEC --glow-selected; DECISIONS D8 |

## Assets added to the repo
Images 01-05 (color-controls icon, counter icon, gallery icon, two eagle mascots) are in `docs/design/reference/` at full size and in `assets/ui/` (icons resized to 128px tall). Used in: workspace rail (color controls, gallery), counter tool, enter-code mascot (happier eagle, D32 default). Still missing: images 06-17 (page mockups, remaining icons, theme art), `09-icon-pan`, `10-icon-pen`, `11-icon-roster`, `12-icon-snapshot`, `13-icon-theme2-flower`.
