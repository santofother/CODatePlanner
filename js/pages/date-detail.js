// js/pages/date-detail.js — full info for a single date + status actions + review.

import { el, costLabel, titleCase, fmtDate, starsDisplay, emptyState } from '../ui.js';
import { store } from '../store.js';
import { session, coupleDateFor } from '../state.js';
import { scoreDate, currentSeason, eventActive } from '../algorithm.js';
import { statusActions, catMeta, matchMeter, countdownText, reviewModal } from '../components.js';

export default async function renderDateDetail(view, id) {
  const d = await store.getDate(id);
  const container = el('div.container');
  view.appendChild(container);

  if (!d) {
    container.appendChild(emptyState({ emoji: '🧭', title: 'Trail not found', text: 'That date isn\'t in the catalog.', action: el('a.btn.btn-ghost', { href: '#/discover' }, '← Back to Discover') }));
    return;
  }

  const { score, why } = scoreDate(d, session.pref, { season: currentSeason(), weights: session.weights });

  function paint() {
    container.replaceChildren();
    const cd = coupleDateFor(d.id);

    container.appendChild(el('a.btn.btn-ghost.btn-sm', { href: '#/discover', style: 'margin-bottom:16px' }, '← All dates'));

    const hero = el('div.detail-hero', {}, d.image_emoji || '📍');
    if (eventActive(d) && countdownText(d)) hero.appendChild(el('span.badge.live', { style: 'position:absolute;top:16px;right:16px' }, '⏰ ' + countdownText(d)));
    container.appendChild(hero);

    const main = el('div', {}, [
      el('div.row.wrap', { style: 'align-items:center;gap:10px;margin-bottom:6px' }, [
        el('span.chip.season', {}, `${catMeta(d.category).emoji} ${catMeta(d.category).label}`),
        matchMeter(score),
      ]),
      el('h1', { style: 'margin:.1em 0' }, d.title),
      el('div.muted', {}, `📍 ${d.location_name} · ${d.location_city}, CO`),
      el('p', { style: 'font-size:1.08rem;margin-top:16px' }, d.description),
      why.length ? el('div.card.card-pad', { style: 'background:var(--summit-faint);border:none;margin-top:8px' }, [
        el('div.mono', { style: 'font-size:.7rem;letter-spacing:1.5px;color:var(--cta)' }, 'WHY IT MATCHES YOU'),
        el('div', { style: 'margin-top:6px' }, '✓ ' + why.join(' · ')),
      ]) : null,
      d.entry_instructions ? el('div.card.card-pad', { style: 'margin-top:14px;border:none;border-left:3px solid var(--cta);background:rgba(139,69,19,0.07)' }, [
        el('div.mono', { style: 'font-size:.7rem;letter-spacing:1.5px;color:var(--cta)' }, '🤫 HOW TO GET IN'),
        el('div', { style: 'margin-top:6px' }, d.entry_instructions),
        d.price_detail ? el('div.muted', { style: 'margin-top:8px;font-size:.85rem' }, '💵 ' + d.price_detail) : null,
        el('div.muted', { style: 'margin-top:6px;font-size:.78rem' }, 'Entrances & hours change — check the official site and reserve ahead.'),
      ]) : null,
      el('div.row.wrap', { style: 'gap:6px;margin-top:18px' }, (d.tags || []).map(t => el('span.chip', {}, '#' + t))),
      d.website_url ? el('div', { style: 'margin-top:18px' }, el('a.btn.btn-ghost', { href: d.website_url, target: '_blank', rel: 'noopener' }, '🔗 Official site')) : null,
    ]);

    // review block if done
    if (cd?.status === 'done' && cd.review_submitted_at) {
      main.appendChild(reviewCard(cd));
    }

    // sidebar facts + actions
    const facts = [
      ['Cost', costLabel(d.cost_tier)],
      ...(d.price_detail ? [['Drinks', d.price_detail]] : []),
      ['Difficulty', titleCase(d.difficulty)],
      ['Duration', d.duration_hours + ' hrs'],
      ['Setting', titleCase(d.indoor_outdoor)],
      ['Distance', (d.distance_miles ?? '—') + ' mi from Denver'],
      ['Light rail', d.transit ? 'Yes 🚈' : 'Car recommended'],
      ['Best season', d.seasonal_tags.map(titleCase).join(', ')],
    ];
    if (d.time_sensitive && d.event_start) facts.push(['Event window', `${fmtDate(d.event_start)} – ${fmtDate(d.event_end)}`]);

    const planBtn = el('button.btn.btn-primary.btn-block.btn-lg', { onClick: async () => {
      await store.setStatus(session.coupleId, d.id, 'pinned', { pinned_at: new Date().toISOString() });
      const { refreshCoupleDates } = await import('../state.js');
      await refreshCoupleDates();
      const { toast } = await import('../ui.js');
      toast('Pinned — let\'s plan it! 📌', 'success');
      paint();
    } }, cd?.status === 'pinned' ? '📌 Pinned' : "Let's Plan It");

    const sidebar = el('aside.detail-sidebar', {}, [
      el('div.card.card-pad', {}, [
        ...facts.map(([k, v]) => el('div.fact-row', {}, [el('span.k', {}, k), el('span.v', {}, v)])),
        el('div', { style: 'margin-top:16px' }, planBtn),
        el('div', { style: 'margin-top:10px' }, statusActions(d, paint)),
        cd?.status !== 'done' ? el('button.btn.btn-summit.btn-block', { style: 'margin-top:10px', onClick: () => reviewModal(d, paint) }, '✅ We did it!') : null,
      ]),
    ]);

    container.appendChild(el('div.detail-grid', {}, [main, sidebar]));
  }

  function reviewCard(cd) {
    return el('div.card.card-pad', { style: 'margin-top:22px' }, [
      el('div.section-title', {}, [el('h3', { style: 'margin:0' }, 'Your review'), el('span.mono', {}, fmtDate(cd.review_submitted_at).toUpperCase())]),
      el('div.row', { style: 'align-items:center;gap:14px;flex-wrap:wrap' }, [
        starsDisplay(cd.review_vibe_rating),
        el('span.chip', {}, `Value: ${cd.review_cost_vs_expect}/5`),
        el('span.chip', {}, `Effort: ${cd.review_effort_rating}/5`),
        el('span.chip', {}, cd.review_would_repeat ? '🔁 Would repeat' : 'One and done'),
      ]),
      cd.review_highlight ? el('p.highlight-quote', { style: 'margin-top:12px' }, `“${cd.review_highlight}”`) : null,
    ]);
  }

  paint();
}
