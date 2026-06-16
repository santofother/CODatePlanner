// js/pages/discover.js — full catalog with filters, search, sort, and map view.

import { el, costLabel } from '../ui.js';
import { session, statusMap } from '../state.js';
import { scoreCatalog, currentSeason } from '../algorithm.js';
import { dateCard, catMeta } from '../components.js';
import { CATEGORIES } from '../seed.js';
import { CONFIG } from '../config.js';

export default async function renderDiscover(view) {
  const f = { q: '', category: '', season: '', cost: '', indoor: '', difficulty: '', transit: false, status: '' };
  let viewMode = 'grid';
  let mapInstance = null;

  const scored = scoreCatalog(session.catalog, session.pref, { season: currentSeason(), weights: session.weights });

  const container = el('div.container');
  view.appendChild(container);

  container.appendChild(el('div.section-title', {}, [el('h2', {}, 'Discover'), el('span.mono', {}, session.catalog.length + ' COLORADO DATES')]));

  // ── Filter bar ──
  const search = el('input.input.filter-search', { type: 'search', placeholder: '🔍 Search dates, places, vibes…' });
  search.addEventListener('input', () => { f.q = search.value.toLowerCase(); apply(); });

  const sel = (label, opts, key) => {
    const s = el('select', {}, [el('option', { value: '' }, label), ...opts.map(([v, l]) => el('option', { value: v }, l))]);
    s.addEventListener('change', () => { f[key] = s.value; apply(); });
    return s;
  };
  const transitToggle = el('button.chip-toggle', { onClick: () => { f.transit = !f.transit; transitToggle.classList.toggle('on', f.transit); apply(); } }, '🚈 Light rail');

  const viewToggle = el('div.view-toggle', {}, [
    el('button', { class: 'on', onClick: () => setView('grid') }, '▦ Grid'),
    el('button', { onClick: () => setView('map') }, '🗺️ Map'),
  ]);

  const filterBar = el('div.filter-bar', {}, [
    search,
    sel('All categories', CATEGORIES.map(c => [c.key, c.label]), 'category'),
    sel('Any season', [['winter', 'Winter'], ['spring', 'Spring'], ['summer', 'Summer'], ['fall', 'Fall']], 'season'),
    sel('Any cost', [['0', 'Free'], ['1', '$'], ['2', '$$'], ['3', '$$$']], 'cost'),
    sel('In/Outdoor', [['indoor', 'Indoor'], ['outdoor', 'Outdoor'], ['both', 'Both']], 'indoor'),
    sel('Any effort', [['easy', 'Easy'], ['moderate', 'Moderate'], ['challenging', 'Challenging']], 'difficulty'),
    transitToggle,
  ]);

  // status filter chips
  const statusChips = el('div.row.wrap', { style: 'margin:12px 0' }, [
    ['', 'All'], ['suggested', '💡 New'], ['pinned', '📌 Pinned'], ['maybe', '💛 Maybe'], ['done', '✅ Done'], ['pass', '❌ Passed'],
  ].map(([v, label]) => {
    const c = el('button.chip-toggle' + (v === '' ? '.on' : ''), { onClick: () => { f.status = v; [...statusChips.children].forEach(x => x.classList.remove('on')); c.classList.add('on'); apply(); } }, label);
    return c;
  }));

  container.append(
    el('div.row.spread.wrap', { style: 'gap:12px;align-items:flex-end' }, [filterBar, viewToggle]),
    statusChips,
  );

  const count = el('div.result-count');
  const grid = el('div.date-grid');
  const mapEl = el('div', { id: 'map', class: 'hidden' });
  container.append(count, grid, mapEl);

  function filtered() {
    const sm = statusMap();
    return scored.filter(s => {
      const d = s.date;
      if (f.q) {
        const hay = (d.title + ' ' + d.description + ' ' + d.location_name + ' ' + d.location_city + ' ' + (d.tags || []).join(' ')).toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      if (f.category && d.category !== f.category) return false;
      if (f.season && !d.seasonal_tags.includes(f.season) && !d.seasonal_tags.includes('any')) return false;
      if (f.cost !== '' && String(d.cost_tier) !== f.cost) return false;
      if (f.indoor && d.indoor_outdoor !== f.indoor) return false;
      if (f.difficulty && d.difficulty !== f.difficulty) return false;
      if (f.transit && !d.transit) return false;
      if (f.status) {
        const st = sm[d.id] || 'suggested';
        if (st !== f.status) return false;
      }
      return true;
    });
  }

  function apply() {
    const list = filtered();
    count.textContent = `${list.length} date${list.length === 1 ? '' : 's'} on the map`;
    grid.replaceChildren(...list.map(s => dateCard(s, { onChange: apply })));
    if (viewMode === 'map' && mapInstance) drawMarkers(list);
  }

  function setView(mode) {
    viewMode = mode;
    [...viewToggle.children].forEach((b, i) => b.classList.toggle('on', (mode === 'grid') === (i === 0)));
    grid.classList.toggle('hidden', mode === 'map');
    mapEl.classList.toggle('hidden', mode === 'grid');
    if (mode === 'map') ensureMap();
  }

  function ensureMap() {
    if (mapInstance) { setTimeout(() => mapInstance.invalidateSize(), 50); drawMarkers(filtered()); return; }
    loadLeaflet().then(() => {
      mapInstance = L.map('map').setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(mapInstance);
      drawMarkers(filtered());
    }).catch(() => { mapEl.replaceChildren(el('div.empty-state', {}, [el('div.emoji', {}, '🗺️'), el('p', {}, 'Map needs an internet connection. Try grid view?')])); });
  }

  let markerLayer = null;
  function drawMarkers(list) {
    if (!mapInstance) return;
    if (markerLayer) markerLayer.remove();
    markerLayer = L.layerGroup().addTo(mapInstance);
    list.forEach(s => {
      const d = s.date;
      if (d.lat == null) return;
      const m = L.marker([d.lat, d.lng]).addTo(markerLayer);
      m.bindPopup(`<b>${d.image_emoji} ${d.title}</b><br>${d.location_name}, ${d.location_city}<br>${catMeta(d.category).label} · ${costLabel(d.cost_tier)} · ${s.score}% match<br><a href="#/date/${d.id}">View details →</a>`);
    });
  }

  apply();
}

// Lazy-load Leaflet from CDN only when the map is first opened.
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
