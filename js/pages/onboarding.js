// js/pages/onboarding.js — couple setup + preference survey.
//
// One person can fill out the survey in three ways:
//   • 'me'       — just their own answers
//   • 'combined' — one shared set of answers representing the couple
//   • 'both'     — each partner's answers individually (two passes)

import { el, toast } from '../ui.js';
import { store } from '../store.js';
import { session, partnerSurveyKey } from '../state.js';
import { CATEGORIES } from '../seed.js';

const SLIDER_QS = [
  { key: 'outdoorsy_score', q: 'On a free Saturday, I\'d rather be…', lo: 'Cozy on the couch', hi: 'Chasing a summit' },
  { key: 'activity_level', q: 'My ideal energy level is…', lo: 'Relaxed & slow', hi: 'High-energy' },
  { key: 'budget_range', q: 'When it comes to spending, I lean…', lo: 'Budget-minded', hi: 'Splurge-worthy' },
  { key: 'spontaneity', q: 'I\'m more of a…', lo: 'Planner', hi: 'Free spirit' },
  { key: 'social_vibe', q: 'My perfect date is…', lo: 'Just us two', hi: 'Love a crowd' },
  { key: 'distance_tolerance', q: 'For the right date, I\'ll travel…', lo: 'Stay close', hi: 'Road-trip ready' },
];

const EMOJIS = ['🏔️', '🌲', '🍺', '🎭', '⛷️', '🌻', '🦌', '🔥', '☕', '🥾', '🌌', '🚞'];
const defaultPerson = () => ({ outdoorsy_score: 5, activity_level: 5, budget_range: 5, spontaneity: 5, social_vibe: 5, distance_tolerance: 5, favorite_categories: [] });

export default async function renderOnboarding(view) {
  let mode = 'me';
  let myName = session.user.display_name || 'You';
  let partnerName = session.user.partner_label || (session.partner?.display_name) || 'Partner';

  // Pull just the per-person preference fields out of a stored survey (if any).
  const pluck = (s) => s ? {
    outdoorsy_score: s.outdoorsy_score, activity_level: s.activity_level, budget_range: s.budget_range,
    spontaneity: s.spontaneity, social_vibe: s.social_vibe, distance_tolerance: s.distance_tolerance,
    favorite_categories: [...(s.favorite_categories || [])],
  } : null;
  const personA = { ...defaultPerson(), ...pluck(session.survey) };
  const personB = { ...defaultPerson(), ...pluck(session.partnerSurvey) };
  const s0 = session.survey || {};
  const shared = {
    has_car: s0.has_car ?? true, location_pref: s0.location_pref || 'denver',
    distance_miles: s0.distance_miles ?? 60, dietary_notes: s0.dietary_notes || '', mobility_notes: s0.mobility_notes || '',
  };
  if (session.partnerSurvey) mode = 'both'; // they've previously set both partners
  let coupleName = session.user.couple_name || '';
  let avatar = session.user.avatar_emoji || '🏔️';

  let step = 0;
  let steps = computeSteps();

  const stage = el('div');
  const dots = el('div.step-dots');
  const back = el('button.btn.btn-ghost', { onClick: () => go(step - 1) }, '← Back');
  const next = el('button.btn.btn-primary', { onClick: onNext }, 'Continue →');
  const nav = el('div.row.spread', { style: 'margin-top:26px' }, [back, next]);

  function computeSteps() {
    const s = [{ render: stepMode }];
    if (mode === 'both') {
      s.push({ render: () => stepVibe(personA, ['Part 1 · ' + myName, `${myName}'s vibe`, 'Slide to where you land — honest answers make better matches.']) });
      s.push({ render: () => stepCategories(personA, [`${myName}'s favorites`, 'Tap everything that sounds fun.']) });
      s.push({ render: () => stepVibe(personB, ['Part 1 · ' + partnerName, `${partnerName}'s vibe`, 'Now answer as your partner would.']) });
      s.push({ render: () => stepCategories(personB, [`${partnerName}'s favorites`, 'What is your partner into?']) });
    } else {
      const combined = mode === 'combined';
      s.push({ render: () => stepVibe(personA, ['Part 1', combined ? 'Your combined vibe' : 'Your vibe', combined ? 'Answer together — where do you two land as a couple?' : 'Slide to where you land. No wrong answers.']) });
      s.push({ render: () => stepCategories(personA, [combined ? 'What you\'re both into' : 'Your Colorado favorites', 'Tap everything that sounds like a good time.']) });
    }
    s.push({ render: stepLogistics });
    s.push({ render: stepIdentity });
    return s;
  }

  function renderDots() {
    dots.replaceChildren(...Array.from({ length: steps.length }, (_, i) => el('i', { class: i <= step ? 'on' : '' })));
  }
  function go(s) {
    step = Math.max(0, Math.min(steps.length - 1, s));
    renderDots();
    back.style.visibility = step === 0 ? 'hidden' : 'visible';
    next.textContent = step === steps.length - 1 ? 'Finish & see our lineup 🏔️' : 'Continue →';
    stage.replaceChildren(steps[step].render());
    window.scrollTo(0, 0);
  }

  function head(eyebrow, title, sub) {
    return el('div.step-head', {}, [
      el('div.mono', {}, eyebrow),
      el('h2', {}, title),
      el('p.muted', {}, sub),
    ]);
  }

  // ── Step: choose survey mode ──
  function stepMode() {
    const wrap = el('div', {}, [head('Setup', 'Who\'s answering?', 'Fill this out solo, together, or for both of you.')]);
    const opts = [
      ['me', '🙋 Just me', 'Set my own preferences. My partner can add theirs later.'],
      ['combined', '💞 Together (combined)', 'We\'re answering as a couple — one shared set of vibes.'],
      ['both', '👥 Both of us, separately', 'I\'ll fill out each of our preferences individually.'],
    ];
    const cards = el('div.stack');
    const names = el('div', { class: mode === 'both' ? '' : 'hidden', style: 'margin-top:8px' }, [
      el('div.row.wrap', {}, [
        el('div.field.grow', {}, [el('label', {}, 'Your name'), nameInput(myName, v => myName = v)]),
        el('div.field.grow', {}, [el('label', {}, 'Partner\'s name'), nameInput(partnerName === 'Partner' ? '' : partnerName, v => partnerName = v || 'Partner', 'Partner')]),
      ]),
    ]);
    opts.forEach(([val, title, desc]) => {
      const card = el('div.check-card' + (mode === val ? '.on' : ''), {
        style: 'align-items:flex-start;flex-direction:column;gap:4px',
        onClick: () => {
          mode = val;
          [...cards.children].forEach((c, i) => c.classList.toggle('on', opts[i][0] === val));
          names.classList.toggle('hidden', val !== 'both');
        },
      }, [
        el('strong', {}, title),
        el('span.muted', { style: 'font-size:.85rem;font-weight:400' }, desc),
      ]);
      cards.appendChild(card);
    });
    wrap.append(cards, names);
    return wrap;
  }

  function nameInput(value, onInput, placeholder = '') {
    const i = el('input.input', { value, placeholder });
    i.addEventListener('input', () => onInput(i.value.trim()));
    return i;
  }

  // ── Step: vibe sliders (bound to a target person) ──
  function stepVibe(target, [eyebrow, title, sub]) {
    const wrap = el('div', {}, [head(eyebrow, title, sub)]);
    SLIDER_QS.forEach(sq => {
      const valBadge = el('span.qval', {}, target[sq.key]);
      const range = el('input', { type: 'range', min: 1, max: 10, value: target[sq.key] });
      const paint = () => range.style.setProperty('--pct', ((target[sq.key] - 1) / 9 * 100) + '%');
      range.addEventListener('input', () => { target[sq.key] = +range.value; valBadge.textContent = range.value; paint(); });
      paint();
      wrap.appendChild(el('div.slider-field', {}, [
        el('div.qtext', {}, [el('span', {}, sq.q), valBadge]),
        range,
        el('div.slabels', {}, [el('span', {}, sq.lo), el('span', {}, sq.hi)]),
      ]));
    });
    return wrap;
  }

  // ── Step: category checkboxes (bound to a target person) ──
  function stepCategories(target, [title, sub]) {
    const grid = el('div.check-grid');
    CATEGORIES.forEach(c => {
      const on = target.favorite_categories.includes(c.key);
      const card = el('div.check-card' + (on ? '.on' : ''), { onClick: () => {
        const i = target.favorite_categories.indexOf(c.key);
        if (i >= 0) target.favorite_categories.splice(i, 1); else target.favorite_categories.push(c.key);
        card.classList.toggle('on');
      } }, [el('span.ce', {}, c.emoji), el('span', {}, c.label)]);
      grid.appendChild(card);
    });
    return el('div', {}, [head('Part 2', title, sub), grid]);
  }

  // ── Step: shared logistics ──
  function stepLogistics() {
    const distVal = el('span.qval', {}, shared.distance_miles + ' mi');
    const dist = el('input', { type: 'range', min: 10, max: 200, step: 5, value: shared.distance_miles });
    const paint = () => dist.style.setProperty('--pct', ((shared.distance_miles - 10) / 190 * 100) + '%');
    dist.addEventListener('input', () => { shared.distance_miles = +dist.value; distVal.textContent = dist.value + ' mi'; paint(); });
    paint();

    const carYes = el('button.chip-toggle' + (shared.has_car ? '.on' : ''), { onClick: () => setCar(true) }, '🚗 We have a car');
    const carNo = el('button.chip-toggle' + (!shared.has_car ? '.on' : ''), { onClick: () => setCar(false) }, '🚈 Light rail only');
    function setCar(v) { shared.has_car = v; carYes.classList.toggle('on', v); carNo.classList.toggle('on', !v); }

    const locSel = el('select', {}, [
      ['denver', 'Denver (metro-wide)'], ['south-denver', 'South Denver'], ['university', 'University / DU area'], ['boulder', 'Boulder'], ['address', 'Specific address'],
    ].map(([v, l]) => el('option', { value: v }, l)));
    locSel.value = shared.location_pref;
    locSel.addEventListener('change', () => shared.location_pref = locSel.value);

    const diet = el('textarea', { placeholder: 'Any dietary needs? (optional)' }, shared.dietary_notes);
    diet.addEventListener('input', () => shared.dietary_notes = diet.value);
    const mob = el('textarea', { placeholder: 'Any mobility considerations? (optional)' }, shared.mobility_notes);
    mob.addEventListener('input', () => shared.mobility_notes = mob.value);

    return el('div', {}, [
      head('Part 3', 'Good to Know', 'A few shared logistics so every suggestion is actually doable.'),
      el('div.field', {}, [el('label', {}, 'Getting around'), el('div.row.wrap', {}, [carYes, carNo])]),
      el('div.field', {}, [el('label', {}, 'Home base'), locSel, el('div.hint', {}, 'We\'ll prioritize dates near here.')]),
      el('div.slider-field', { style: 'margin-top:8px' }, [
        el('div.qtext', {}, [el('span', {}, 'How far will you travel for the right date?'), distVal]),
        dist,
        el('div.slabels', {}, [el('span', {}, '10 mi'), el('span', {}, '200 mi')]),
      ]),
      el('div.field', {}, [el('label', {}, 'Dietary notes'), diet]),
      el('div.field', {}, [el('label', {}, 'Mobility notes'), mob]),
    ]);
  }

  // ── Step: identity + partner link ──
  function stepIdentity() {
    const nameInput = el('input.input', { type: 'text', placeholder: 'e.g. The Hendersons', value: coupleName });
    nameInput.addEventListener('input', () => coupleName = nameInput.value);

    const picker = el('div.emoji-picker', {}, EMOJIS.map(e =>
      el('button', { class: e === avatar ? 'on' : '', onClick: () => { avatar = e; [...picker.children].forEach(c => c.classList.toggle('on', c.textContent === e)); } }, e)));

    const codeInput = el('input.input', { type: 'text', placeholder: 'ABC123', maxlength: 6, style: 'text-transform:uppercase' });
    const linkBtn = el('button.btn.btn-ghost', { onClick: async () => {
      if (!codeInput.value.trim()) return;
      try { const p = await store.linkPartnerByCode(session.user.id, codeInput.value.trim()); toast(`Linked with ${p.display_name}! 💞`, 'success'); }
      catch (e) { toast(e.message, 'warn'); }
    } }, 'Link');

    return el('div', {}, [
      head('Last step', 'Make it yours', 'Name your duo and pick a badge.'),
      el('div.field', {}, [el('label', {}, 'Couple name'), nameInput]),
      el('div.field', {}, [el('label', {}, 'Your badge'), picker]),
      el('hr.divider'),
      el('div.field', {}, [
        el('label', {}, 'Got a partner with their own account? Link up (optional)'),
        el('div.hint', {}, 'Share YOUR invite code below, or enter theirs to join.'),
      ]),
      el('div.card.card-pad', { style: 'text-align:center;background:var(--summit-faint);border:none' }, [
        el('div.muted', { style: 'font-size:.78rem;letter-spacing:1px' }, 'YOUR INVITE CODE'),
        el('div.invite-code', { style: 'margin-top:8px' }, session.user.partner_invite_code),
      ]),
      el('div.row', { style: 'margin-top:14px' }, [codeInput, linkBtn]),
    ]);
  }

  async function onNext() {
    if (step === 0) { steps = computeSteps(); renderDots(); } // rebuild after picking a mode
    if (step < steps.length - 1) { go(step + 1); return; }
    await finish();
  }

  async function finish() {
    next.disabled = true;
    const partnerSlot = session.partner ? session.partner.id : partnerSurveyKey(session.user.id);

    if (mode === 'me') {
      await store.saveSurvey(session.user.id, { ...personA, ...shared });
    } else if (mode === 'combined') {
      const data = { ...personA, ...shared };
      await store.saveSurvey(session.user.id, data);
      await store.saveSurvey(partnerSlot, data); // both partners share the combined profile
    } else { // both, separately
      await store.saveSurvey(session.user.id, { ...personA, ...shared });
      await store.saveSurvey(partnerSlot, { ...personB, ...shared });
    }

    await store.saveProfile({
      id: session.user.id,
      onboarded: true,
      display_name: myName || session.user.display_name,
      couple_name: coupleName || (myName + ' & Co.'),
      avatar_emoji: avatar,
      partner_label: mode === 'both' ? partnerName : session.user.partner_label,
    });

    toast('Trail set! Generating your first lineup… 🗺️', 'success');
    location.hash = '#/dashboard';
  }

  const container = el('div.container', {}, [
    el('div.onboard-wrap', {}, [dots, el('div.card.card-pad', {}, [stage]), nav]),
  ]);
  view.appendChild(container);
  go(0);
}
