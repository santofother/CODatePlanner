# CLAUDE.md — Peak Dates 🏔️
## Colorado Couples Date Planner

> A Colorado-themed couples date planner that learns your preferences and surfaces the perfect weekly date ideas — from Red Rocks concerts to alpine hikes to cozy brewery nights.

---

## Project Overview

**App Name:** Peak Dates (tagline: *"Every date, a new summit"*)
**Hosting:** GitHub Pages — single `index.html` SPA (no server-side rendering)
**Auth & Database:** Supabase (free tier) — handles user accounts, couples profiles, and all date data
**Stack:** Vanilla JS + CSS (no framework), or Vite + React if complexity warrants it. Decide at start of development.
**Repository structure:** Everything builds to `/docs` folder for GitHub Pages deployment, OR uses `gh-pages` branch.

---

## Visual Design & Theme

### Aesthetic Direction
Colorado wilderness meets cozy mountain cabin. Think: the feeling of stepping out of a warm lodge into a crisp evening with the Rockies lit up at dusk.

### Color Palette
```
--color-summit:     #2D4A3E   /* Deep forest green — primary brand */
--color-trail:      #8B4513   /* Burnt sienna — accent/CTA */
--color-alpine:     #4A7FA5   /* Slate blue — links, highlights */
--color-snowpack:   #F5F0E8   /* Warm cream — backgrounds */
--color-granite:    #6B7280   /* Cool gray — secondary text */
--color-aspen:      #D4A843   /* Golden aspen — stars, badges, warm accents */
--color-dusk:       #1A2B3C   /* Deep navy — dark mode base, text */
```

### Typography
- **Display:** `Playfair Display` or `Cormorant Garamond` — used for hero headings, date card titles (national park sign energy)
- **Body:** `Inter` or `DM Sans` — clean, readable for surveys and UI
- **Accent/Labels:** `Courier Prime` or monospace — elevation stats, distance, "5,280 ft" callouts

### Signature Design Element
**Topographic contour lines** used as subtle background texture throughout — SVG lines that appear in hero sections, card backgrounds, and loading states. The lines animate gently on load.

### Micro-copy Voice
Friendly, outdoorsy, slightly punny. Examples:
- Loading: *"Scouting your next summit..."*
- Empty state: *"Your trail is clear — add some date ideas to get started"*
- Post-date: *"Another peak conquered! How'd it go?"*
- Algorithm improving: *"Updating your elevation profile..."*
- Bad idea flagged: *"Noted — not every trail is worth the climb"*

---

## App Architecture

### Pages / Views (Single Page App routing)

```
/                    → Landing / Login / Signup
/onboarding          → Couple setup + preference surveys
/dashboard           → Weekly rotation + date queue
/discover            → Browse all Colorado date ideas
/date/:id            → Individual date detail page
/history             → Completed dates archive / scrapbook
/profile             → Couple profile + re-take surveys
/settings            → Account settings
```

### URL routing
Use hash-based routing (`/#/dashboard`) since GitHub Pages doesn't support server-side redirects. Implement a simple client-side router.

---

## Supabase Schema

### Tables

#### `profiles`
```sql
id              uuid (FK → auth.users)
username        text
display_name    text  -- couple name e.g. "The Hendersons"
partner_id      uuid (FK → profiles, nullable)
partner_invite_code  text unique
avatar_emoji    text
created_at      timestamp
```

#### `partner_surveys`
```sql
id              uuid
user_id         uuid (FK → profiles)
-- Preference sliders (1-10 scale)
outdoorsy_score       int   -- 1=cozy homebody, 10=summit-chaser
activity_level        int   -- 1=relaxed, 10=high-energy
budget_range          int   -- 1=budget, 10=splurge-worthy
spontaneity           int   -- 1=planner, 10=spontaneous
social_vibe           int   -- 1=just us, 10=love a crowd
distance_tolerance    int   -- 1=stay close, 10=road trip ready
-- Checkboxes (stored as JSON arrays)
favorite_categories   jsonb  -- ['mountains','breweries','culture',...]
dietary_notes         text
mobility_notes        text
updated_at            timestamp
```

#### `dates_catalog`
```sql
id              uuid
title           text
description     text
category        text   -- 'mountain','brewery','culture','seasonal','chill','city'
subcategory     text
location_name   text
location_city   text
lat             float
lng             float
estimated_cost  text   -- 'free','$','$$','$$$'
duration_hours  float
difficulty      text   -- 'easy','moderate','challenging'
seasonal_tags   text[] -- ['winter','spring','summer','fall','any']
time_sensitive  boolean
event_start     timestamp  -- for limited-time events
event_end       timestamp
indoor_outdoor  text   -- 'indoor','outdoor','both'
website_url     text
image_url       text
tags            text[]
-- Scoring weights for algorithm
base_score      float
created_at      timestamp
is_active       boolean
```

#### `couple_dates`
```sql
id              uuid
couple_id       uuid   -- derived from both user IDs (store as sorted concat)
date_catalog_id uuid (FK → dates_catalog)
status          text   -- 'suggested','pinned','done','maybe','pass'
suggested_at    timestamp
pinned_at       timestamp
completed_at    timestamp
flagged_reason  text   -- for 'pass' status
-- Post-date review fields
review_vibe_rating      int   -- 1-5
review_cost_vs_expect   int   -- 1=way over, 3=as expected, 5=great value
review_would_repeat     boolean
review_highlight        text  -- free text "what made it special"
review_effort_rating    int   -- 1-5 (1=too hard, 5=perfect effort)
review_photo_url        text
review_submitted_at     timestamp
```

#### `weekly_rotations`
```sql
id              uuid
couple_id       uuid
week_start      date   -- Monday of the week
date_ids        uuid[] -- array of 4 date IDs for this week
generated_at    timestamp
```

---

## Algorithm Design

### Preference Matching Score
For each date in the catalog, calculate a match score (0–100) per couple:

```
score = 0

// Category preference match (0-30 pts)
if date.category in couple.favorite_categories → +30

// Activity level match (0-20 pts)  
activityDelta = abs(date.difficulty_score - avg(partner1.activity_level, partner2.activity_level))
score += 20 - (activityDelta * 2)

// Budget match (0-15 pts)
if date.cost_tier <= couple.budget_tier → +15, else penalty

// Seasonal relevance (0-20 pts)
if date.seasonal_tags includes currentSeason → +20
if date.seasonal_tags includes 'any' → +10

// Distance tolerance (0-15 pts)
if date.distance <= couple.distance_tolerance_miles → +15

// Learning boost: from post-date reviews
if past similar date had high vibe_rating → +10 bonus
if past similar date had low vibe_rating → -15 penalty
```

### Weekly Rotation Logic
```
Each Monday, generate 4 dates for "This Week's Lineup":
  Slot 1: Time-sensitive / event (if any active) — highest scoring
  Slot 2: Seasonal match — highest unplayed seasonal date  
  Slot 3: High match score — anytime date, not yet done
  Slot 4: Wildcard — moderate score, outside comfort zone (push growth)

Exclude: dates with status 'done', 'pass', or shown in last 4 weeks
Deprioritize: 'maybe' dates unless they've been waiting 8+ weeks
```

### Learning from Reviews
Store category-level ratings. After 3+ reviews, build a `preference_weights` map:
```json
{
  "brewery": 4.8,
  "hiking": 4.2,
  "museums": 2.1,
  "seasonal": 3.9
}
```
Multiply base algorithm score by `(preference_weight / 5.0)` for future suggestions.

---

## Feature Specs

### 1. Account Creation & Couple Linking
- Sign up with email + password via Supabase Auth
- After signup → onboarding flow
- Generate a unique 6-character invite code
- Partner enters code to link accounts as a couple
- Both partners can view and interact with the shared date board

### 2. Onboarding Survey (one-time, re-takeable)
Two-part survey, one per partner:

**Part 1 — Your Vibe (preference sliders)**
- "On a free Saturday, I'd rather..." (5 slider questions)
- "When it comes to dates, we tend to..." (budget, planning style)

**Part 2 — Your Colorado Favorites (checkbox grid)**
- Category picks: Mountains, Breweries, Restaurants, Culture/Arts, Sports, Outdoors/Hiking, Road Trips, Cozy/Indoor, Events/Festivals, Hot Springs, Skiing/Snow

**Part 3 — Good to Know**
- Any dietary needs? (text)
- Any mobility considerations? (text, optional)
- Distance you're willing to travel (slider: 10mi → 200mi)

After both partners complete → generate first week's lineup → go to dashboard.

### 3. Dashboard — "This Week's Lineup"
- 4 date cards in a horizontal scroll or 2x2 grid
- Each card shows: image, title, category badge, cost indicator, time/difficulty chips
- ⏰ badge on time-sensitive events with countdown
- Card actions: ❤️ Pin It | 💛 Maybe | 👎 Pass | ✅ Mark Done
- "Refresh week" button (cooldown: can only refresh once per week)
- Below lineup: "Also on your radar" — a scrollable row of pinned dates

### 4. Discover Page
- Full catalog of Colorado dates
- Filter bar: Category, Season, Cost, Distance, Indoor/Outdoor, Difficulty
- Search bar
- Each card has the same status actions
- Map view toggle (show dates plotted on Colorado map using Leaflet.js)

### 5. Date Detail Page
- Full description, photos, website link
- Tags: season, category, difficulty, cost, duration
- "Plan It" button → mark as Pinned, optionally add a note/target date
- If status = Done → show post-date review card

### 6. Date Status System
```
💡 Suggested    → In weekly lineup, no action taken
📌 Pinned       → "We're planning to do this"
✅ Done         → Completed — triggers post-date survey
💛 Maybe        → Save for later, resurface in 8 weeks
❌ Pass         → Not for us — brief reason prompt (optional)
```
All statuses visible on Discover page as filter chips.

### 7. Post-Date Survey (triggered when marking Done)
5 quick questions (keep it under 60 seconds):
1. ⭐ Overall vibe: 1–5 stars
2. 💰 Cost vs expectations: slider (Way over → Great value)
3. 🔁 Would you do it again? Yes / Maybe / No
4. ✨ Best moment: short text (optional, 140 char)
5. 💪 Effort level: 1–5 (Too easy → Exhausting)

Optional: upload a photo memory.

### 8. History / Scrapbook
- Timeline of completed dates, newest first
- Each entry shows: date, photo (if uploaded), rating stars, highlight quote
- "Relationship Stats" sidebar:
  - Total dates done
  - Favorite category
  - Money spent (estimated)
  - Most recent date
  - Longest streak

### 9. Profile Page
- Couple name + avatar emoji picker
- View both partners' survey answers side-by-side
- "Retake survey" button for either partner
- "Date personality badge" — algorithm-derived (e.g., "Mountain Explorers 🏔️", "Brewery Hoppers 🍺", "Culture Vultures 🎭")

---

## Colorado Date Ideas Seed Data

Populate `dates_catalog` with at least 50 dates across categories. Examples:

### Mountain / Outdoor
- Hike to St. Mary's Glacier (any season, easy-moderate)
- Sunrise at Rocky Mountain National Park (summer)
- Mount Falcon sunset hike (spring/fall)
- Ice skating on Evergreen Lake (winter)
- Chautauqua Park sunrise picnic (spring/summer)

### Seasonal
- Pumpkin patch at Anderson Farms (fall)
- Cherry Creek Arts Festival (summer, time-sensitive)
- Chatfield Sunflower Festival (late summer, time-sensitive)
- Breckenridge snow sculpture championships (winter, time-sensitive)
- Aspen/Maroon Bells fall foliage drive (fall)

### Breweries & Food
- Great Divide Brewing tour (any)
- Odell Brewing taproom Fort Collins (any)
- Denver food hall crawl — Zeppelin Station + Denver Central Market
- Farm-to-table dinner at Mercantile ($$)
- Hot chocolate and fireplace at Dillon Reservoir area

### Culture / Events
- Red Rocks Amphitheatre concert (seasonal, time-sensitive)
- Denver Art Museum late night (any)
- Meow Wolf Denver — Convergence Station (any)
- Colorado Symphony date night (any)
- Denver Botanic Gardens (seasonal, various events)

### Chill / Cozy
- Strawberry Park Hot Springs, Steamboat (any, road trip)
- Mount Princeton Hot Springs (any)
- Stargazing at Eleven Mile Reservoir (summer/fall)
- Board game café date in RiNo
- Bookstore crawl + coffee in Capitol Hill

### City / Neighborhood
- Larimer Square dinner + walk (any)
- RiNo Art District mural walk + brunch (any)
- Washington Park paddleboats + picnic (summer)
- Denver Botanic Gardens evening stroll (seasonal)

---

## File Structure

```
/
├── index.html              ← Entry point, loads everything
├── css/
│   ├── main.css            ← Design tokens + global styles
│   ├── components.css      ← Cards, buttons, forms, modals
│   └── pages.css           ← Page-specific layouts
├── js/
│   ├── app.js              ← Router + app init
│   ├── auth.js             ← Supabase auth (login, signup, logout)
│   ├── db.js               ← All Supabase queries (one file, exported functions)
│   ├── algorithm.js        ← Scoring + weekly rotation logic
│   ├── survey.js           ← Survey rendering + submission
│   ├── ui.js               ← Reusable UI helpers (toast, modal, spinner)
│   └── pages/
│       ├── landing.js
│       ├── onboarding.js
│       ├── dashboard.js
│       ├── discover.js
│       ├── date-detail.js
│       ├── history.js
│       └── profile.js
├── assets/
│   ├── icons/              ← SVG icons
│   ├── topo-texture.svg    ← Topographic line texture
│   └── og-image.png        ← Social share image
├── data/
│   └── seed-dates.json     ← Local seed data (50+ Colorado dates)
└── CLAUDE.md               ← This file
```

---

## Development Phases

### Phase 1 — Foundation
- [ ] Supabase project setup + schema creation
- [ ] index.html shell + CSS design tokens
- [ ] Hash router implementation
- [ ] Landing page + login/signup forms (Supabase Auth)
- [ ] Basic navigation

### Phase 2 — Onboarding & Profiles
- [ ] Partner survey UI (sliders + checkboxes)
- [ ] Couple linking via invite code
- [ ] Profile page with survey results
- [ ] Date personality badge logic

### Phase 3 — Date Catalog
- [ ] Seed data JSON (50+ dates)
- [ ] Seed script to populate Supabase
- [ ] Discover page with filter/search
- [ ] Date detail page
- [ ] Status actions (pin, maybe, pass, done)

### Phase 4 — Algorithm & Dashboard
- [ ] Scoring algorithm (algorithm.js)
- [ ] Weekly rotation generation
- [ ] Dashboard — "This Week's Lineup"
- [ ] Weekly refresh logic + cooldown

### Phase 5 — Reviews & Learning
- [ ] Post-date survey modal
- [ ] Review storage + retrieval
- [ ] Algorithm learning from reviews
- [ ] History / scrapbook page

### Phase 6 — Polish
- [ ] Map view on Discover page (Leaflet.js)
- [ ] Topographic texture animations
- [ ] Responsive mobile layout
- [ ] Loading states + error handling
- [ ] Empty states with Colorado micro-copy
- [ ] GitHub Pages deployment

---

## Key Technical Decisions

### Why Supabase?
- Free tier covers auth + postgres database + storage (for photos)
- Row-level security means couples only see their own data
- Realtime subscriptions could allow partner to see updates live (future feature)
- No backend code needed — all queries from client JS

### Supabase Row Level Security (RLS) Policy Sketch
```sql
-- profiles: users can read/write their own + their partner's
-- couple_dates: both partners in a couple can read/write
-- dates_catalog: public read, admin write only
```

### No-Backend Photo Storage
Use Supabase Storage bucket `date-memories` — upload directly from browser, store public URL in `couple_dates.review_photo_url`.

### GitHub Pages Deployment
- Build output to `/docs` folder
- Enable GitHub Pages → Source: `/docs` folder on `main` branch
- No custom domain required (but supports it)
- Use relative paths throughout (`./js/app.js` not `/js/app.js`)

### Environment Variables on GitHub Pages
Supabase URL and anon key are public-safe (RLS enforces security).
Store in a `config.js` file:
```js
// js/config.js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

---

##Additional elements 
Be able to set your locatrion to varois levels of specifis depending on preferece, denver, South dencer, Univerity, and specifc address. 
And have stuff like you own a car or looking for dates where you can use light rail 
and stuff that is withon a cerain driving range time and miles

## Tone & Copy Guidelines

- Voice: Warm, adventurous, slightly punny — like a Colorado outdoor guide who also loves craft beer
- Avoid: Corporate jargon, generic "explore" CTAs without context
- Embrace: Colorado-specific references (14ers, the Front Range, "the mountains are calling")
- Altitude puns: use sparingly but delightfully
- Button copy: action-oriented ("Let's Plan It", "Summit This Date", "We Did It!")
- Error states: never blame the user, always redirect ("Couldn't load dates — maybe the Wi-Fi is at altitude too. Try again?")

---

## Future Features (Post-MVP)

- 📱 PWA with push notifications for Monday rotation reveal
- 🗺️ Partner live-reaction mode (both see same date and can react in realtime)
- 📸 Full photo gallery / scrapbook with memories timeline
- 🎁 Gift mode — plan a surprise date for your partner
- 👥 Friend couples — see what other couples have done (opt-in)
- 📅 Calendar integration — add pinned dates to Google Calendar
- 🌐 Expand beyond Colorado (user-submitted date ideas)
- 🤖 AI-generated personalized date descriptions based on couple profile
