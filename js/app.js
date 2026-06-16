// js/app.js — hash router + app shell. Entry point for Peak Dates.

import { CONFIG } from './config.js';
import { el, toast } from './ui.js';
import { store } from './store.js';
import { loadSession, session } from './state.js';

import renderLanding from './pages/landing.js';
import renderOnboarding from './pages/onboarding.js';
import renderDashboard from './pages/dashboard.js';
import renderDiscover from './pages/discover.js';
import renderDateDetail from './pages/date-detail.js';
import renderHistory from './pages/history.js';
import renderProfile from './pages/profile.js';

const routes = {
  '': renderLanding,
  'onboarding': renderOnboarding,
  'dashboard': renderDashboard,
  'discover': renderDiscover,
  'date': renderDateDetail,   // #/date/:id
  'history': renderHistory,
  'profile': renderProfile,
};

const PROTECTED = new Set(['dashboard', 'discover', 'date', 'history', 'profile']);

// ── Theme ──
function applyTheme() {
  const saved = localStorage.getItem('peakdates.theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  return saved;
}
// Reload data from the store and re-render the current view.
async function refreshNow(e) {
  const btn = e?.currentTarget;
  if (btn) btn.classList.add('spinning');
  await route();
  toast('Refreshed 🗺️', 'success', 1500);
}

function toggleTheme() {
  const next = (localStorage.getItem('peakdates.theme') || 'light') === 'light' ? 'dark' : 'light';
  localStorage.setItem('peakdates.theme', next);
  applyTheme();
  renderChrome();
}

// ── App chrome (header + footer) ──
function renderChrome() {
  const logged = !!session.user;
  const theme = localStorage.getItem('peakdates.theme') || 'light';
  const hashRoot = (location.hash.replace(/^#\/?/, '').split('/')[0]) || '';

  const navItems = logged ? [
    ['#/dashboard', 'This Week'],
    ['#/discover', 'Discover'],
    ['#/history', 'Scrapbook'],
    ['#/profile', 'Profile'],
  ] : [];

  const links = el('nav.navlinks', { id: 'navlinks' },
    navItems.map(([href, label]) => el('a', { href, class: href === '#/' + hashRoot ? 'active' : '' }, label)));

  const actions = el('div.nav-actions', {}, [
    logged ? el('button.icon-btn', { title: 'Refresh', 'aria-label': 'Refresh', onClick: refreshNow }, '🔄') : null,
    el('button.icon-btn', { title: 'Toggle theme', onClick: toggleTheme }, theme === 'light' ? '🌙' : '☀️'),
    logged
      ? el('button.btn.btn-ghost.btn-sm', { onClick: async () => { await store.signOut(); location.hash = '#/'; await route(); } }, 'Sign out')
      : el('a.btn.btn-summit.btn-sm', { href: '#/' }, 'Sign in'),
  ]);

  const toggle = el('button.nav-toggle', { 'aria-label': 'Menu', onClick: () => links.classList.toggle('open') }, '☰');

  const bar = el('header.appbar', {}, [
    el('a.brand-mark', { href: logged ? '#/dashboard' : '#/' }, [
      el('span.peak', {}, '🏔️'),
      el('span', {}, [document.createTextNode('Peak Dates'), el('small', {}, CONFIG.TAGLINE)]),
    ]),
    logged ? links : el('span'),
    el('div.row', { style: 'align-items:center;gap:8px' }, [logged ? toggle : el('span'), actions]),
  ]);

  const foot = el('footer.appfoot', {}, [
    el('div', {}, '🏔️ Peak Dates — every date, a new summit'),
    el('div.mono', {}, 'ELEV 5,280 FT · Built for Colorado couples · Local-first demo'),
  ]);

  document.getElementById('appbar-slot').replaceChildren(bar);
  document.getElementById('foot-slot').replaceChildren(foot);
}

// ── Router ──
async function route() {
  await loadSession();
  renderChrome();

  const raw = location.hash.replace(/^#\/?/, '');
  const [seg, param] = raw.split('/');
  const key = seg || '';

  // Auth guard
  if (PROTECTED.has(key) && !session.user) { location.hash = '#/'; return; }
  // If logged in & not onboarded, force onboarding
  if (session.user && !session.user.onboarded && key !== 'onboarding') { location.hash = '#/onboarding'; return; }
  // Logged-in users landing on '' go to dashboard
  if (key === '' && session.user && session.user.onboarded) { location.hash = '#/dashboard'; return; }

  const view = document.getElementById('view');
  view.replaceChildren();
  window.scrollTo(0, 0);

  const handler = routes[key] || renderLanding;
  try {
    await handler(view, param);
  } catch (err) {
    console.error(err);
    view.replaceChildren(el('div.container', {}, el('div.empty-state', {}, [
      el('div.emoji', {}, '⛰️'),
      el('h3', {}, 'Hit a rough patch on the trail'),
      el('p', {}, String(err.message || err)),
    ])));
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => { applyTheme(); route(); });

// expose for debugging
window.PeakDates = { store, session };
