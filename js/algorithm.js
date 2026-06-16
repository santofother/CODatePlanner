// js/algorithm.js — preference matching score + weekly rotation logic.
//
// Implements the scoring model from CLAUDE.md, refined a little:
//  - blends both partners' survey answers
//  - honors car / light-rail and distance-tolerance preferences
//  - applies a learning multiplier from post-date reviews

export function currentSeason(date = new Date()) {
  const m = date.getMonth(); // 0=Jan
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

// Monday (ISO) of the week containing `date`, as YYYY-MM-DD.
export function weekStartOf(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=Mon
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// Combine two partner surveys into one couple preference profile.
// If only one survey exists, the couple profile mirrors it (no dilution toward 5).
export function blendSurveys(s1, s2) {
  const a = s1 || s2 || {};
  const b = s2 || s1 || {}; // when only one survey is present, both sides mirror it
  const avg = (x, y) => (Number(x ?? 5) + Number(y ?? 5)) / 2;
  const cats = new Set([...(a.favorite_categories || []), ...(b.favorite_categories || [])]);
  return {
    outdoorsy: avg(a.outdoorsy_score, b.outdoorsy_score),
    activity: avg(a.activity_level, b.activity_level),
    budget: avg(a.budget_range, b.budget_range),
    spontaneity: avg(a.spontaneity, b.spontaneity),
    social: avg(a.social_vibe, b.social_vibe),
    distanceTol: avg(a.distance_tolerance, b.distance_tolerance),
    favorite_categories: [...cats],
    // distance in miles: take the MIN of partners' explicit caps (must satisfy both)
    distance_miles: Math.min(a.distance_miles ?? 100, b.distance_miles ?? 100),
    // need transit-friendly dates only if EITHER partner lacks a car
    needs_transit: (a.has_car === false) || (b.has_car === false),
  };
}

// Build category → avg-rating map from completed reviews (the "learning" layer).
export function preferenceWeights(coupleDates, catalog) {
  const byCat = {};
  const catOf = id => (catalog.find(d => d.id === id) || {}).category;
  for (const cd of coupleDates) {
    if (cd.status !== 'done' || cd.review_vibe_rating == null) continue;
    const cat = catOf(cd.date_catalog_id);
    if (!cat) continue;
    (byCat[cat] ||= []).push(cd.review_vibe_rating);
  }
  const weights = {};
  for (const [cat, arr] of Object.entries(byCat)) {
    weights[cat] = arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  return weights; // e.g. { brewery: 4.8, mountain: 4.2 }
}

// Score a single date 0–100 for a couple.
export function scoreDate(date, pref, ctx = {}) {
  const { season = currentSeason(), weights = {} } = ctx;
  let score = 0;
  const why = [];

  // Category preference match (0–30)
  if (pref.favorite_categories.includes(date.category)) { score += 30; why.push('a category you love'); }
  else score += 6;

  // Activity level match (0–20)
  const activityDelta = Math.abs((date.difficulty_score || 3) - pref.activity);
  score += Math.max(0, 20 - activityDelta * 2.2);

  // Budget match (0–15) — under budget is fine, over budget penalized
  const budgetTier = Math.round(pref.budget / 10 * 3); // 1-10 → 0-3
  if (date.cost_tier <= budgetTier) score += 15;
  else score -= (date.cost_tier - budgetTier) * 7;

  // Seasonal relevance (0–20)
  if (date.seasonal_tags.includes(season)) { score += 20; why.push(`great for ${season}`); }
  else if (date.seasonal_tags.includes('any')) score += 11;

  // Distance tolerance (0–15) — both the soft slider and the hard mile cap
  if ((date.distance_miles || 0) <= pref.distance_miles) score += 15;
  else { score -= 12; why.push('a bit of a haul'); }

  // Transit requirement (hard-ish): if couple needs transit, non-transit dates drop
  if (pref.needs_transit && !date.transit) score -= 20;

  // Outdoorsy alignment — nudge based on indoor/outdoor vs outdoorsy score
  if (date.indoor_outdoor === 'outdoor') score += (pref.outdoorsy - 5) * 1.2;
  if (date.indoor_outdoor === 'indoor') score += (5 - pref.outdoorsy) * 1.0;

  // Learning multiplier from reviews
  const w = weights[date.category];
  if (w != null) {
    const mult = w / 5.0; // 0.2 – 1.0
    score *= (0.6 + 0.4 * mult * 2); // gently scale, keep range sane
    if (w >= 4) why.push('similar dates wowed you');
    else if (w <= 2.5) why.push('past picks here fell flat');
  }

  // Base catalog quality nudge
  score += (date.base_score || 5) * 0.6;

  const pct = Math.max(0, Math.min(100, Math.round(score)));
  return { score: pct, why };
}

export function scoreCatalog(catalog, pref, ctx = {}) {
  return catalog
    .map(d => ({ date: d, ...scoreDate(d, pref, ctx) }))
    .sort((a, b) => b.score - a.score);
}

// Is a time-sensitive event currently active (or upcoming soon)?
export function eventActive(date, now = new Date()) {
  if (!date.time_sensitive || !date.event_start) return false;
  const start = new Date(date.event_start), end = new Date(date.event_end || date.event_start);
  // active window, or starting within ~3 weeks
  const soon = new Date(now); soon.setDate(soon.getDate() + 21);
  return end >= now && start <= soon;
}

// ── Weekly rotation: pick 4 dates per CLAUDE.md slot logic ──
// statusMap: { dateId: status }  excludedSet computed from done/pass/recent.
export function buildWeeklyLineup(catalog, pref, statusMap, ctx = {}) {
  const season = ctx.season || currentSeason();
  const scored = scoreCatalog(catalog, pref, { ...ctx, season });

  const excluded = new Set(
    Object.entries(statusMap).filter(([, s]) => s === 'done' || s === 'pass').map(([id]) => id)
  );
  ctx.recentlyShown?.forEach(id => excluded.add(id));

  const pool = scored.filter(s => !excluded.has(s.date.id));
  const picked = [];
  const take = (pred, label) => {
    const found = pool.find(s => !picked.includes(s) && pred(s));
    if (found) { found.slot = label; picked.push(found); }
    return found;
  };

  // Slot 1 — active time-sensitive event, highest scoring
  take(s => eventActive(s.date), 'Time-sensitive');
  // Slot 2 — seasonal match, highest unplayed
  take(s => s.date.seasonal_tags.includes(season), 'In season now');
  // Slot 3 — high match, anytime
  take(s => s.date.seasonal_tags.includes('any') || true, 'Top match');
  // Slot 4 — wildcard: moderate score, outside comfort zone (category not in favorites)
  take(s => !pref.favorite_categories.includes(s.date.category) && s.score >= 35, 'Push your limits');

  // Backfill to 4 with best remaining
  for (const s of pool) {
    if (picked.length >= 4) break;
    if (!picked.includes(s)) { s.slot = s.slot || 'Top match'; picked.push(s); }
  }
  return picked.slice(0, 4);
}

// Derive a fun "date personality" badge from blended preferences + reviews.
export function personalityBadge(pref, weights = {}) {
  const ranked = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const topReviewed = ranked.length ? ranked[0][0] : null;
  const topFav = pref.favorite_categories[0];
  const cat = topReviewed || topFav || 'mountain';
  const map = {
    mountain: ['Mountain Explorers', '🏔️'],
    brewery: ['Brewery Hoppers', '🍺'],
    culture: ['Culture Vultures', '🎭'],
    sports: ['Adventure Seekers', '🏅'],
    chill: ['Cozy Homebodies', '🕯️'],
    city: ['City Wanderers', '🌆'],
    seasonal: ['Season Chasers', '🍂'],
  };
  const [label, emoji] = map[cat] || map.mountain;
  return { label, emoji, basis: cat };
}
