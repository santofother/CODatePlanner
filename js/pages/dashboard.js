// js/pages/dashboard.js — "This Week's Lineup" + radar + relationship stats.

import { el, toast, loadingState, emptyState, fmtDate } from '../ui.js';
import { store } from '../store.js';
import { session, statusMap, refreshCoupleDates } from '../state.js';
import { buildWeeklyLineup, weekStartOf, currentSeason } from '../algorithm.js';
import { dateCard, catMeta } from '../components.js';

export default async function renderDashboard(view) {
  const container = el('div.container');
  view.appendChild(container);
  container.appendChild(loadingState('Scouting this week\'s summits…'));

  const weekStart = weekStartOf();
  let rotation = await store.getRotation(session.coupleId, weekStart);

  // Generate the lineup if we don't have one for this week yet.
  if (!rotation) {
    const recent = await recentlyShown();
    const lineup = buildWeeklyLineup(session.catalog, session.pref, statusMap(), { season: currentSeason(), recentlyShown: recent });
    rotation = await store.saveRotation(session.coupleId, weekStart, lineup.map(s => s.date.id));
  }

  await refreshCoupleDates();
  await paint();

  async function paint() {
    container.replaceChildren();

    const couple = session.user.couple_name || session.user.display_name;
    const partnerNote = session.partner
      ? `${session.user.display_name} & ${session.partner.display_name}`
      : 'Solo for now — link your partner in Profile';

    // Header
    container.appendChild(el('div.dash-head', {}, [
      el('div', {}, [
        el('div.wk', {}, `WEEK OF ${fmtDate(weekStart).toUpperCase()} · ${currentSeason().toUpperCase()}`),
        el('h1', { style: 'margin:.1em 0' }, `${session.user.avatar_emoji} ${couple}`),
        el('div.muted', {}, partnerNote),
      ]),
      refreshBtn(),
    ]));

    container.appendChild(el('div.section-title', {}, [el('h2', {}, "This Week's Lineup"), el('span.mono', {}, '4 PICKS')]));

    // Lineup
    const scoredById = new Map(session.catalog.map(d => [d.id, d]));
    const lineup = await store.getRotation(session.coupleId, weekStart);
    const grid = el('div.lineup-grid');
    const slotLabels = ['Time-sensitive', 'In season now', 'Top match', 'Push your limits'];
    lineup.date_ids.forEach((id, i) => {
      const d = scoredById.get(id);
      if (!d) return;
      grid.appendChild(dateCard({ date: d, slot: slotLabels[i] }, { onChange: paint, showSlot: true }));
    });
    container.appendChild(grid);

    // Also on your radar — pinned dates
    const pinned = session.coupleDates.filter(cd => cd.status === 'pinned');
    container.appendChild(el('div.section-title', { style: 'margin-top:36px' }, [el('h2', {}, 'Also on your radar'), el('span.mono', {}, pinned.length + ' PINNED')]));
    if (pinned.length) {
      const row = el('div.radar-scroll');
      pinned.forEach(cd => {
        const d = scoredById.get(cd.date_catalog_id);
        if (d) row.appendChild(dateCard({ date: d }, { onChange: paint }));
      });
      container.appendChild(row);
    } else {
      container.appendChild(emptyState({ emoji: '📌', title: 'Your trail is clear', text: 'Pin dates you want to plan and they\'ll gather here.', action: el('a.btn.btn-ghost', { href: '#/discover' }, 'Browse all dates →') }));
    }

    // Relationship stats
    container.appendChild(el('hr.divider'));
    container.appendChild(statStrip());
  }

  function refreshBtn() {
    const can = canRefresh();
    const btn = el('button.btn' + (can ? '.btn-summit' : '.btn-ghost'), { onClick: doRefresh, disabled: !can ? true : null }, can ? '🔄 Refresh week' : '🔒 Refreshed');
    if (!can) btn.title = 'One refresh per week — fresh picks next Monday';
    return btn;
  }
  function canRefresh() {
    // allow one regeneration per week beyond the initial auto-generation
    return localStorage.getItem('peakdates.refreshed.' + weekStart) !== '1';
  }
  async function doRefresh() {
    const recent = await recentlyShown();
    const lineup = buildWeeklyLineup(session.catalog, session.pref, statusMap(), { season: currentSeason(), recentlyShown: recent });
    await store.saveRotation(session.coupleId, weekStart, lineup.map(s => s.date.id));
    localStorage.setItem('peakdates.refreshed.' + weekStart, '1');
    toast('Fresh lineup scouted! 🗺️', 'success');
    await paint();
  }

  function statStrip() {
    const done = session.coupleDates.filter(cd => cd.status === 'done');
    const catCount = {};
    let spent = 0;
    done.forEach(cd => {
      const d = session.catalog.find(x => x.id === cd.date_catalog_id);
      if (!d) return;
      catCount[d.category] = (catCount[d.category] || 0) + 1;
      spent += [0, 25, 65, 140][d.cost_tier] || 0;
    });
    const favCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    const last = done.map(cd => cd.completed_at).sort().pop();
    const pill = (n, l) => el('div.stat-pill', {}, [el('div.n', {}, n), el('div.l', {}, l)]);
    return el('div', {}, [
      el('div.section-title', {}, [el('h2', {}, 'Your Stats'), el('span.mono', {}, 'SO FAR')]),
      el('div.stat-strip', {}, [
        pill(done.length, 'Dates done'),
        pill(favCat ? catMeta(favCat[0]).emoji : '—', favCat ? catMeta(favCat[0]).label : 'No favorite yet'),
        pill('$' + spent, 'Est. spent'),
        pill(last ? fmtDate(last).split(',')[0] : '—', 'Most recent'),
      ]),
    ]);
  }

  async function recentlyShown() {
    // exclude dates shown in the last 4 weekly rotations
    const ids = new Set();
    const d = new Date();
    for (let i = 1; i <= 4; i++) {
      d.setDate(d.getDate() - 7);
      const r = await store.getRotation(session.coupleId, weekStartOf(d));
      r?.date_ids.forEach(id => ids.add(id));
    }
    return ids;
  }
}
