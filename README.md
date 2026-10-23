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
- [IMC Cinemas](https://www.imccinemas.co.uk)
- [IMDb UK release calendar](https://www.imdb.com/calendar/?region=GB)
