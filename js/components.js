// js/components.js — shared UI pieces: date card, status actions, review modal.

import { el, esc, costLabel, toast, modal, starInput, titleCase } from './ui.js';
import { store } from './store.js';
import { session, statusMap, coupleDateFor, refreshCoupleDates } from './state.js';
import { eventActive } from './algorithm.js';
import { CATEGORIES } from './seed.js';

export function catMeta(key) {
  return CATEGORIES.find(c => c.key === key) || { label: titleCase(key), emoji: '📍' };
}

export function countdownText(date) {
  if (!date.time_sensitive || !date.event_end) return '';
  const end = new Date(date.event_end), now = new Date(), start = new Date(date.event_start);
  if (now < start) {
    const days = Math.ceil((start - now) / 86400000);
    return days <= 30 ? `Opens in ${days}d` : '';
  }
  if (now <= end) {
    const days = Math.ceil((end - now) / 86400000);
    return `${days}d left`;
  }
  return '';
}

// Chips describing a date (cost, difficulty, duration, transit, season).
export function dateChips(d) {
  const chips = [
    el('span.chip.cost', {}, costLabel(d.cost_tier)),
    el('span.chip.diff', {}, titleCase(d.difficulty)),
    el('span.chip', {}, `${d.duration_hours}h`),
  ];
  if (d.transit) chips.push(el('span.chip.transit', {}, '🚈 Light rail'));
  if (d.distance_miles != null) chips.push(el('span.chip', {}, `${d.distance_miles} mi`));
  return chips;
}

function statusPill(status) {
  if (!status || status === 'suggested') return null;
  const map = { pinned: ['📌 Pinned', 'status-pinned'], done: ['✅ Done', 'status-done'], maybe: ['💛 Maybe', 'status-maybe'], pass: ['❌ Passed', 'status-pass'] };
  const [txt, cls] = map[status] || [status, ''];
  return el('span.status-pill.' + cls, {}, txt);
}

// One date card with status actions. onChange() re-renders the page.
export function dateCard(scored, { onChange, showSlot } = {}) {
  const d = scored.date || scored;            // accepts {date,score,why} or raw date
  const score = scored.score;
  const cd = coupleDateFor(d.id);
  const status = cd?.status;

  const card = el('div.card.date-card');

  if (showSlot && scored.slot) card.appendChild(el('div.lineup-slot-label', { style: 'padding:12px 18px 0' }, scored.slot));

  const goDetail = () => { location.hash = '#/date/' + d.id; };

  const thumb = el('div.thumb', { onClick: goDetail, title: 'View details', style: 'cursor:pointer' }, d.image_emoji || '📍');
  const cdText = countdownText(d);
  if (eventActive(d) && cdText) thumb.appendChild(el('span.badge.live', { style: 'position:absolute;top:10px;right:10px' }, '⏰ ' + cdText));
  if (statusPill(status)) thumb.appendChild(el('div', { style: 'position:absolute;top:10px;left:10px' }, statusPill(status)));
  card.appendChild(thumb);

  const body = el('div.body', {}, [
    el('div.row.spread', { style: 'align-items:center' }, [
      el('span.chip.season', {}, `${catMeta(d.category).emoji} ${catMeta(d.category).label}`),
      score != null ? matchMeter(score) : null,
    ]),
    el('h3', { onClick: goDetail, title: 'View details' }, d.title),
    el('div.desc', {}, d.description),
    el('div.meta', {}, dateChips(d)),
    el('button.detail-link', { onClick: goDetail }, 'View details →'),
  ]);
  card.appendChild(body);

  card.appendChild(statusActions(d, onChange));
  return card;
}

export function matchMeter(score) {
  return el('span.match-ring', {}, [
    el('span', {}, score + '%'),
    el('span.match-bar', {}, el('i', { style: `width:${score}%` })),
  ]);
}

// Pin / Maybe / Pass / Done action row.
export function statusActions(d, onChange) {
  const cd = coupleDateFor(d.id);
  const status = cd?.status;
  const act = async (newStatus, label, extra) => {
    if (!session.coupleId) { toast('Sign in to save dates', 'warn'); location.hash = '#/'; return; }
    await store.setStatus(session.coupleId, d.id, newStatus, extra);
    await refreshCoupleDates();
    toast(label, 'success');
    onChange && onChange();
  };
  const row = el('div.actions');
  const mk = (emoji, title, fn, on) => {
    const b = el('button.icon-btn', { title, onClick: fn });
    b.textContent = emoji;
    if (on) b.style.background = 'var(--summit-faint)';
    return b;
  };
  row.append(
    mk('❤️', 'Pin it', () => act('pinned', 'Pinned — let\'s plan it! 📌'), status === 'pinned'),
    mk('💛', 'Maybe', () => act('maybe', 'Saved for later 💛'), status === 'maybe'),
    mk('👎', 'Pass', () => passFlow(d, onChange), status === 'pass'),
    mk('✅', 'Mark done', () => reviewModal(d, onChange), status === 'done'),
  );
  return row;
}

function passFlow(d, onChange) {
  const ta = el('textarea', { placeholder: 'Optional: what made this one not for you?' });
  const m = modal({
    title: 'Not every trail is worth the climb',
    body: el('div', {}, [
      el('p.muted', { style: 'margin-top:0' }, 'Noted — we\'ll steer your lineup away from this.'),
      ta,
      el('div.row', { style: 'margin-top:14px;justify-content:flex-end' }, [
        el('button.btn.btn-primary', { onClick: async () => {
          await store.setStatus(session.coupleId, d.id, 'pass', { flagged_reason: ta.value.trim() });
          await refreshCoupleDates();
          m.close(); toast('Got it — trail rerouted'); onChange && onChange();
        } }, 'Pass on this'),
      ]),
    ]),
  });
}

// Post-date review (triggered when marking Done).
export function reviewModal(d, onChange) {
  const stars = starInput(0);
  const cost = el('input', { type: 'range', min: 1, max: 5, value: 3, class: 'grow' });
  const effort = el('input', { type: 'range', min: 1, max: 5, value: 3, class: 'grow' });
  const repeat = el('select', {}, ['Yes', 'Maybe', 'No'].map(o => el('option', {}, o)));
  const highlight = el('input', { class: 'input', maxlength: 140, placeholder: 'Best moment? (optional)' });

  const body = el('div.stack', {}, [
    el('div.field', {}, [el('label', {}, '⭐ Overall vibe'), stars]),
    el('div.field', {}, [el('label', {}, '💰 Cost vs expectations'), cost, el('div.slabels', {}, [el('span', {}, 'Way over'), el('span', {}, 'Great value')])]),
    el('div.field', {}, [el('label', {}, '💪 Effort level'), effort, el('div.slabels', {}, [el('span', {}, 'Too easy'), el('span', {}, 'Exhausting')])]),
    el('div.field', {}, [el('label', {}, '🔁 Would you do it again?'), repeat]),
    el('div.field', {}, [el('label', {}, '✨ Highlight'), highlight]),
    el('button.btn.btn-summit.btn-block', { onClick: submit }, 'Log this summit 🏔️'),
  ]);
  const m = modal({ title: `Another peak conquered!`, body });

  async function submit() {
    await store.saveReview(session.coupleId, d.id, {
      review_vibe_rating: stars.value || 4,
      review_cost_vs_expect: Number(cost.value),
      review_effort_rating: Number(effort.value),
      review_would_repeat: repeat.value === 'Yes',
      review_highlight: highlight.value.trim(),
    });
    await refreshCoupleDates();
    m.close();
    toast('Logged! Your elevation profile is updating 📈', 'success');
    onChange && onChange();
  }
}
