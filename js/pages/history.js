// js/pages/history.js — scrapbook timeline of completed dates + relationship stats.

import { el, fmtDate, starsDisplay, emptyState } from '../ui.js';
import { session } from '../state.js';
import { catMeta } from '../components.js';

export default async function renderHistory(view) {
  const container = el('div.container');
  view.appendChild(container);

  const done = session.coupleDates
    .filter(cd => cd.status === 'done')
    .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));

  container.appendChild(el('div.section-title', {}, [el('h2', {}, 'Scrapbook'), el('span.mono', {}, done.length + ' PEAKS BAGGED')]));

  if (!done.length) {
    container.appendChild(emptyState({
      emoji: '📖', title: 'Your scrapbook is waiting',
      text: 'Mark a date as done and it\'ll start your trail of memories here.',
      action: el('a.btn.btn-summit', { href: '#/dashboard' }, "See this week's lineup →"),
    }));
    return;
  }

  // ── Stats sidebar (computed) ──
  const catCount = {};
  let spent = 0, repeats = 0;
  done.forEach(cd => {
    const d = session.catalog.find(x => x.id === cd.date_catalog_id);
    if (!d) return;
    catCount[d.category] = (catCount[d.category] || 0) + 1;
    spent += [0, 25, 65, 140][d.cost_tier] || 0;
    if (cd.review_would_repeat) repeats++;
  });
  const favCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
  const avgVibe = done.filter(cd => cd.review_vibe_rating).reduce((a, cd, _, arr) => a + cd.review_vibe_rating / arr.length, 0);
  const streak = computeStreak(done);

  const pill = (n, l) => el('div.stat-pill', {}, [el('div.n', {}, n), el('div.l', {}, l)]);
  container.appendChild(el('div.stat-strip', { style: 'margin-bottom:30px' }, [
    pill(done.length, 'Dates done'),
    pill(favCat ? `${catMeta(favCat[0]).emoji}` : '—', favCat ? catMeta(favCat[0]).label : '—'),
    pill('$' + spent, 'Est. spent'),
    pill(avgVibe ? avgVibe.toFixed(1) + '★' : '—', 'Avg vibe'),
    pill(streak + 'w', 'Longest streak'),
  ]));

  // ── Timeline ──
  const timeline = el('div.timeline');
  done.forEach(cd => {
    const d = session.catalog.find(x => x.id === cd.date_catalog_id);
    if (!d) return;
    timeline.appendChild(el('div.timeline-item', {}, [
      el('div.timeline-date', {}, fmtDate(cd.completed_at).toUpperCase()),
      el('div.card.card-pad', { style: 'margin-top:8px' }, [
        el('div.scrapbook-card', {}, [
          el('div.ph', {}, d.image_emoji),
          el('div.grow', {}, [
            el('div.row.spread', { style: 'align-items:center;gap:8px;flex-wrap:wrap' }, [
              el('h3', { style: 'margin:0;cursor:pointer', onClick: () => location.hash = '#/date/' + d.id }, d.title),
              cd.review_vibe_rating ? starsDisplay(cd.review_vibe_rating) : null,
            ]),
            el('div.muted', { style: 'font-size:.85rem' }, `${catMeta(d.category).label} · ${d.location_city}`),
          ]),
        ]),
        cd.review_highlight ? el('p.highlight-quote', { style: 'margin:12px 0 0' }, `“${cd.review_highlight}”`) : null,
      ]),
    ]));
  });
  container.appendChild(timeline);
}

// Longest run of consecutive calendar weeks with at least one completed date.
function computeStreak(done) {
  const weeks = new Set(done.map(cd => {
    const d = new Date(cd.completed_at || Date.now());
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }));
  const sorted = [...weeks].sort();
  let best = sorted.length ? 1 : 0, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]), cur = new Date(sorted[i]);
    if ((cur - prev) === 7 * 86400000) { run++; best = Math.max(best, run); } else run = 1;
  }
  return best;
}
