# IMC Enniskillen Hub

The marketing hub for **IMC Cinema Enniskillen**. It pulls today's film times, coming-soon films, Kids Club and LUXX showings straight from imc.ie. It turns any film or kiosk deal into a still, animated or video graphic in one click, and it plans and tracks every post.

- **Live site:** https://popcorn483.github.io/imc/
- **Photo & video editor:** https://popcorn483.github.io/imc/editor.html

There's no account or server to run. GitHub Pages hosts the site, and a GitHub Action keeps the imc.ie listings fresh.

## What's in it

| Page | What it does |
|---|---|
| **Today** | Every film showing today, with certificate, runtime and times from imc.ie. One click makes today's times as a post or a Story. Also shows films opening soon, your deals, and the current banners from imc.ie. |
| **What's on** | Today, the next 7 days, Coming soon, Kids Club, LUXX and Relaxed (sensory) screenings. Each film has **Make post**, **Story**, **Write caption**, **Book ↗** and **Trailer ↗**. |
| **Deals** | Kids Tray, Share Combo, Large Combo, Medium Combo and any deals you add. Set the name, what's included, price, "was" price, small print and which food pictures to show. Then make an **Animated post**, **Still post** or **Animated Story**. |
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
- **Food & drink:** popcorn bucket, drink, nachos, hot dog, sweets and kids tray. They're drawn in IMC colours with the logo, and every colour can be changed.
- **Film times:** a panel listing films and times, filled from imc.ie and editable.
- **Motion:** slow zoom, light rays, spotlights, bokeh, marquee chase, gold sparkle, popcorn burst, fizz bubbles, confetti, snow, old projector.
- **Per-item animation:** Shine, Pulse, Pop in, Slam in, Slide up, Swing, Wiggle, Float or Blink, each with a start time so items arrive in sequence.
- **Export:**
  - **PNG/JPG** for posts.
  - **GIF** for Facebook, WhatsApp and X.
  - **Video** for Reels, Stories and TikTok. Chrome, Edge and Safari save MP4; other browsers save WebM.
  - **Copy image** to paste straight into a post.

Everything can be dragged, resized, rotated, recoloured and re-ordered. You can also undo and redo, and save your own layouts.

Shortcuts: Ctrl+Z undo, Ctrl+Shift+Z redo, Delete removes, Ctrl+D duplicates, arrow keys nudge (Shift for bigger steps).

## How the imc.ie import works

`.github/workflows/import-imc.yml` runs `tools/import-imc.mjs` every 3 hours. It reads these imc.ie pages for Enniskillen:
- today's film times and the next week of dates
- advance bookings
- Kids Club
- LUXX
- the cinema page's banners

It saves posters and banners into `data/` and writes `data/imc.json`, which the site reads. To refresh straight away, open **Actions → Import imc.ie listings → Run workflow**.

The raw pages are kept in `data/raw/` so the importer can be adjusted if imc.ie changes its layout. Check `log` in `data/imc.json` to see what each run found.

## Where things are saved

Posts, deals, layouts, your uploaded media and your current design are saved **in the browser you use**. Use **Posts → Export backup** to move posts and deals to another computer or colleague. The imc.ie listings are shared for everyone.

## Images

Use official posters and trailer stills, your own photos and videos from the cinema, or the built-in graphics. The food and drink pictures are drawn in code as illustrations. The app flags any post marked as using an AI-generated image.

## Logo

`imc-logo.png` is used on every frame, logo layer and poster footer. To try a different version on your own computer, use the editor's **Logo** tab.
