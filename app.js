// ---- Settings: change these two lines to rename the site ----
const OWNER = 'Gede';
const TITLE = 'Photo Wall';
// -------------------------------------------------------------

const app = document.getElementById('app');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let data = { folders: [] }, current = '', homeHash = '', cam = null, stopCanvas = () => {};

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const src = (f, p) => `photos/${encodeURIComponent(f.dir)}/${encodeURIComponent(p.file)}`;

// Same folder always gets the same "random" tilt, so the stack doesn't jump on reload.
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const spread = (rnd, min, max) => (rnd() < .5 ? -1 : 1) * (min + rnd() * (max - min));

const tagLink = (t, on) => `<a class="chip" href="#tag/${encodeURIComponent(t.toLowerCase())}"${on ? ' aria-current="true"' : ''}>${esc(t)}</a>`;

function homeView(tag) {
  const page = el('div', 'page');
  const shown = tag ? data.folders.filter(f => (f.tags || []).some(t => t.toLowerCase() === tag)) : data.folders;
  const n = String(shown.length).padStart(2, '0');
  page.append(el('header', 'site-head', `<div><div class="small">${esc(OWNER)}</div><h1>${esc(TITLE)}</h1></div><div class="small">${n} folders</div>`));
  if (!data.folders.length) {
    page.append(el('p', 'empty', 'No photos yet. Add a folder with images inside the <b>photos</b> folder of this repository, and it will appear here.'));
    return page;
  }
  const seen = new Map();
  data.folders.forEach(f => (f.tags || []).forEach(t => { if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t); }));
  if (seen.size) {
    const row = el('nav', 'chips');
    row.setAttribute('aria-label', 'Filter by tag');
    row.innerHTML = `<a class="chip" href="#"${tag ? '' : ' aria-current="true"'}>All</a>` + [...seen.values()].sort((a, b) => a.localeCompare(b)).map(t => tagLink(t, t.toLowerCase() === tag)).join('');
    page.append(row);
  }
  if (!shown.length) { page.append(el('p', 'empty', 'No folders have this tag.')); return page; }
  const grid = el('div', 'world');
  shown.forEach(f => {
    const a = el('a', 'stack'); a.draggable = false; a.href = '#/' + f.slug; a.dataset.slug = f.slug;
    const rnd = seeded(f.slug);
    f.photos.slice(0, 3).map((p, i) => {
      const c = el('div', 'card' + (i === 0 ? ' top' : ''));
      if (i) { c.style.setProperty('--tx', spread(rnd, 6, 11) + 'px'); c.style.setProperty('--ty', spread(rnd, 5, 10) + 'px'); c.style.setProperty('--r', spread(rnd, 2, 6).toFixed(1) + 'deg'); }
      c.innerHTML = `<img src="${src(f, p)}" alt="" draggable="false" loading="lazy" decoding="async">`;
      return c;
    }).reverse().forEach(c => a.append(c));
    a.append(el('div', 'label', esc(f.name)));
    grid.append(a);
  });
  const vp = el('div', 'viewport'), ui = el('div', 'zoom-ui'), hint = el('div', 'pan-hint');
  ui.innerHTML = '<button data-z="out" aria-label="Zoom out">&minus;</button><button data-z="in" aria-label="Zoom in">+</button><button data-z="fit" class="wide" aria-label="Fit all folders">Fit</button>';
  hint.textContent = matchMedia('(pointer: coarse)').matches ? 'Pinch to zoom, drag to move' : 'Ctrl + scroll to zoom, drag to move';
  vp.append(grid, ui, hint);
  page.classList.add('home');
  page.append(vp);
  return page;
}

// Zoomable, pannable wall: drag to pan, pinch / Ctrl+scroll / buttons to zoom.
function initCanvas(page, key) {
  const vp = page.querySelector('.viewport'), world = vp.querySelector('.world'), hint = vp.querySelector('.pan-hint');
  const stacks = [...world.querySelectorAll('.stack')];
  const PAD = 56, M = 80;
  let b, fit, minS, maxS;
  const size = () => { const r = vp.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  const measure = () => {
    const x0 = Math.min(...stacks.map(e => e.offsetLeft)) - PAD, y0 = Math.min(...stacks.map(e => e.offsetTop)) - PAD;
    b = { x: x0, y: y0, w: Math.max(...stacks.map(e => e.offsetLeft)) + 220 - x0 + PAD, h: Math.max(...stacks.map(e => e.offsetTop)) + 310 - y0 + PAD };
    const { w, h } = size(), s = Math.min(w / b.w, h / b.h, 1);
    fit = { s, tx: (w - b.w * s) / 2 - b.x * s, ty: (h - b.h * s) / 2 - b.y * s };
    minS = fit.s * .6; maxS = Math.max(3, fit.s);
  };
  const apply = () => {
    const { w, h } = size();
    cam.s = Math.min(maxS, Math.max(minS, cam.s));
    cam.tx = Math.min(w - M - b.x * cam.s, Math.max(M - (b.x + b.w) * cam.s, cam.tx));
    cam.ty = Math.min(h - M - b.y * cam.s, Math.max(M - (b.y + b.h) * cam.s, cam.ty));
    world.style.transform = `translate(${cam.tx}px,${cam.ty}px) scale(${cam.s})`;
  };
  const touched = () => { cam.auto = false; hint.classList.add('off'); };
  const zoomAt = (f, cx, cy) => {
    const s = Math.min(maxS, Math.max(minS, cam.s * f)), k = s / cam.s;
    cam.tx = cx - (cx - cam.tx) * k; cam.ty = cy - (cy - cam.ty) * k; cam.s = s; touched(); apply();
  };
  const smooth = fn => { world.style.transition = 'transform .3s ease'; fn(); setTimeout(() => { world.style.transition = ''; }, 320); };
  const refit = () => { measure(); cam = { ...fit, key, auto: true }; apply(); };

  measure();
  if (!cam || cam.key !== key || cam.auto) cam = { ...fit, key, auto: true };
  apply();

  const ptrs = new Map(); let g = null, moved = false;
  const rel = e => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const base = () => {
    const pts = [...ptrs.values()];
    if (pts.length === 1) g = { n: 1, x: pts[0].x, y: pts[0].y, tx: cam.tx, ty: cam.ty };
    else if (pts.length > 1) { const [a, c] = pts; g = { n: 2, d: Math.hypot(a.x - c.x, a.y - c.y) || 1, mx: (a.x + c.x) / 2, my: (a.y + c.y) / 2, s: cam.s, tx: cam.tx, ty: cam.ty }; }
    else g = null;
  };
  vp.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!ptrs.size) moved = false;
    ptrs.set(e.pointerId, rel(e)); base();
  });
  const onMove = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, rel(e));
    const pts = [...ptrs.values()];
    if (pts.length === 1 && g && g.n === 1) {
      const dx = pts[0].x - g.x, dy = pts[0].y - g.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true; vp.classList.add('grabbing'); cam.tx = g.tx + dx; cam.ty = g.ty + dy;
    } else if (pts.length > 1 && g && g.n === 2) {
      moved = true;
      const [a, c] = pts, d = Math.hypot(a.x - c.x, a.y - c.y) || 1, mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
      const s = Math.min(maxS, Math.max(minS, g.s * d / g.d)), k = s / g.s;
      cam.tx = mx - (g.mx - g.tx) * k; cam.ty = my - (g.my - g.ty) * k; cam.s = s;
    } else return;
    touched(); apply();
  };
  const onUp = e => {
    if (!ptrs.delete(e.pointerId)) return;
    base();
    if (!ptrs.size) vp.classList.remove('grabbing');
  };
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  // A drag must not count as a tap on a stack.
  vp.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : 1, p = rel(e);
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * k * .01), p.x, p.y);
    else { cam.tx -= e.deltaX * k; cam.ty -= e.deltaY * k; touched(); apply(); }
  }, { passive: false });
  vp.querySelector('.zoom-ui').addEventListener('pointerdown', e => { moved = false; e.stopPropagation(); });
  vp.querySelector('.zoom-ui').addEventListener('click', e => {
    const z = e.target.dataset.z; if (!z) return;
    const { w, h } = size();
    smooth(() => { if (z === 'fit') { measure(); cam = { ...fit, key, auto: true }; apply(); } else zoomAt(z === 'in' ? 1.4 : 1 / 1.4, w / 2, h / 2); });
  });
  const onKey = e => {
    if (!lb.hidden || e.ctrlKey || e.metaKey) return;
    const { w, h } = size();
    if (e.key === '+' || e.key === '=') smooth(() => zoomAt(1.4, w / 2, h / 2));
    else if (e.key === '-') smooth(() => zoomAt(1 / 1.4, w / 2, h / 2));
    else if (e.key === '0') smooth(() => { measure(); cam = { ...fit, key, auto: true }; apply(); });
  };
  addEventListener('keydown', onKey);
  const ro = new ResizeObserver(() => { measure(); if (cam.auto) cam = { ...fit, key, auto: true }; apply(); });
  ro.observe(vp);
  return () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); removeEventListener('keydown', onKey); ro.disconnect(); };
}

function folderView(f) {
  const page = el('div', 'page');
  const back = el('button', 'back', '&larr; Back'); back.onclick = () => { location.hash = homeHash; };
  page.append(back);
  const intro = el('div', 'intro', `<div class="small">${f.photos.length} photo${f.photos.length > 1 ? 's' : ''}</div><h2>${esc(f.name)}</h2>${f.description ? `<p>${esc(f.description)}</p>` : ''}`);
  if (f.tags && f.tags.length) intro.append(el('div', 'chips', f.tags.map(t => tagLink(t, false)).join('')));
  const wrap = el('div', 'photos');
  const rnd = seeded(f.slug + 'view');
  f.photos.forEach((p, i) => {
    const fig = el('figure', 'photo', `<img src="${src(f, p)}" alt="${esc(p.caption || f.name)}" decoding="async">${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}`);
    fig.style.setProperty('--r', ((rnd() - .5) * 4).toFixed(1) + 'deg');
    fig.style.setProperty('--dy', Math.round(rnd() * 26) + 'px');
    fig.onclick = () => openLightbox(f, i);
    wrap.append(fig);
  });
  page.append(intro, wrap, el('p', 'hint', 'Click any photo to view it large.'));
  return page;
}

const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// Stack -> individual photos
function flyOut(page, origin) {
  if (reduce || !origin) return;
  const c = center(origin);
  page.querySelectorAll('.photo').forEach((fig, i) => {
    const r = fig.getBoundingClientRect(), m = center(r);
    const end = getComputedStyle(fig).transform;
    fig.animate([
      { transform: `translate(${c.x - m.x}px,${c.y - m.y}px) rotate(${(i % 3 - 1) * 4}deg) scale(${Math.min(1, origin.width / r.width)})`, opacity: i < 4 ? 1 : 0 },
      { transform: end === 'none' ? 'none' : end, opacity: 1 }
    ], { duration: 1000, delay: Math.min(i, 12) * 70, easing: 'cubic-bezier(.45,.05,.15,1)', fill: 'backwards' });
  });
  const intro = page.querySelector('.intro');
  intro.animate([{ transform: 'translateY(-18px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 250, easing: 'ease-out', fill: 'backwards' });
}

// Individual photos -> back into the stack
function flyBack(figs, slug) {
  const card = app.querySelector(`[data-slug="${CSS.escape(slug)}"] .card.top`);
  if (reduce || !card || !figs.length) return;
  const c = center(card.getBoundingClientRect());
  const layer = el('div'); layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5';
  figs.forEach(({ node, rect, w, h }, i) => {
    node.style.cssText = `position:fixed;margin:0;left:${rect.x - w / 2}px;top:${rect.y - h / 2}px;width:${w}px;height:${h}px`;
    layer.append(node);
    node.animate([{ transform: node.dataset.t, opacity: 1 }, { transform: `translate(${c.x - rect.x}px,${c.y - rect.y}px) scale(.8)`, opacity: 0 }],
      { duration: 500, delay: Math.min(i, 8) * 30, easing: 'ease-in', fill: 'forwards' });
  });
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1100);
}

function render() {
  const raw = location.hash.replace(/^#/, '');
  const isTag = raw.startsWith('tag/');
  const tag = isTag ? decodeURIComponent(raw.slice(4)).toLowerCase() : '';
  const slug = isTag ? '' : decodeURIComponent(raw.replace(/^\//, ''));
  const folder = data.folders.find(f => f.slug === slug);
  const stack = folder && app.querySelector(`[data-slug="${CSS.escape(slug)}"] .card.top`);
  const origin = stack && stack.getBoundingClientRect();
  const leaving = current && !folder
    ? [...app.querySelectorAll('.photo')].map(fig => {
        const node = fig.cloneNode(true), r = fig.getBoundingClientRect();
        node.dataset.t = getComputedStyle(fig).transform;
        return { node, rect: center(r), w: fig.offsetWidth, h: fig.offsetHeight };
      })
    : [];
  const prev = current;
  current = folder ? slug : '';
  if (!folder) homeHash = location.hash;
  stopCanvas(); stopCanvas = () => {};
  app.replaceChildren(folder ? folderView(folder) : homeView(tag));
  if (!folder && app.querySelector('.viewport')) stopCanvas = initCanvas(app.firstChild, tag);
  document.title = folder ? `${folder.name} · ${TITLE}` : TITLE;
  if (prev !== current) scrollTo(0, 0);
  if (folder) flyOut(app.firstChild, origin); else flyBack(leaving, prev);
}

// Lightbox
const lb = document.getElementById('lightbox'), lbImg = lb.querySelector('img'), lbCap = lb.querySelector('figcaption');
let lbFolder, lbIndex;
function showLb() {
  const p = lbFolder.photos[lbIndex];
  lbImg.src = src(lbFolder, p); lbImg.alt = p.caption || lbFolder.name; lbCap.textContent = p.caption || '';
}
function openLightbox(f, i) { lbFolder = f; lbIndex = i; showLb(); lb.hidden = false; lb.querySelector('.lb-close').focus(); }
function stepLb(d) { lbIndex = (lbIndex + d + lbFolder.photos.length) % lbFolder.photos.length; showLb(); }
lb.querySelector('.lb-close').onclick = () => { lb.hidden = true; };
lb.querySelector('.lb-prev').onclick = () => stepLb(-1);
lb.querySelector('.lb-next').onclick = () => stepLb(1);
let touchX = null;
lb.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX; touchX = null;
  if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1);
}, { passive: true });
lb.onclick = e => { if (e.target === lb) lb.hidden = true; };
addEventListener('keydown', e => {
  if (lb.hidden) return;
  if (e.key === 'Escape') lb.hidden = true;
  if (e.key === 'ArrowLeft') stepLb(-1);
  if (e.key === 'ArrowRight') stepLb(1);
});

addEventListener('hashchange', render);
fetch('gallery.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({ folders: [] }))
  .then(d => { data = d; render(); });
