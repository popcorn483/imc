# IMC Ad Studio

A web app for planning, designing, captioning and tracking social media ads for **IMC Cinema Enniskillen**. It's one HTML file. There's no build step, server or account.

## Use it

**Online (recommended):** turn on GitHub Pages for this repo and open the link from any computer or phone.

1. On GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, then choose **main** and **/ (root)**. Click **Save**.
3. After a minute or two the site is live at `https://popcorn483.github.io/imc/`.

**Offline:** download `index.html` and open it in Chrome, Edge, Safari or Firefox.

## What's in it

| Tab | What it does |
|---|---|
| **Dashboard** | Week calendar, what's due next, and engagement by ad type once you add results |
| **Create ad** | 8 ad types (Now Showing, Coming Soon, Offer, Kids Club, Event night, Relaxed screening, Poll, Guess the Film). The poster builds as you type, in Feed 1:1, Feed 4:5, Story/Reel 9:16 and foyer-screen 16:9. Download as PNG. |
| **Share-ability score** | Checks each ad against 11 habits that get local posts shared, including whether the image is real and not AI-generated |
| **Upcoming releases** | UK release dates to January 2027 with a viral angle for each film. Mark *Showing / Maybe / Not showing* and build an announcement or opening-day ad in one click. |
| **Posts** | Every ad from idea → draft → scheduled → posted. Add reach, reactions, comments and shares from Facebook Insights. |
| **Go-viral playbook** | 11 tactics, each opening a ready-made ad |
| **Photo editor** (`editor.html`) | Frame a real photo or official poster with an IMC border, then drag on badges like Coming Soon, New Release, LUXX, Premier, Book Now and release dates. Add animated effects and export PNG, JPG or GIF. |

## Photo editor

Open **Photo editor ↗** from the Ad Studio menu, or go straight to `https://popcorn483.github.io/imc/editor.html`.

1. **Logo tab:** upload the official IMC logo once (PNG or SVG with a transparent background). It's remembered in your browser and appears on every frame.
2. **Photo tab:** upload a photo, drag one onto the canvas, paste one with Ctrl+V, or paste a link.
3. **Layouts tab:** start from Coming soon, New release, LUXX, Now showing, Opening night or Countdown. You can also save your own layouts.
4. **Frame tab:** Premiere, Clean, Film strip, Marquee lights, Photo border or none, in any colour, with a caption.
5. **Add tab:** badges, text and the logo. Drag to move, drag a corner to resize, drag the top dot to rotate (hold Shift to snap). Items snap to the centre lines.
6. **Download PNG** for Facebook and Instagram, or **Copy image** and paste straight into a post.

### Animated posts and GIFs

The **Motion** tab adds animated effects you can mix:

- Slow zoom
- Premiere spotlights
- Bokeh lights
- Marquee chase
- Gold sparkle
- Gold confetti
- Snowfall
- Old projector

Select any badge or text and pick an **Animation** in the right-hand panel: Shine, Pulse, Pop in, Swing, Float or Blink. Four ready-made animated layouts are in **Layouts**: Premiere night, Christmas release, Opening night lights and LUXX gold.

Click **GIF** to export. Choose a size (Small 540px, Medium 800px or Full) and a smoothness (10, 16 or 20 frames a second). Everything loops seamlessly. GIFs play on Facebook, WhatsApp, X and websites. Instagram posts don't play GIFs, so post the PNG there. Keep GIFs under about 8 MB. The *Old projector* effect makes bigger files, so use Small or 10 fps with it.

Shortcuts: Ctrl+Z undo, Ctrl+Shift+Z redo, Delete to remove, Ctrl+D to duplicate, arrow keys to nudge (Shift for bigger steps).


## Where your posts are saved

Posts are saved **in the browser you use**. They don't sync between computers or people on their own.

- To move posts to another computer or share them with a colleague, go to **Posts → Export backup**. Then use **Import backup** on the other machine.
- Export a backup now and then. Clearing your browser data deletes saved posts.
- Photos you add to a poster aren't saved. Re-add the image when you reopen a post.

## Images

Use the official poster or trailer stills from the distributor or IMC head office, your own photos from the cinema, or the built-in type-only designs. The app flags any ad marked as using an AI-generated image.

## Keeping release dates current

The release list is in `index.html`. Search for `const RELEASES=[`. Each film is one line:

```js
{id:"dune3",t:"Dune: Part Three",d:"2026-12-18",dist:"Warner Bros",cert:"",aud:"blockbuster",sub:"The saga continues",angle:"…",tag:"#DunePartThree"},
```

`aud` sets the poster colours. It can be `family`, `blockbuster`, `horror`, `comedy`, `classic`, `event` or `drama`. Dates came from the [Film Distributors' Association schedule](https://filmdistributorsassociation.com/release-schedule/all-future-releases/) on 18 Oct 2026. Always confirm dates with your booker.

Useful links:
- [IMC Cinemas](https://www.imc.ie)
- [IMDb UK release calendar](https://www.imdb.com/calendar/?region=GB)
