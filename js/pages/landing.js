// js/pages/landing.js — hero, value props, and login/signup (or demo).

import { el, toast } from '../ui.js';
import { store } from '../store.js';

const REMEMBER_KEY = 'peakdates.rememberEmail';

export default async function renderLanding(view) {
  let mode = 'signup';

  const savedEmail = localStorage.getItem(REMEMBER_KEY) || '';

  // autocomplete="username" on the email field is what Chrome/Google autofill and
  // password managers key off to associate a saved credential with this site.
  const email = el('input.input', { type: 'email', name: 'email', placeholder: 'you@summit.co', autocomplete: 'username', value: savedEmail });
  const pass = el('input.input', { type: 'password', name: 'password', placeholder: 'A trail-worthy password', autocomplete: 'current-password' });
  const name = el('input.input', { type: 'text', name: 'name', placeholder: 'Your name (e.g. Alex)', autocomplete: 'name' });
  const nameField = el('div.field', {}, [el('label', {}, 'Your name'), name]);

  const remember = el('input', { type: 'checkbox', checked: savedEmail ? '' : null });
  const rememberField = el('label.remember-row', {}, [remember, el('span', {}, 'Remember my email on this device')]);

  // A real submit button inside a real <form> is what triggers the browser's
  // "save password?" prompt after a successful sign-in.
  const submitBtn = el('button.btn.btn-primary.btn-block.btn-lg', { type: 'submit' }, 'Start the climb');

  const tabs = el('div.auth-tabs', {}, [
    el('button', { type: 'button', class: 'on', onClick: () => setMode('signup') }, 'Sign up'),
    el('button', { type: 'button', onClick: () => setMode('login') }, 'Sign in'),
  ]);

  function setMode(m) {
    mode = m;
    [...tabs.children].forEach((b, i) => b.classList.toggle('on', (m === 'signup') === (i === 0)));
    nameField.classList.toggle('hidden', m === 'login');
    // Tell the password manager whether to offer a new password (signup) or fill an existing one (login).
    pass.setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
    submitBtn.textContent = m === 'signup' ? 'Start the climb' : 'Welcome back';
  }

  async function submit(e) {
    if (e) e.preventDefault();
    if (!email.value.trim() || !pass.value) { toast('Email and password, please', 'warn'); return; }
    submitBtn.disabled = true;
    if (remember.checked) localStorage.setItem(REMEMBER_KEY, email.value.trim());
    else localStorage.removeItem(REMEMBER_KEY);
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

  const authForm = el('form.auth-form', { onSubmit: submit }, [
    nameField,
    el('div.field', {}, [el('label', {}, 'Email'), email]),
    el('div.field', {}, [el('label', {}, 'Password'), pass]),
    rememberField,
    submitBtn,
  ]);

  const authCard = el('div.card.card-pad.auth-card', {}, [
    tabs, authForm,
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
  setMode(savedEmail ? 'login' : 'signup');
}

function feature(emoji, title, text) {
  return el('div.card.card-pad.feature', {}, [
    el('div.fe', {}, emoji),
    el('h3', {}, title),
    el('p', {}, text),
  ]);
}
