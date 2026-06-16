// js/pages/landing.js — hero, value props, and login/signup (or demo).

import { el, toast } from '../ui.js';
import { store } from '../store.js';

export default async function renderLanding(view) {
  let mode = 'signup';

  const email = el('input.input', { type: 'email', placeholder: 'you@summit.co', autocomplete: 'email' });
  const pass = el('input.input', { type: 'password', placeholder: 'A trail-worthy password', autocomplete: 'current-password' });
  const name = el('input.input', { type: 'text', placeholder: 'Your name (e.g. Alex)' });
  const nameField = el('div.field', {}, [el('label', {}, 'Your name'), name]);

  const submitBtn = el('button.btn.btn-primary.btn-block.btn-lg', { onClick: submit }, 'Start the climb');

  const tabs = el('div.auth-tabs', {}, [
    el('button', { class: 'on', onClick: () => setMode('signup') }, 'Sign up'),
    el('button', { onClick: () => setMode('login') }, 'Sign in'),
  ]);

  function setMode(m) {
    mode = m;
    [...tabs.children].forEach((b, i) => b.classList.toggle('on', (m === 'signup') === (i === 0)));
    nameField.classList.toggle('hidden', m === 'login');
    submitBtn.textContent = m === 'signup' ? 'Start the climb' : 'Welcome back';
  }

  async function submit() {
    if (!email.value.trim() || !pass.value) { toast('Email and password, please', 'warn'); return; }
    submitBtn.disabled = true;
    try {
      if (mode === 'signup') {
        const p = await store.signUp({ email: email.value.trim(), password: pass.value, displayName: name.value.trim() });
        toast(`Welcome, ${p.display_name}! Let's set up your trail.`, 'success');
        location.hash = '#/onboarding';
      } else {
        const p = await store.signIn({ email: email.value.trim(), password: pass.value });
        toast(`Welcome back, ${p.display_name}!`, 'success');
        location.hash = p.onboarded ? '#/dashboard' : '#/onboarding';
      }
    } catch (e) {
      toast(e.message, 'warn');
      submitBtn.disabled = false;
    }
  }

  async function tryDemo() {
    await store.seedDemoCouple();
    toast('Demo couple loaded — explore freely! 🏔️', 'success');
    location.hash = '#/dashboard';
  }

  const authCard = el('div.card.card-pad.auth-card', {}, [
    tabs, nameField,
    el('div.field', {}, [el('label', {}, 'Email'), email]),
    el('div.field', {}, [el('label', {}, 'Password'), pass]),
    submitBtn,
    el('div.center', { style: 'margin-top:16px' }, [
      el('div.muted', { style: 'font-size:.82rem;margin-bottom:8px' }, 'Just want to look around?'),
      el('button.btn.btn-ghost.btn-block', { onClick: tryDemo }, '🧭 Explore the demo couple'),
    ]),
  ]);

  const container = el('div.container', {}, [
    el('section.hero', {}, [
      el('div.eyebrow', {}, 'Colorado couples date planner'),
      el('h1', { html: 'Every date, <span class="accent">a new summit.</span>' }),
      el('p.lede', {}, 'Peak Dates learns what you two love — from Red Rocks shows to alpine hikes to cozy brewery nights — and hands you the perfect lineup every week.'),
      el('div.elev-marker', {}, '◭ ELEV 5,280 FT · FRONT RANGE, CO ◭'),
    ]),
    authCard,
    el('div.feature-row', {}, [
      feature('🗻', 'Weekly Lineup', 'Four hand-picked dates every Monday — an event, a seasonal pick, a top match, and a wildcard to push your limits.'),
      feature('🧠', 'Learns Your Taste', 'Rate each date afterward and the algorithm tunes your "elevation profile" — more of what you love, less of what flopped.'),
      feature('🚈', 'Built for the Front Range', 'Filter by light-rail access, driving range, season, budget, and difficulty. Real Colorado spots, no fluff.'),
    ]),
  ]);

  view.appendChild(container);
  setMode('signup');
}

function feature(emoji, title, text) {
  return el('div.card.card-pad.feature', {}, [
    el('div.fe', {}, emoji),
    el('h3', {}, title),
    el('p', {}, text),
  ]);
}
