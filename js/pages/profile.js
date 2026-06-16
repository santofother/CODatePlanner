// js/pages/profile.js — couple profile, side-by-side surveys, personality badge.

import { el, toast } from '../ui.js';
import { store } from '../store.js';
import { session } from '../state.js';
import { personalityBadge } from '../algorithm.js';
import { catMeta } from '../components.js';
import { CATEGORIES } from '../seed.js';

const SLIDER_LABELS = {
  outdoorsy_score: 'Outdoorsy', activity_level: 'Energy', budget_range: 'Budget',
  spontaneity: 'Spontaneity', social_vibe: 'Social', distance_tolerance: 'Travel range',
};

export default async function renderProfile(view) {
  const container = el('div.container');
  view.appendChild(container);

  const badge = personalityBadge(session.pref, session.weights);
  const couple = session.user.couple_name || session.user.display_name;

  // ── Header ──
  container.appendChild(el('div.profile-head', {}, [
    el('div.big-avatar', {}, session.user.avatar_emoji),
    el('div.grow', {}, [
      el('h1', { style: 'margin:.1em 0' }, couple),
      el('div.personality-badge', {}, `${badge.emoji} ${badge.label}`),
    ]),
    el('button.btn.btn-ghost', { onClick: editIdentity }, '✏️ Edit'),
  ]));
  container.appendChild(el('p.muted', {}, `Badge earned from your ${catMeta(badge.basis).label.toLowerCase()} streak. Keep rating dates to evolve it.`));

  // ── Partner link ──
  container.appendChild(el('hr.divider'));
  if (session.partner) {
    container.appendChild(el('div.card.card-pad', { style: 'background:var(--summit-faint);border:none' }, [
      el('div.row', { style: 'align-items:center;gap:12px' }, [
        el('div.avatar', {}, session.partner.avatar_emoji || '🌲'),
        el('div', {}, [el('strong', {}, `Linked with ${session.partner.display_name}`), el('div.muted', { style: 'font-size:.85rem' }, 'Your boards and lineup are shared 💞')]),
      ]),
    ]));
  } else {
    const codeInput = el('input.input', { placeholder: 'Partner code', maxlength: 6, style: 'text-transform:uppercase' });
    container.appendChild(el('div.card.card-pad', {}, [
      el('h3', { style: 'margin-top:0' }, 'Link your partner'),
      el('p.muted', {}, 'Share your code so you both see the same date board.'),
      el('div.center', { style: 'margin:14px 0' }, el('span.invite-code', {}, session.user.partner_invite_code)),
      el('div.row', {}, [
        codeInput,
        el('button.btn.btn-primary', { onClick: async () => {
          try { const p = await store.linkPartnerByCode(session.user.id, codeInput.value.trim()); toast(`Linked with ${p.display_name}! 💞`, 'success'); location.hash = '#/profile'; }
          catch (e) { toast(e.message, 'warn'); }
        } }, 'Link up'),
      ]),
    ]));
  }

  // ── Survey comparison ──
  container.appendChild(el('hr.divider'));
  container.appendChild(el('div.section-title', {}, [el('h2', {}, 'Your Vibes'), el('span.mono', {}, 'SIDE BY SIDE')]));
  container.appendChild(el('div.survey-compare', {}, [
    surveyCol(session.user.display_name, session.survey, true),
    session.partnerSurvey
      ? surveyCol(session.partnerName || 'Partner', session.partnerSurvey, false)
      : el('div.survey-col', {}, el('div.empty-state', { style: 'padding:30px' }, [el('div.emoji', {}, '🤝'), el('p', {}, 'Add your partner\'s answers via "Retake survey" → "Both of us, separately", or link their account.')])),
  ]));

  // ── Favorite categories ──
  container.appendChild(el('hr.divider'));
  container.appendChild(el('h3', {}, 'What you\'re into'));
  const favs = session.pref.favorite_categories;
  container.appendChild(el('div.row.wrap', {}, favs.length
    ? favs.map(k => el('span.chip', {}, `${catMeta(k).emoji} ${catMeta(k).label}`))
    : [el('span.muted', {}, 'No favorites set yet.')]));

  // ── Retake ──
  container.appendChild(el('div', { style: 'margin-top:28px' }, [
    el('button.btn.btn-summit', { onClick: async () => { await store.saveProfile({ id: session.user.id }); location.hash = '#/onboarding'; } }, '🔄 Retake survey'),
  ]));

  function surveyCol(name, survey, isMe) {
    const col = el('div.survey-col.card.card-pad', {}, [el('h4', {}, `${name}${isMe ? ' (you)' : ''}`)]);
    if (!survey) { col.appendChild(el('p.muted', {}, 'Survey not completed yet.')); return col; }
    Object.entries(SLIDER_LABELS).forEach(([key, label]) => {
      const v = survey[key] ?? 5;
      col.appendChild(el('div.survey-row', {}, [
        el('span.sl', {}, label),
        el('span.minibar', {}, el('i', { style: `width:${v * 10}%` })),
        el('span.mono', { style: 'font-size:.78rem' }, v + '/10'),
      ]));
    });
    if (survey.dietary_notes) col.appendChild(el('div.muted', { style: 'font-size:.84rem;margin-top:8px' }, `🥗 ${survey.dietary_notes}`));
    if (survey.has_car === false) col.appendChild(el('div.muted', { style: 'font-size:.84rem' }, '🚈 Light rail only'));
    return col;
  }

  function editIdentity() {
    import('../ui.js').then(({ modal }) => {
      let chosen = session.user.avatar_emoji;
      const nameInput = el('input.input', { value: couple });

      const row = el('div.emoji-picker');
      ['🏔️', '🌲', '🍺', '🎭', '⛷️', '🌻', '🦌', '🔥', '☕', '🥾', '🌌', '🚞'].forEach(e => {
        const b = el('button', { class: e === chosen ? 'on' : '', onClick: () => { chosen = e; [...row.children].forEach(c => c.classList.toggle('on', c.textContent === e)); } }, e);
        row.appendChild(b);
      });

      const m = modal({ title: 'Edit your duo', body: el('div.stack', {}, [
        el('div.field', {}, [el('label', {}, 'Couple name'), nameInput]),
        el('div.field', {}, [el('label', {}, 'Badge'), row]),
        el('button.btn.btn-primary', { onClick: async () => { await store.saveProfile({ id: session.user.id, couple_name: nameInput.value.trim(), avatar_emoji: chosen }); m.close(); toast('Updated!', 'success'); location.hash = '#/profile'; } }, 'Save'),
      ]) });
    });
  }
}
