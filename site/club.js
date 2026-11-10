// The home page of aitclub.org: the hero's ASCII field (the club's figures, with guests flashing by
// between them) and the news plates you pull out of a stack. The basement lives in basement.js.
import '@fontsource-variable/jetbrains-mono'
import './club.css'
import './basement.js'
import { contactHref } from '../src/lib/recruitment'

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONO = '"JetBrains Mono Variable", ui-monospace, Menlo, Consolas, monospace';
const MOBILE = innerWidth < 760;
const N = MOBILE ? 16000 : 40000;
const DK = N / 9000; // more points, same tone: glyphs read density relative to this
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const RAMP = ' .:-=+*#%@';
const glyph = (v, k = 1) => RAMP[Math.min(9, 1 + ((Math.log2(1 + v / k) * 2.3) | 0))];

/* ---------- shapes: n points in roughly [-1, 1]³, sorted left to right so morphs flow ---------- */
function sph(c, r) { const u = Math.random() * 2 - 1, t = Math.random() * 6.2832, s = Math.sqrt(1 - u * u); return [c[0] + r * s * Math.cos(t), c[1] + r * u, c[2] + r * s * Math.sin(t)]; }
function seg(a, b) { const t = Math.random(); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function build(prims, n) {
  const tw = prims.reduce((s, p) => s + p.w, 0), out = [];
  prims.forEach(p => { const c = Math.max(1, Math.round(p.w / tw * n)); for (let j = 0; j < c; j++) out.push([...p.g(), p.a ? 1 : 0]); });
  while (out.length > n) out.splice((Math.random() * out.length) | 0, 1);
  while (out.length < n) out.push(out[(Math.random() * out.length) | 0].slice());
  out.sort((a, b) => (a[0] + a[1] * 0.3) - (b[0] + b[1] * 0.3));
  const P = new Float32Array(n * 3), A = new Uint8Array(n);
  out.forEach((q, i) => { P[i * 3] = q[0]; P[i * 3 + 1] = q[1]; P[i * 3 + 2] = q[2]; A[i] = q[3]; });
  return { P, A, n };
}
function graph(nodes, edges, accN, accE, r, n) {
  const prims = [];
  nodes.forEach((p, i) => prims.push({ w: 1.1, g: () => sph(p, r), a: accN.has(i) }));
  edges.forEach(([i, j], k) => { const a = nodes[i], b = nodes[j]; prims.push({ w: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 1.4, g: () => seg(a, b), a: accE.has(k) }); });
  return build(prims, n);
}
function neural(n) {
  const L = [4, 7, 7, 5, 2], nodes = [], idx = [];
  L.forEach((c, l) => { idx[l] = []; for (let j = 0; j < c; j++) { idx[l].push(nodes.length); nodes.push([-1 + l * 0.5, (j - (c - 1) / 2) * 0.27, (((j + l) % 2) - 0.5) * 0.3]); } });
  const path = [idx[0][1], idx[1][4], idx[2][2], idx[3][3], idx[4][0]], edges = [], accE = new Set();
  for (let l = 0; l < L.length - 1; l++) for (const a of idx[l]) for (const b of idx[l + 1]) { if (path[l] === a && path[l + 1] === b) accE.add(edges.length); edges.push([a, b]); }
  return graph(nodes, edges, new Set(path), accE, 0.055, n);
}
function tree(n) {
  const nodes = [], edges = [], lv = [];
  for (let d = 0; d < 5; d++) { lv[d] = []; const c = 1 << d; for (let j = 0; j < c; j++) { lv[d].push(nodes.length); nodes.push([((j + 0.5) / c - 0.5) * 2.1, 0.9 - d * 0.44, d ? ((j % 2) - 0.5) * 0.2 : 0]); } }
  const pick = [0, 1, 2, 5, 10], accN = new Set(pick.map((j, d) => lv[d][j])), accE = new Set();
  for (let d = 1; d < 5; d++) lv[d].forEach((ni, j) => { const pi = lv[d - 1][j >> 1]; if (accN.has(ni) && accN.has(pi)) accE.add(edges.length); edges.push([pi, ni]); });
  return graph(nodes, edges, accN, accE, 0.05, n);
}
function bars(n) {
  const hs = [0.22, 0.3, 0.36, 0.48, 0.6, 0.78, 1], prims = [], base = -0.75, w = 0.17, dz = 0.22;
  hs.forEach((h, i) => {
    const x = -0.9 + i * 0.3, hh = h * 1.5;
    prims.push({ w: hh * 1.4 + 0.3, a: false, g: () => {
      const f = (Math.random() * 5) | 0, u = Math.random(), v = Math.random();
      if (f === 0) return [x - w / 2 + u * w, base + v * hh, -dz / 2];
      if (f === 1) return [x - w / 2 + u * w, base + v * hh, dz / 2];
      if (f === 2) return [x - w / 2, base + v * hh, -dz / 2 + u * dz];
      if (f === 3) return [x + w / 2, base + v * hh, -dz / 2 + u * dz];
      return [x - w / 2 + u * w, base + hh, -dz / 2 + v * dz];
    } });
  });
  const tops = hs.map((h, i) => [-0.9 + i * 0.3, base + h * 1.5 + 0.14, 0]);
  for (let i = 0; i < tops.length - 1; i++) prims.push({ w: 0.5, a: true, g: () => seg(tops[i], tops[i + 1]) });
  tops.forEach(t => prims.push({ w: 0.12, a: true, g: () => sph(t, 0.035) }));
  return build(prims, n);
}
// Sample a picture: darker pixels get more points, so the shading survives into the symbols.
// Photos are contrast-stretched first (normalize) and their soft edges thin out (alphaWeight).
function picture(c, opts, n) {
  const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const raw = [];
  let lo = 1, hi = 0;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const k = (y * w + x) * 4; if (d[k + 3] < 60) continue;
    const v = 1 - (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255;
    const fx = opts.fadeX ? Math.min(1, x / (w * opts.fadeX), (w - x) / (w * opts.fadeX)) : 1;
    raw.push([x, y, v, d[k + 3] / 255 * fx]);
  }
  // detail: unsharp mask, so a beak or a knuckle stands out from a surface of the same brightness
  if (opts.detail) {
    const D = new Float32Array(w * h), A = new Float32Array(w * h);
    raw.forEach(r => { const i = r[1] * w + r[0]; D[i] = r[2]; A[i] = 1; });
    const blur = (src, rad) => {
      const t = new Float32Array(w * h), o = new Float32Array(w * h);
      for (let y = 0; y < h; y++) { let a = 0; for (let x = -rad; x < w; x++) { if (x + rad < w) a += src[y * w + x + rad]; if (x - rad - 1 >= 0) a -= src[y * w + x - rad - 1]; if (x >= 0) t[y * w + x] = a; } }
      for (let x = 0; x < w; x++) { let a = 0; for (let y = -rad; y < h; y++) { if (y + rad < h) a += t[(y + rad) * w + x]; if (y - rad - 1 >= 0) a -= t[(y - rad - 1) * w + x]; if (y >= 0) o[y * w + x] = a; } }
      return o;
    };
    const bd = blur(D, opts.detail.r), ba = blur(A, opts.detail.r);
    raw.forEach(r => { const i = r[1] * w + r[0], m = bd[i] / Math.max(1, ba[i]); r[2] = Math.min(1, Math.max(0, r[2] + (r[2] - m) * opts.detail.k)); });
  }
  raw.forEach(r => { if (r[2] < lo) lo = r[2]; if (r[2] > hi) hi = r[2]; });
  const span = Math.max(0.05, hi - lo), px = [], acc = [];
  // equalize: replace each tone by its rank among the picture's tones, so even a flat photo gets full contrast
  let rank = null;
  if (opts.equalize) {
    const hist = new Float32Array(256); raw.forEach(r => hist[Math.min(255, (r[2] * 255) | 0)]++);
    rank = new Float32Array(256); let acc0 = 0; for (let i = 0; i < 256; i++) { acc0 += hist[i]; rank[i] = acc0 / raw.length; }
  }
  for (const r of raw) {
    let v = rank ? rank[Math.min(255, (r[2] * 255) | 0)] : opts.normalize ? (r[2] - lo) / span : r[2];
    v = Math.pow(Math.max(0, v), opts.gamma || 1);
    if (opts.alphaWeight) v = (opts.floor || 0.15) * r[3] + (1 - (opts.floor || 0.15)) * v * r[3];
    (opts.acc && opts.acc(r[0], r[1]) ? acc : px).push([r[0], r[1], v]);
  }
  const s = opts.width / w, k0 = opts.scale || 1, ox = opts.ox || 0, oy = opts.oy || 0;
  const conv = p => [((p[0] + Math.random()) * s - opts.width / 2 + ox) * k0, (oy - ((p[1] + Math.random()) * s - h * s / 2)) * k0, (Math.random() - 0.5) * 0.12];
  const pick = list => () => { for (let t = 0; t < 40; t++) { const p = list[(Math.random() * list.length) | 0]; if (Math.random() < 0.02 + p[2] * 0.98) return conv(p); } return conv(list[0]); };
  const prims = [{ w: px.reduce((a, p) => a + 0.02 + p[2], 0), a: false, g: pick(px) }];
  if (acc.length) prims.push({ w: acc.reduce((a, p) => a + 0.06 + p[2], 0) * 1.4, a: true, g: pick(acc) });
  if (opts.spark) prims.push({ w: opts.spark.w, a: true, g: () => conv([opts.spark.x + (Math.random() - 0.5) * 6, opts.spark.y + (Math.random() - 0.5) * 6, 1]) });
  return build(prims, n);
}
function photo(img, sx, sy, sw, sh, opts, n) {
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return picture(c, opts, n);
}
function logo(img, n) {
  const w = 600, h = Math.max(1, Math.round(600 * img.naturalHeight / img.naturalWidth));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; let any = false;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 140) { any = true; break; }
  if (!any) return neural(n);
  return picture(c, { width: 2.1 }, n);
}

/* Two hands almost touching, after Michelangelo's «Creation of Adam», from the club's picture. */
const IMG_HANDS = new Image(); IMG_HANDS.src = '/img/hands.webp';
const IMG_PARROT = new Image(); IMG_PARROT.src = '/img/parrot.webp';
function hands(n) {
  // crop to the hands themselves (x 120..640, y 118..306 of the picture); the arms fade out at the cut
  const tips = [[232, 95], [257, 92]];
  return photo(IMG_HANDS, 120, 118, 520, 188, {
    width: 2.6, scale: 1.08, ox: 0.11, oy: 0.3, gamma: 1.2, detail: { r: 8, k: 1.4 }, normalize: true, alphaWeight: true, floor: 0.35, fadeX: 0.12,
    acc: (x, y) => tips.some(t => Math.hypot(x - t[0], y - t[1]) < 8),
    spark: { x: 245, y: 94, w: 30 },
  }, n);
}
const parrotFrame = (k, n) => photo(IMG_PARROT, k * 450, 0, 450, 334, { width: 2.1, gamma: 2.0, detail: { r: 14, k: 2.2 }, equalize: true, alphaWeight: true, floor: 0.06 }, n);

/* Guests: pictures from outside the club. One of them flashes by for a second between two of the club's figures. */
const IMG_STATUE = new Image(); IMG_STATUE.src = '/img/statue.webp';
const IMG_SELFIE = new Image(); IMG_SELFIE.src = '/img/selfie.webp';
const statue = n => photo(IMG_STATUE, 0, 0, 299, 822, {
  width: 0.98, oy: 0.05, gamma: 1.6, detail: { r: 10, k: 1.8 }, equalize: true, alphaWeight: true, floor: 0.1,
  acc: (x, y) => y < 34 && x > 30 && x < 95,   // the torch flame
}, n);
const selfie = n => photo(IMG_SELFIE, 190, 0, 340, 215, { width: 2.3, oy: 0.12, gamma: 4.5, detail: { r: 8, k: 2 }, equalize: true, alphaWeight: true, floor: 0.03, fadeX: 0.15 }, n);

const GUESTS = [
  { make: n => parrotFrame(0, n), name: 'Попугай', rot: 0.18, src: 'squawk ', frames: [] },
  { make: statue, name: 'Статуя Свободы', rot: 0.3, src: 'liberty ' },
  { make: selfie, name: 'Кот', rot: 0.15, src: 'мяу ' },
];

const META = [
  { name: 'Строить своё', dir: 'По мотивам «Сотворения Адама» Микеланджело', note: '<i>Красным</i> искра между рукой человека и тем, что он создаёт', rot: 0.12, src: 'строить своё ' },
  { name: 'Нейросеть', dir: 'Искусственный интеллект, 12 проектов CS50 AI', note: '<i>Красным</i> путь сигнала от входа к ответу', rot: 0.6, src: 'y=relu(Wx+b) w=0.73 b=-1.2 ' },
  { name: 'Дерево поиска', dir: 'Алгоритмы и олимпиады, около 200 задач на C++', note: '<i>Красным</i> ход, который выбирает минимакс', rot: 0.5, src: 'max(min(3,5),min(2,9))=3 ' },
  { name: 'Рост продукта', dir: 'Стартап-инженерия, продукт с первыми пользователями', note: '<i>Красным</i> кривая пользователей по неделям', rot: 0.6, src: 'users 12 18 25 34 47 63 81 ' },
  { name: 'AIT Club', dir: 'Технологический клуб НИШ Петропавловска', note: 'Знак клуба, собранный из символов', rot: 0.22, src: 'AIT Club ' },
];
const MAIN = META.length;
GUESTS.forEach(gs => META.push(gs));

/* ---------- theme colours, read from the tokens ---------- */
let colors = {};
function readColors() {
  const s = getComputedStyle(document.documentElement);
  colors = { ink: s.getPropertyValue('--ascii').trim(), dim: s.getPropertyValue('--ascii-dim').trim(), red: s.getPropertyValue('--ascii-red').trim() };
}
readColors();
const onTheme = () => { readColors(); drawGrid(); kick(); };
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme);
new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------- hero field ---------- */
const hero = document.getElementById('hero'), cv = document.getElementById('field'), ctx = cv.getContext('2d');
const gv = document.getElementById('grid'), gtx = gv.getContext('2d');
let W = 0, H = 0, dpr = 1, fs = 9, cw = 5.4, chh = 11, cols = 0, rows = 0, dens = null, accA = null, mark = null, CX = 0, CY = 0, S = 1, R = 90;
let shapes = [], cur = 0, nxt = 0, phase = 'hold', holdStart = 0, tStart = 0, running = false, raf = 0, ready = false;
const HOLD = 5200, MORPH = 2000, GUEST_IN = 600, GUEST_HOLD = 2000, GUEST_OUT = 1000;
let morphDur = MORPH, after = -1, bag = [];
let mx = -1e5, my = -1e5, area = { l: 0, r: 0, t: 0, b: 0 }, SMAX = 200;

function drawGrid() {
  if (!W) return;
  gtx.setTransform(dpr, 0, 0, dpr, 0, 0); gtx.clearRect(0, 0, W, H);
  gtx.font = fs + 'px ' + MONO; gtx.textBaseline = 'top'; gtx.fillStyle = colors.dim;
  for (let r = 2; r < rows; r += 3) for (let c = (r % 2) * 3; c < cols; c += 6) gtx.fillText('.', c * cw, r * chh);
}
function resize() {
  W = hero.clientWidth; H = hero.clientHeight; dpr = Math.min(2, devicePixelRatio || 1);
  [cv, gv].forEach(el => { el.width = Math.round(W * dpr); el.height = Math.round(H * dpr); });
  const mob = W < 760; fs = mob ? 6 : 7;
  ctx.font = fs + 'px ' + MONO; cw = Math.max(4, ctx.measureText('M').width); chh = Math.round(fs * 1.15);
  cols = Math.ceil(W / cw); rows = Math.ceil(H / chh);
  dens = new Float32Array(cols * rows); accA = new Uint8Array(cols * rows); mark = new Uint8Array(cols * rows);
  // The figures live in the free part of the hero: right of the text and above the caption card on a
  // computer, above the heading on a phone. Each figure is centred and fitted there by its own size.
  const hr = hero.getBoundingClientRect(), k0 = hr.width ? W / hr.width : 1;
  const rel = el => { const r = el.getBoundingClientRect(); return { l: (r.left - hr.left) * k0, r: (r.right - hr.left) * k0, t: (r.top - hr.top) * k0, b: (r.bottom - hr.top) * k0 }; };
  const copy = rel(document.querySelector('.hero-copy')), card = rel(document.querySelector('.now')), h1 = rel(document.querySelector('.hero h1'));
  if (mob) { area = { l: 16, r: W - 16, t: 78, b: Math.max(150, h1.t - 18) }; R = 64; SMAX = W * 0.36; }
  else { area = { l: Math.min(copy.r + 56, W * 0.62), r: W - Math.max(32, W * 0.035), t: 104, b: Math.max(H * 0.5, card.t - 28) }; R = 92; SMAX = Math.min(H * 0.34, 320); }
  CX = (area.l + area.r) / 2; CY = (area.t + area.b) / 2; S = Math.min(SMAX, (area.r - area.l) / 2);
  drawGrid(); kick();
}
// A figure's extent, ignoring the stray 1% of points on each side.
function boxOf(sh) {
  if (sh.box) return sh.box;
  const q = (arr, t) => arr[Math.min(arr.length - 1, Math.max(0, (arr.length * t) | 0))];
  const xs = [], ys = [];
  for (let i = 0; i < sh.n; i += 4) { xs.push(sh.P[i * 3]); ys.push(sh.P[i * 3 + 1]); }
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const x0 = q(xs, 0.01), x1 = q(xs, 0.99), y0 = q(ys, 0.01), y1 = q(ys, 0.99);
  return (sh.box = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: Math.max(0.2, (x1 - x0) / 2), hh: Math.max(0.2, (y1 - y0) / 2) });
}
const fitScale = b => Math.min(SMAX, (area.r - area.l) / 2 / (b.hw * 1.12), (area.b - area.t) / 2 / (b.hh * 1.12));

function setCaption(i) {
  const box = document.getElementById('nowText');
  box.classList.add('out');
  setTimeout(() => {
    document.getElementById('nowName').textContent = META[i].name;
    document.getElementById('nowDir').textContent = META[i].dir;
    document.getElementById('nowNote').innerHTML = META[i].note;
    box.classList.remove('out');
  }, reduce ? 0 : 320);
  dotEls.forEach((d, k) => { d.classList.toggle('on', k === i); d.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
}
// The club's figures go in order. Between two of them a guest flashes by for about a second:
// the card already names the next figure, the guest is just a glimpse. Guests come in shuffled turns.
function pickGuest() {
  const ready = i => !GUESTS[i].frames || GUESTS[i].frames.length === 10;
  if (!bag.length) bag = GUESTS.map((g, i) => i).sort(() => Math.random() - 0.5);
  const k = bag.findIndex(ready);
  return k < 0 ? -1 : MAIN + bag.splice(k, 1)[0];
}
function advance() {
  if (cur >= MAIN) { const t = after; after = -1; goTo(t, GUEST_OUT, false); return; }
  const next = (cur + 1) % MAIN, g = reduce ? -1 : pickGuest();
  if (g < 0) { goTo(next); return; }
  after = next; setCaption(next); goTo(g, GUEST_IN, false);
}
function goTo(i, dur = MORPH, caption = true) {
  if (!ready || i === cur || phase === 'morph') return;
  if (caption) setCaption(i);
  if (reduce) { cur = nxt = i; draw(performance.now()); return; }
  morphDur = dur; nxt = i; phase = 'morph'; tStart = performance.now();
}
const dotsBox = document.getElementById('dots');
const dotEls = META.slice(0, MAIN).map((m, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Показать: ' + m.name);
  b.addEventListener('click', () => { if (phase === 'morph' && nxt >= MAIN) return; after = -1; goTo(i); }); dotsBox.appendChild(b); return b;
});
dotEls[0].classList.add('on');

function draw(now) {
  if (!ready || !dens) return;
  let p = 0;
  if (phase === 'hold' && !reduce && now - holdStart > (cur >= MAIN ? GUEST_HOLD : HOLD)) advance();
  if (phase === 'morph') { p = Math.min(1, (now - tStart) / morphDur); if (p >= 1) { cur = nxt; phase = 'hold'; holdStart = now; p = 0; } }
  const fr = phase === 'hold' && META[cur].frames && META[cur].frames.length === 10 ? META[cur].frames[((now / 70) | 0) % 10] : null;
  const A = fr || shapes[cur], B = fr || shapes[phase === 'morph' ? nxt : cur];
  const ep = ease(p), amp = META[cur].rot + (META[nxt].rot - META[cur].rot) * (phase === 'morph' ? ep : 0);
  const ry = reduce ? 0.35 * amp : Math.sin(now * 0.00035) * amp, rx = 0.1;
  const cyr = Math.cos(ry), syr = Math.sin(ry), cxr = Math.cos(rx), sxr = Math.sin(rx), f = 3.2;
  // centre and scale glide from one figure's box to the next one's
  const bA = boxOf(shapes[cur]), bB = boxOf(shapes[phase === 'morph' ? nxt : cur]), m = phase === 'morph' ? ep : 0;
  const ox = bA.cx + (bB.cx - bA.cx) * m, oy = bA.cy + (bB.cy - bA.cy) * m, Sd = fitScale(bA) + (fitScale(bB) - fitScale(bA)) * m;
  dens.fill(0); accA.fill(0);
  for (let i = 0; i < N; i++) {
    const a3 = i * 3;
    let x = A.P[a3], y = A.P[a3 + 1], z = A.P[a3 + 2], lt = 0;
    if (phase === 'morph') {
      lt = ease(clamp((p - (i / N) * 0.3) / 0.7, 0, 1));
      x += (B.P[a3] - x) * lt; y += (B.P[a3 + 1] - y) * lt; z += (B.P[a3 + 2] - z) * lt;
      const bump = Math.sin(lt * Math.PI); y += Math.sin(i * 12.9898) * 0.1 * bump; z += Math.cos(i * 78.233) * 0.25 * bump;
    }
    x -= ox; y -= oy;
    const X = x * cyr + z * syr; let Z = -x * syr + z * cyr; const Y = y * cxr - Z * sxr; Z = y * sxr + Z * cxr;
    const sc = f / (f + Z), px = CX + X * Sd * sc, py = CY - Y * Sd * sc;
    if (px < 0 || py < 0) continue;
    const c = (px / cw) | 0, r = (py / chh) | 0;
    if (c >= cols || r >= rows) continue;
    const ci = r * cols + c;
    dens[ci] += 0.6 + 0.4 * sc;
    if ((lt > 0.5 ? B.A[i] : A.A[i])) accA[ci] = 1;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.font = fs + 'px ' + MONO; ctx.textBaseline = 'top';
  // X-ray: under the cursor the figure shows what it is made of, written in its own formula or data.
  const lens = R, lens2 = lens * lens, src = META[phase === 'morph' && p > 0.5 ? nxt : cur].src, xray = [];
  const on = !reduce && mx > -1e4;
  mark.fill(0);
  if (on) {
    const c0 = Math.max(0, ((mx - lens) / cw) | 0), c1 = Math.min(cols - 1, ((mx + lens) / cw) | 0), r0 = Math.max(0, ((my - lens) / chh) | 0), r1 = Math.min(rows - 1, ((my + lens) / chh) | 0);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const ci = r * cols + c; if (!dens[ci]) continue;
      const dx = c * cw - mx, dy = r * chh - my;
      if (dx * dx + dy * dy < lens2) { mark[ci] = 1; xray.push(ci); }
    }
  }
  ctx.fillStyle = colors.ink;
  for (let ci = 0; ci < dens.length; ci++) { const v = dens[ci]; if (!v || accA[ci] || mark[ci]) continue; ctx.fillText(glyph(v, DK), (ci % cols) * cw, ((ci / cols) | 0) * chh); }
  ctx.fillStyle = colors.red;
  for (let ci = 0; ci < dens.length; ci++) { if (!accA[ci] || mark[ci]) continue; ctx.fillText(glyph(dens[ci] + 3 * DK, DK), (ci % cols) * cw, ((ci / cols) | 0) * chh); }
  for (const ci of xray) { const c = ci % cols, r = (ci / cols) | 0; ctx.fillText(src[(c + r * 7) % src.length], c * cw, r * chh); }
}

function loop(now) { if (!running) { raf = 0; return; } draw(now); raf = requestAnimationFrame(loop); }
function kick() {
  if (reduce || !running) { requestAnimationFrame(t => draw(t)); return; }
  if (!raf) raf = requestAnimationFrame(loop);
}
new IntersectionObserver(es => { running = es[0].isIntersecting && !document.hidden; kick(); }).observe(hero);
document.addEventListener('visibilitychange', () => { running = !document.hidden && hero.getBoundingClientRect().bottom > 0; kick(); });
// Map the pointer into the canvas's own pixels, even when the page is shown scaled.
hero.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(), k = r.width ? W / r.width : 1; mx = (e.clientX - r.left) * k; my = (e.clientY - r.top) * (r.height ? H / r.height : 1); if (reduce) kick(); });
hero.addEventListener('pointerleave', () => { mx = my = -1e5; });

/* ---------- news plates ---------- */
// The photos come from Unsplash under its license (unsplash.com/license), cropped for the plates in
// site/public/img/news: team rtD_lcsN6_U (also team-wide, the pop-up's), ait-week 8gAbl776pc0,
// contest FWoq_ldWlNQ, cs50 uL1TI7xyLHQ — unsplash.com/photos/<id>.
const channel = contactHref(import.meta.env.VITE_TEAM_CONTACT ?? '');
const POSTS = [
  { date: '9 ноября', title: 'Набор организаторов в сети НИШ', img: '/img/news/team.webp', link: { href: '/apply', label: 'Подать заявку' },
    text: 'Строим организацию, и нам нужны организаторы и менторы из разных НИШ. Это отбор, а не открытый набор: после анкеты будет онлайн-собеседование, для некоторых ролей небольшое задание, а кандидат в менторы проводит пробное занятие. Заявки принимаются с 9 по 16 ноября, собеседования и отбор с 17 по 23 ноября.' },
  { date: '30 ноября – 6 декабря', title: 'AIT Week: открытые онлайн-занятия', img: '/img/news/ait-week.webp', link: channel && { href: channel, label: 'Канал клуба' },
    text: 'С неё начинается новый сезон клуба, теперь для учеников всех НИШ. В каждом направлении пройдёт открытое первое занятие: искусственный интеллект, олимпиадное программирование и стартапы. Можно прийти на все три, выбрать своё и записаться прямо после занятия. Расписание появится в Telegram-канале клуба.' },
  { date: 'Неделя 8', title: 'Первый рейтинговый контест алгоритмов', img: '/img/news/contest.webp',
    text: 'Контест по правилам, объявленным заранее, в группе клуба на Codeforces. По нему впервые меняется рейтинг направления: разрыв между «знаю тему» и «решил под таймером» лучше увидеть рано.' },
  { date: 'Каждую неделю', title: 'Проекты CS50 AI проходят check50', img: '/img/news/cs50.webp',
    text: 'Двенадцать официальных проектов курса Гарварда с той же автоматической проверкой, что у его студентов. Работа принимается, когда её автор может объяснить, как она устроена.' },
];
const TONES = { ink: { bg: '#1b1a18', fg: '#f3f2ee', acc: '#e0465c' },
                red: { bg: '#750014', fg: '#f3d9dd', acc: '#ffffff' },
                paper: { bg: '#e9e6df', fg: '#141414', acc: '#750014' } };

function drawThumb(canvas, shape, tone, rot) {
  const r = canvas.getBoundingClientRect(), w = Math.max(10, r.width), h = Math.max(10, r.height), k = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
  const c = canvas.getContext('2d'), t = TONES[tone];
  c.setTransform(k, 0, 0, k, 0, 0); c.fillStyle = t.bg; c.fillRect(0, 0, w, h);
  const f2 = w < 240 ? 5 : 6; c.font = f2 + 'px ' + MONO; c.textBaseline = 'top';
  const cw2 = c.measureText('M').width, ch2 = Math.round(f2 * 1.2), C = Math.ceil(w / cw2), Rw = Math.ceil(h / ch2);
  const d = new Float32Array(C * Rw), a = new Uint8Array(C * Rw), s = Math.min(w * 0.34, h * 0.4), cx = w / 2, cy = h * 0.47;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < shape.n; i++) {
    const x = shape.P[i * 3], y = shape.P[i * 3 + 1], z = shape.P[i * 3 + 2];
    const X = x * cr + z * sr, Z = -x * sr + z * cr, sc = 3.2 / (3.2 + Z);
    const px = cx + X * s * sc, py = cy - y * s * sc;
    if (px < 0 || py < 0) continue;
    const col = (px / cw2) | 0, row = (py / ch2) | 0;
    if (col >= C || row >= Rw) continue;
    d[row * C + col] += 1; if (shape.A[i]) a[row * C + col] = 1;
  }
  c.fillStyle = t.fg; c.globalAlpha = 0.16;
  for (let row = 2; row < Rw; row += 3) for (let col = (row % 2) * 3; col < C; col += 6) if (!d[row * C + col]) c.fillText('.', col * cw2, row * ch2);
  c.globalAlpha = 1;
  for (let i = 0; i < d.length; i++) if (d[i] && !a[i]) c.fillText(glyph(d[i]), (i % C) * cw2, ((i / C) | 0) * ch2);
  c.fillStyle = t.acc;
  for (let i = 0; i < d.length; i++) if (a[i]) c.fillText(glyph(d[i] + 3), (i % C) * cw2, ((i / C) | 0) * ch2);
}

const stage = document.getElementById('stage'), stack = document.getElementById('stack'), detail = document.getElementById('detail');
let plates = [], focus = 0, open = false, sel = -1;
let drag = null, moved = false, dragging = false, snapT = 0;
const pipEls = POSTS.map(() => { const i = document.createElement('i'); document.getElementById('pips').appendChild(i); return i; });
const isMob = () => stage.clientWidth < 700;
const steps = () => (isMob() ? { x: 64, y: 16, z: 90 } : { x: 150, y: 26, z: 120 });

POSTS.forEach((p, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'plate'; b.setAttribute('aria-label', p.title + ', ' + p.date);
  b.innerHTML = '<span class="plate-in"><img src="' + p.img + '" alt="" loading="lazy" decoding="async" width="600" height="800"><span class="plate-date">' + p.date + '</span>' +
    '<span class="plate-label glass"><b>' + p.title + '</b><span class="meta">' + p.date + '</span></span></span>';
  b.addEventListener('click', () => { if (moved) { moved = false; return; } if (open) return; if (Math.round(focus) !== i) { focus = i; layout(); } openPost(i); });
  b.addEventListener('focus', () => { if (!open && !dragging) { focus = i; layout(); } });
  stack.appendChild(b); plates.push(b);
});
layout(); // photos need no figures: the stack stands in place from the start

function layout() {
  const st = steps(), n = plates.length;
  plates.forEach((el, i) => {
    const k = i - focus; let x, y, z, ry, op;
    if (open) {
      if (i === sel) { x = 0; y = isMob() ? -40 : 0; z = 60; ry = 0; op = isMob() ? 0 : 1; }
      else { x = (i - sel) * 24 - 80; y = 0; z = -520; ry = -20; op = 0; }
    } else {
      x = k * st.x; y = -k * st.y; z = -k * st.z; ry = -30;
      op = k < -0.5 ? Math.max(0, 1 + (k + 0.5) * 2) : (k > 4.2 ? Math.max(0, 1 - (k - 4.2)) : 1);
    }
    el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + ry + 'deg)';
    el.style.opacity = op.toFixed(3);
    el.style.pointerEvents = op < 0.3 ? 'none' : '';
    el.tabIndex = op < 0.3 ? -1 : 0;
    el.classList.toggle('front', !open && Math.round(focus) === i);
  });
  const fi = Math.round(clamp(focus, 0, n - 1));
  pipEls.forEach((el, k) => el.classList.toggle('on', k === fi));
}
function openPost(i) {
  const p = POSTS[i]; open = true; sel = i; stage.classList.add('open');
  document.getElementById('dDate').textContent = p.date;
  document.getElementById('dTitle').textContent = p.title;
  document.getElementById('dText').textContent = p.text;
  const link = document.getElementById('dLink');
  link.hidden = !p.link;
  if (p.link) { link.href = p.link.href; link.textContent = p.link.label; }
  document.getElementById('detailThumb').src = p.img;
  detail.hidden = false;
  requestAnimationFrame(() => detail.classList.add('show'));
  layout();
  setTimeout(() => document.getElementById('dClose').focus({ preventScroll: true }), 50);
}
function closePost() {
  if (!open) return; open = false; stage.classList.remove('open'); detail.classList.remove('show');
  const keep = sel; sel = -1; layout();
  setTimeout(() => { if (!open) detail.hidden = true; }, 450);
  plates[keep].focus({ preventScroll: true });
}
document.getElementById('dClose').addEventListener('click', closePost);
const step = d => { if (open) closePost(); focus = clamp(Math.round(focus) + d, 0, plates.length - 1); layout(); };
document.getElementById('prev').addEventListener('click', () => step(-1));
document.getElementById('next').addEventListener('click', () => step(1));
stage.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
  else if (e.key === 'Escape') closePost();
});
stage.addEventListener('pointerdown', e => { if (open || e.button > 0) return; drag = { x: e.clientX, f: focus }; moved = false; });
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (!dragging && Math.abs(dx) > 6) { dragging = moved = true; stage.classList.add('dragging'); }
  if (dragging) { focus = clamp(drag.f - dx / steps().x, -0.4, plates.length - 0.6); layout(); }
});
window.addEventListener('pointerup', () => {
  if (!drag) return; drag = null;
  if (dragging) { dragging = false; stage.classList.remove('dragging'); focus = Math.round(clamp(focus, 0, plates.length - 1)); layout(); }
});
stage.addEventListener('wheel', e => {
  if (open || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault(); stage.classList.add('dragging');
  focus = clamp(focus + e.deltaX / steps().x / 1.5, -0.3, plates.length - 0.7); layout();
  clearTimeout(snapT); snapT = setTimeout(() => { stage.classList.remove('dragging'); focus = Math.round(clamp(focus, 0, plates.length - 1)); layout(); }, 140);
}, { passive: false });
// The direction cards wear the hero's figures as covers.
let coverShapes = [];
const drawCovers = () => document.querySelectorAll('canvas[data-cover]').forEach(c => { if (coverShapes.length) drawThumb(c, coverShapes[+c.dataset.cover], c.dataset.tone, 0.5); });

/* ---------- start ---------- */
function start() {
  const img = document.querySelector('.bar img');
  const imgs = [img, IMG_HANDS, IMG_PARROT, IMG_STATUE, IMG_SELFIE];
  const go = () => {
    shapes = [hands(N), neural(N), tree(N), bars(N), logo(img, N), ...GUESTS.map(gs => gs.make(N))];
    coverShapes = [hands(3200), neural(3200), tree(3200), bars(3200), logo(img, 3200)];
    ready = true; holdStart = performance.now();
    resize(); layout(); drawCovers();
    const parrot = META.find(m => m.frames), all = [];
    let k = 1; all[0] = shapes[META.indexOf(parrot)];
    const more = () => { all[k] = parrotFrame(k, N); if (++k < 10) setTimeout(more, 60); else parrot.frames = all; };
    setTimeout(more, 1500);
  };
  let left = imgs.length;
  imgs.forEach(im => { if (im.complete && im.naturalWidth) { if (--left === 0) go(); } else im.addEventListener('load', () => { if (--left === 0) go(); }, { once: true }); });
}
let rT = 0;
const refit = () => { clearTimeout(rT); rT = setTimeout(() => { resize(); layout(); if (coverShapes.length) drawCovers(); }, 120); };
window.addEventListener('resize', refit);
// A window moved between a MacBook's Retina screen and an ordinary monitor keeps its size, so no resize
// comes, but the pixel density changes: redraw the canvases for it, or they stay blurry.
const watchDensity = () => matchMedia('(resolution: ' + devicePixelRatio + 'dppx)').addEventListener('change', () => { refit(); watchDensity(); }, { once: true });
watchDensity();
(document.fonts && document.fonts.load ? document.fonts.load('9px "JetBrains Mono Variable"').catch(() => {}) : Promise.resolve()).then(start, start);

/* ---------- the team selection over the page: once a session, until the date on the dialog ---------- */
const pop = document.getElementById('recruitPop');
const popSeen = () => { try { return sessionStorage.getItem('ait-recruit-pop') === '1'; } catch { return false; } };
if (pop && typeof pop.showModal === 'function' && Date.now() < Date.parse(pop.dataset.until) && !popSeen() && !location.hash) {
  pop.querySelector('.pop-x').addEventListener('click', () => pop.close());
  pop.querySelector('[data-close]').addEventListener('click', () => pop.close()); // «Подробнее» still scrolls to #team
  pop.addEventListener('click', e => { // a click on the dimmed page around it
    if (e.target !== pop) return;
    const r = pop.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) pop.close();
  });
  setTimeout(() => {
    if (pop.open) return;
    pop.showModal();
    pop.focus({ preventScroll: true }); // the dialog itself, not the close button with a ring around it
    try { sessionStorage.setItem('ait-recruit-pop', '1'); } catch { /* private mode: it shows again next time */ }
  }, reduce ? 0 : 700);
}

// dev only: lets a test script show any figure or guest
if (import.meta.env.DEV) window.__ait = { goTo, guest: i => { after = 1; goTo(MAIN + i, 600, false); } }
