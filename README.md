# IMC Enniskillen Hub

The marketing hub for **IMC Cinema Enniskillen**. It pulls today's film times, coming-soon films, Kids Club and LUXX showings straight from imc.ie. It turns any film or kiosk deal into a still, animated or video graphic in one click, and it plans and tracks every post.

- **Live site:** https://popcorn483.github.io/imc/
- **Photo & video editor:** https://popcorn483.github.io/imc/editor.html

There's no account or server to run. GitHub Pages hosts the site, and a GitHub Action keeps the imc.ie listings fresh.

## What's in it

| Page | What it does |
|---|---|
| **Today** | Starts with **What do you want to make?**: one-click buttons for today's times, Stories, the current season's post, deals, coming-soon films, LUXX ads, foyer trailers, the ideas calendar and the caption bank. Then every film showing today, with certificate, runtime and times from imc.ie. Also shows films opening soon, your deals (with imc.ie prices), and the current banners from imc.ie. |
| **What's on** | Today, the next 7 days, Coming soon, Kids Club, LUXX and Relaxed (sensory) screenings. Each film has **Make post**, **Story**, **Write caption**, **Book ↗** and **Trailer ↗**. |
| **Deals** | Family Combo, Kids Tray, Share Combo, Large Combo, Medium Combo and any deals you add. One-click buttons add tickets (adult, child, family), popcorn, drinks, kids trays, nachos, hot dogs, sweet bags, pick 'n' mix and ice cream (scooped or tub) to what's included, with the counts kept up to date. Set the name, what's included, price, "was" price, small print and which food pictures to show. Then make an **Animated post**, **Still post** or **Animated Story**. |
| **Prices from imc.ie** | On the Deals page: ticket prices, ticket + snack bundles and snacks with IMC's own product photos, read from imc.ie's booking page for the chosen cinema. **Make a deal** or **Video clip** from any of them. Your deals show the imc.ie price when the name matches, and use IMC's real product photos unless you untick that. |
| **LUXX ads** | **LUXX ad** / **LUXX Story** on the Today page and What's on → LUXX: today's LUXX showings and times, plus the LUXX seat price when imc.ie lists one. Add a photo of your LUXX seats in the editor's Photo tab to use it as the background. |
| **Video clips** | **Video clip** on any deal or imc.ie product makes a 6-second Story: a hook, the product, the price, then "Grab it at the kiosk". Preview it, then save it from the editor's Video button. |
| **Foyer trailers** | Trailer packs for the foyer TVs. Only U/PG/12A films (G/PG/12A in the Republic) go in by default, trailers titled red band, uncensored or explicit are always left out, and films without a certificate wait until you've watched the trailer and ticked it. **Open foyer player** gives a full-screen page (`foyer.html`) that plays a showtimes card then each official trailer, on a loop, updating itself daily: open it in the TV's browser. **Download pack** gives a ZIP of 16:9 MP4 showtimes cards and stills, a USB playlist and the trailer list. |
| **Ideas calendar** | Key dates for the next 12 months for the chosen cinema's side of the border (bank holidays, school holidays, Halloween, Christmas, Mother's and Father's Day, Easter and more) plus big releases, each with a post idea, when to start posting, **Design it** (opens a seasonal design) and **Plan a post** (adds it to the planner). School holiday dates are approximate. |
| **Toolkit** | Caption bank by topic, hashtag sets, a sizes cheat sheet, a before-you-post checklist, and **brand settings** for each cinema: hashtags, a sign-off added to captions, and how the caption writer describes the cinema. |
| **Planner** | Week calendar, what's due next, and engagement by post type once you add results. |
| **Create ad** | Quick text-led posters with a caption writer and a share-ability score. |
| **Upcoming releases** | UK release schedule to January 2027 with a viral angle for each film. |
| **Posts** | Every post from idea to posted, with Facebook/Instagram results. Export and import backups. |
| **Go-viral playbook** | Tactics that work for a town cinema, each opening a ready-made ad. |
| **Photo & video editor** | The design tool. See below. |

## Photo & video editor

- **Background:** your photo or video, an official poster (**Whole poster** shows the full poster over a blurred copy of itself), or an IMC background (IMC stage, Sky, Midnight, Sunset).
- **Your media:** everything you upload is kept to reuse, including your current Facebook graphics and videos. **From imc.ie** shows the latest posters and banners.
- **Frames:** IMC brand bar, Premiere, Neon glow, Clean, Cinema ticket, Film strip, Marquee lights, Photo border.
- **Badges:** Coming Soon, New Release, LUXX, Premier, Now Showing, Book Now, release date, Tonight, corner sash, Kids Club, price burst, Selling Fast.
- **Deal pieces:** price ticket, "What's included" card, Save ribbon.
- **Food, drink & tickets:** the IMC ♥ movies popcorn box, drink, the red kids tray with popcorn and a juice bottle, nachos, hot dog, sweet bag, pick 'n' mix, scooped ice cream, ice cream tub and a cinema ticket that shows how many tickets the deal includes. They're drawn in code, and every colour and label can be changed.
- **Film times:** a panel listing films and times, filled from imc.ie and editable.
- **Motion:** slow zoom, light rays, spotlights, bokeh, marquee chase, gold sparkle, popcorn burst, fizz bubbles, confetti, snow, old projector.
- **Per-item animation:** Shine, Pulse, Pop in, Slam in, Slide up, Swing, Wiggle, Float or Blink, each with a start time so items arrive in sequence.
- **Seasons & occasions:** one-click Halloween, fireworks night, midterm, Black Friday, Christmas, New Year, Valentine's, St Patrick's Day, Mother's Day, Easter, Father's Day, summer and autumn looks, each with its own background, colours, animation and banner.
- **Seasonal effects:** bats, spooky fog, fairy lights, floating hearts, shamrocks, autumn leaves, fireworks and bunting, with an effect strength slider and effect colour picker.
- **Sizes:** feed, Story, foyer 16:9, Facebook event and cover, and Print A4/A3 (portrait and landscape).
- **Export:**
  - **PNG/JPG** for posts.
  - **GIF** for Facebook, WhatsApp and X.
  - **Video** for Reels, Stories and TikTok. Chrome, Edge and Safari save MP4; other browsers save WebM.
  - **PDF** for printing posters and flyers (A4, scales to A3).
  - **Copy image** to paste straight into a post.

Everything can be dragged, resized, rotated, recoloured and re-ordered. You can also undo and redo, and save your own layouts.

Shortcuts: Ctrl+Z undo, Ctrl+Shift+Z redo, Delete removes, Ctrl+D duplicates, arrow keys nudge (Shift for bigger steps).

## How the imc.ie import works

`.github/workflows/import-imc.yml` runs `tools/import-imc.mjs` three times a day. It reads these imc.ie pages for every IMC cinema (pick one with the **Cinema** menu on the Today page):
- today's film times and the next week of dates
- advance bookings
- Kids Club
- LUXX
- the cinema page's banners

It also looks up each trailer's title through YouTube's oEmbed service into `data/trailers.json`, so red-band trailers can be kept off the foyer TVs. It saves posters and banners into `data/` and writes `data/imc.json` for Enniskillen and `data/cinemas/<cinema>.json` for the others. `data/cinemas.json` lists which imc.ie address worked for each cinema and whether listings came in. To import one cinema only, run `ONLY=galway node tools/import-imc.mjs`. To refresh straight away, open **Actions → Import imc.ie listings → Run workflow**.

The raw pages are kept in `data/raw/` so the importer can be adjusted if imc.ie changes its layout. Check `log` in `data/imc.json` to see what each run found.

## Where things are saved

Posts, deals, layouts, your uploaded media and your current design are saved **in the browser you use**. Use **Posts → Export backup** to move posts and deals to another computer or colleague. The imc.ie listings are shared for everyone.

## Images

Use official posters and trailer stills, your own photos and videos from the cinema, or the built-in graphics. The food and drink pictures are drawn in code as illustrations. The app flags any post marked as using an AI-generated image.

## Logo

`imc-logo.png` is used on every frame, logo layer and poster footer. To try a different version on your own computer, use the editor's **Logo** tab.
