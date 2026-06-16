# Peak Dates 🏔️
### *Every date, a new summit.*

A Colorado-themed couples date planner that learns what you two love and hands
you the perfect weekly lineup — from Red Rocks concerts to alpine hikes to cozy
brewery nights.

![Vanilla JS](https://img.shields.io/badge/stack-vanilla%20JS-2D4A3E) ![No build step](https://img.shields.io/badge/build-none-8B4513) ![Local-first](https://img.shields.io/badge/data-local--first-4A7FA5)

---

## ✨ What it does

- **Weekly Lineup** — four hand-picked dates every Monday: a time-sensitive event,
  a seasonal pick, your top match, and a wildcard to push your comfort zone.
- **Learns your taste** — rate dates afterward and the algorithm tunes your
  "elevation profile," favoring categories you loved and burying ones that flopped.
- **Real Front Range logistics** — filter by light-rail access, driving range,
  season, budget, difficulty, and indoor/outdoor.
- **Couple linking** — share a 6-char invite code; both partners see the same board.
- **Scrapbook** — a timeline of completed dates with ratings, highlights, and
  relationship stats (favorite category, est. spent, longest streak).
- **Map view** — every date plotted on an interactive Colorado map (Leaflet).
- **64 curated Colorado dates** across mountains, breweries, culture, sports,
  cozy nights, city wandering, and seasonal events.

## 🚀 Run it

It's a static single-page app — **no backend or build step required.**

```bash
# any static server works; for example:
npx serve .
#   → open the printed http://localhost:3000
```

Or just open `index.html` over a local server (ES modules need `http://`, not
`file://`). Click **"Explore the demo couple"** on the landing page to jump
straight into a fully populated account.

## 🧱 How it's built

| Layer        | Choice                                                              |
|--------------|--------------------------------------------------------------------|
| UI           | Vanilla JS (ES modules) + hand-rolled CSS design system            |
| Routing      | Hash-based client router (`#/dashboard`) — GitHub Pages friendly   |
| Data         | **Local-first**: a swappable `store.js` backed by `localStorage`   |
| Backend (opt)| Supabase Auth + Postgres — schema + RLS in `supabase/schema.sql`   |
| Map          | Leaflet (lazy-loaded from CDN only when the map view opens)        |

### Why local-first?

The original spec assumed Supabase from day one — but that means *you* must
create a project and paste credentials before anything runs. Peak Dates instead
ships with a `store.js` abstraction that runs entirely in the browser, so it
works the instant you open it. Everything (auth, couple linking, surveys, the
scoring algorithm, reviews) is real and persistent in `localStorage`.

**Moving to Supabase later** is a drop-in: implement a `SupabaseStore` with the
same interface documented at the top of `js/store.js`, run `supabase/schema.sql`,
fill in `js/config.js`, and flip `BACKEND` to `'supabase'`. No other code changes.

## 📁 Structure

```
index.html              Entry point + animated topo backdrop
css/                    main (tokens) · components · pages
js/
  config.js             backend + map config
  app.js                hash router + app chrome
  store.js              swappable data layer (LocalStore today, Supabase later)
  state.js              per-navigation session/couple context
  algorithm.js          scoring + weekly rotation + personality badge
  ui.js                 toast · modal · spinner · formatting helpers
  components.js         date card · status actions · review modal
  seed.js               64 Colorado dates (source of truth) + categories
  pages/                landing · onboarding · dashboard · discover ·
                        date-detail · history · profile
data/seed-dates.json    JSON mirror of the catalog (for the Supabase seed)
supabase/schema.sql     tables + Row Level Security policies
assets/topo-texture.svg standalone contour-line texture
```

## 🧮 The matching algorithm

Each date scores 0–100 per couple by blending both partners' surveys:

- **Category match** (+30) when it's in your favorites
- **Activity fit** (0–20) — distance between the date's difficulty and your energy
- **Budget fit** (+15 / penalty) — under budget rewarded, over penalized
- **Seasonal relevance** (+20 in-season, +11 anytime)
- **Distance** — honors a hard mileage cap (the stricter of the two partners)
- **Transit** — heavy penalty for car-only dates if either partner is rail-only
- **Learning multiplier** — scales by your average review rating per category

The weekly rotation fills four slots (event · seasonal · top match · wildcard),
excludes anything done/passed or shown in the last four weeks, and you get one
manual refresh per week.

## 🌄 Theme

Colorado wilderness meets cozy mountain cabin — deep forest greens, burnt sienna,
slate blue, golden aspen, and warm cream, with `Cormorant Garamond` display type
(national-park-sign energy), `DM Sans` body, and `Courier Prime` for stat
callouts. Animated topographic contour lines draw in behind every view.

## 🚢 Deploy to GitHub Pages

All paths are relative, so it works from a project subpath:

1. Push to your repo.
2. Settings → Pages → Source: deploy from `main` branch, `/ (root)` folder.
3. Done. (To use a `/docs` folder instead, move these files there and pick it.)

---

Built for Colorado couples. The mountains are calling. 🥾
