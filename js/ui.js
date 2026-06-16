// js/ui.js — reusable UI helpers: toast, modal, spinner, escaping, formatting.

// Tiny hyperscript-ish helper. el('div.foo', {onClick}, [children])
export function el(tag, attrs = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className += ' ' + v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Toast ──
function toastWrap() {
  let w = document.querySelector('.toast-wrap');
  if (!w) { w = el('div.toast-wrap'); document.body.appendChild(w); }
  return w;
}
export function toast(msg, kind = '', ms = 2800) {
  const t = el('div.toast' + (kind ? '.' + kind : ''), {}, msg);
  toastWrap().appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, ms);
}

// ── Modal ──
export function modal({ title = '', body, onClose }) {
  const overlay = el('div.modal-overlay');
  const close = () => { overlay.remove(); onClose && onClose(); };
  const box = el('div.modal');
  const head = el('div.modal-head', {}, [
    el('h3', {}, title),
    el('button.icon-btn', { onClick: close, 'aria-label': 'Close' }, '✕'),
  ]);
  const bodyNode = el('div.modal-body');
  if (typeof body === 'string') bodyNode.innerHTML = body;
  else if (body) bodyNode.appendChild(body);
  box.append(head, bodyNode);
  overlay.appendChild(box);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  document.body.appendChild(overlay);
  return { close, bodyNode };
}

// ── Loading & empty states (Colorado micro-copy) ──
const SCOUT_LINES = [
  'Scouting your next summit…', 'Checking the trail conditions…',
  'Reading the topo map…', 'Updating your elevation profile…',
  'Packing the daypack…',
];
export function loadingState(msg) {
  return el('div.loading-state', {}, [
    el('div.spinner'),
    el('div.mono', {}, msg || SCOUT_LINES[Math.floor(Math.random() * SCOUT_LINES.length)]),
  ]);
}
export function emptyState({ emoji = '🧭', title, text, action }) {
  return el('div.empty-state', {}, [
    el('div.emoji', {}, emoji),
    title && el('h3', {}, title),
    text && el('p', {}, text),
    action || null,
  ]);
}

// ── Formatting ──
export function costLabel(tier) { return ['Free', '$', '$$', '$$$'][tier] ?? '$'; }
export function titleCase(s) { return String(s || '').replace(/\b\w/g, c => c.toUpperCase()); }

export function starsDisplay(n) {
  const full = Math.round(n || 0);
  return el('span.stars', {}, '★★★★★☆☆☆☆☆'.slice(5 - full, 10 - full));
}

// Interactive star input → returns element; read current value via .value
export function starInput(initial = 0) {
  const wrap = el('span.stars.input');
  let val = initial;
  const render = () => Array.from(wrap.children).forEach((s, i) => s.classList.toggle('on', i < val));
  for (let i = 1; i <= 5; i++) {
    const s = el('span', { onClick: () => { val = i; render(); } }, '★');
    wrap.appendChild(s);
  }
  Object.defineProperty(wrap, 'value', { get: () => val });
  render();
  return wrap;
}

export function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const days = Math.round((now - d) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
}
