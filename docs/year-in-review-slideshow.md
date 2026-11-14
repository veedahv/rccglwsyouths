# Year in Review slideshow: how it is built and how it looks

The end-of-year slideshow on the **Yearly planner** page. This note is for whoever works on it next, and for reusing its look in other slideshows (an after-event one, for example).

## Where things live

| File | What it does |
| --- | --- |
| `src/lib/yearReview.ts` | Gathers everything the slides show (`buildYearReview(year)`), and saves the extras typed in by hand (`/yearReviews/{year}`) |
| `src/lib/yearReviewPhotos.ts` | The pictures for the two memories slides: an optional permanent list, plus the in-tab store and reader for pictures added on the card |
| `src/components/YearReviewSlides.tsx` | The slideshow itself: the slides, the look, the player |
| `src/components/YearReviewCard.tsx` | The planner card: year picker, Play, Download, and the editor for highlights and the tagline |
| `src/components/yearReviewExport.tsx` | Saves the slideshow as a PDF or PowerPoint |
| `src/components/YearReviewExportMenu.tsx` | The Download button and its small menu |

## How it works

- **A fixed stage.** Every slide is drawn on a 1280 x 720 stage (16:9) and the whole stage is scaled to fit the screen. Sizes inside slides are plain pixels, and it looks the same on a laptop, a phone or a projector.
- **Data first, slides second.** `buildYearReview` returns one plain object (events, games, contributions, finance, plans, photos). Each part loads on its own, so a part that fails or is empty is simply left out. `buildSlides(data)` turns that object into a list of slides, skipping any part that has nothing in it.
- **A slide is a theme plus a node.** `{ id, theme, node }`. `SlideShell` paints the theme's background and decorations, and the node is the content. The player shows one slide at a time, keyed by its position so its entrance animations play every time.
- **The player.** Arrow keys, space, swipe, or clicking the left and right edges move through the slides. **F** is full screen and **Esc** closes. The controls fade away when the mouse is still.
- **Long lists are paged.** Events go four to a slide and next year's plans six to a slide, spread evenly so the last page is never a lone card (`chunk`).

## The look

**Colours** (RCCG purple, green and red, in soft pastels, plus a gold accent):

| Role | Values |
| --- | --- |
| Purple | `#180C62` deep, `#2F1C86`, `#52409E`, `#7E6EB8`, `#CBC4E7`, `#E5E1F4`, `#F4F2FB` |
| Green | `#046A23`, `#028A2C`, `#5BC57A`, `#92CDA4`, `#C7E6D0` |
| Red | `#B5130E`, `#D61812`, `#E5463F`, `#F2A6A1`, `#FAD4D1` |
| Gold | `#8A5A00`, `#F5B83D`, `#FFD66B` (stickers and sparkles), `#FFEFC7` |
| Text | `#1B1440` on light slides, white on the night slides |

**Backgrounds.** Five themes, each a soft diagonal gradient: `night` (deep purple, for the cover and the thank-you), `lavender`, `mint`, `blush` and `cream`. Neighbouring slides use different themes so the deck has a rhythm.

**Type.** The chunky title font (`font-title`, Caprasimo) for the big headings, numbers and stickers; the app's display font for card headings; the normal font for the rest. Headings are about 54 px, big numbers 56 to 84 px, body text 17 to 22 px (it is read from a distance).

**Shapes.** White cards with very round corners (26 to 36 px) and a soft purple-tinted shadow. Cards and stickers sit at a slight tilt (about 2 to 4 degrees) so nothing looks stiff. Each heading has a small uppercase pill above it (the "kicker").

**Decoration** (`Decor`). Three large soft blobs that drift slowly, a few twinkling four-point stars, and a faint dot grid in one corner. Their positions change with the slide's position so no two slides look the same.

**Motion.** Content rises into place (`yr-rise`), stickers and tilted cards pop in (`yr-pop`), blobs float, stars twinkle. Numbers count up (`CountUp`) and progress bars grow (`GrowBar`). All of it is switched off for people who prefer reduced motion, and while exporting.

**Polaroid frames.** The memories slides use white frames with a strip of tape on top and a small sparkle on the bottom edge. Pictures are cropped to fit, and a placeholder icon shows until there is a photo.

## The slides

| Slide | Theme | Comes from |
| --- | --- | --- |
| Cover | night | The year, and the tagline typed on the card |
| At a glance | lavender | Counts of events, games, drives and youths |
| Moments we shared (1 to 3 slides) | mint, blush | Events up to today, with the start of their after-event report; plus highlights typed in by hand. An event dated today is tagged "Today" |
| Playing together | lavender | Finished game days, games played, outdoor games, most played, wins per team; plus game days typed in by hand |
| Generous hearts | blush | Contribution drives that started or ended that year (totals only, never names) |
| The money story | mint | The yearly financial report: opening balance, money in, money out, balance |
| Looking ahead (1 or 2 slides) | cream | Next year's approved programmes (or the suggestions, labelled as ideas) |
| Memories (2 slides) | blush, lavender | Pictures added on the card (kept in the tab only), or the list in `yearReviewPhotos.ts`: 6 portraits, 8 landscapes and 2 squares |
| Thank you | night | The year |

## Hand-added events

Events the app doesn't know about are typed on the planner card and saved in `/yearReviews/{year}` as highlights. Each can have a title, a date, a summary, an **order of events** (up to 8 steps, `MAX_ORDER_STEPS`) and, if there were games, **which games** (a comma-separated list, split by `splitList`) and whether they were **outdoors**. They show up in two places:

- **A card among the moments**, with a 🎮 Games or 🌳 Outdoor games tag and the order of events. The games themselves are not repeated here.
- **The games slide**, as a game day with its games listed. A hand-added game day counts in the "Game days" tile, and in the "Outdoor games" tile if it was outdoors.

**Cards and pages (`paginateEvents`).** Four small cards fit on a slide (a 2 x 2 grid). In a small card the order of events is one line with arrows between the steps. `estimateCardHeight` roughly counts a card's lines; when any of the next four cards wouldn't fit in the small size, that slide takes only two cards, in a roomier size where the order of events is a numbered path. A slide with only one or two events also uses the roomy size, and a lone last card borrows a neighbour from the slide before.

## Pictures for the memories slides

- **Added on the card (nothing is saved).** **Add memories pictures** opens a file picker. Each picture is read in the browser, shrunk to 1000 px on its longest side and turned into a JPEG (so a phone photo doesn't slow the slideshow or the downloads), and its shape is worked out from its size: portrait if it is clearly taller than wide, landscape if clearly wider, otherwise square. The shape can be changed under the thumbnail. They are held in a plain variable (`getSessionPhotos` / `setSessionPhotos`), not in Firebase or storage, so a refresh clears them; moving between pages keeps them.
- **How they reach the slides.** The card passes them to the slideshow (`photos` prop) and to the PDF / PowerPoint download. When there are any, they are used for the memories slides instead of the permanent list.
- **Which frame.** Each picture goes into the next frame of its shape, in the order added, across both screens: 6 portrait frames (3 taller, 3 shorter), 8 landscape and 2 square (`MEMORY_CAPACITY`). A picture with no frame left of its shape is left out; the card warns about it. Frames without a picture keep their placeholder icon.
- **Permanent option.** Put the files in `public/memories/<year>/` and list them in `yearReviewPhotos.ts`.

## Adding or changing a slide

1. Put anything new it needs into `buildYearReview` (a small `load...` function, wrapped in `section(...)`, and a field on `YearReviewData`).
2. Write the slide as a component in `YearReviewSlides.tsx`. Start with `Heading`, then the content; give each element `yr-rise` or `yr-pop` and a `delay(...)` so it arrives in order.
3. Add it to `buildSlides` with a theme, only when there is something to show.
4. Check it fits: the stage is 1280 x 720 with 72 px side and 52 px top and bottom padding, and a heading takes about 135 px. Long text should be clamped (`line-clamp-*`).
5. Use `CountUp` and `GrowBar` for anything that animates its value, so the PDF and PowerPoint downloads show the final numbers.

## Saving as PDF or PowerPoint

Each slide is drawn off-screen with animations off and every value final, photographed at 1920 x 1080 (`html-to-image`), and the pictures are placed one per page (`jspdf`) or per slide (`pptxgenjs`). The files look exactly like the slideshow but are pictures, so the text can't be edited. It works best in Chrome or Edge. `next.config.js` has a small addition so `pptxgenjs` builds for the browser.

## Reusing this look for an after-event slideshow (a plan, not built)

The slideshow's look and player are all in one file at the moment. Before building a second deck, move the shared parts into a small kit (for example `src/components/slides/`), so both decks look and behave the same:

- **The look:** `THEMES`, `Decor`, `SlideShell`, `Heading`, `StatTile`, `CountUp`, `GrowBar`, the photo frame, the palette and the animation CSS.
- **The player:** stage scaling, navigation, full screen, the controls, and the export menu. It only needs a list of `{ id, theme, node }` slides.

The structure would differ, as the event is the star instead of the year. Everything below already exists in the app for an event:

| Possible slide | Data |
| --- | --- |
| Cover | Title, theme, date, venue |
| The numbers | How many came (the event's attendance list); budget against what was actually spent (budget and expenses) |
| How it went | The after-event report (a full-text slide instead of the short snippet used here) |
| Games | The event's games day: winners, standings |
| Giving | The event's contribution drive: pledged, redeemed, items |
| Photos | The same collage frames |
| Thank you | Thank-you note, plus the next event |
