// The basement of every page of aitclub.org: the developers' floor under the official site.
// Gosper's glider guns as the background, gliders where you click, and the club's pixel cat that
// follows the cursor. Always dark. Needs #basement, #life, #lifeStat and #cat; fills #build.

/* global __BUILD__ */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const base = document.getElementById('basement'), lc = document.getElementById('life'), lx = lc.getContext('2d');
const stat = document.getElementById('lifeStat'), catEl = document.getElementById('cat');
const GUN = [[24, 0], [22, 1], [24, 1], [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2], [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3], [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4], [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5], [10, 6], [16, 6], [24, 6], [11, 7], [15, 7], [12, 8], [13, 8]];
const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
let LW = 0, LH = 0, LC = 0, LR = 0, CELL = 6, grid = null, trail = null, gen = 0, lifeOn = false, lifeRaf = 0, lastStep = 0;
function lifeReset() {
  const k = Math.min(2, devicePixelRatio || 1);
  LW = base.clientWidth; LH = base.clientHeight;
  lc.width = Math.round(LW * k); lc.height = Math.round(LH * k); lx.setTransform(k, 0, 0, k, 0, 0);
  CELL = LW < 600 ? 5 : 6; LC = Math.floor(LW / CELL); LR = Math.floor(LH / CELL);
  grid = new Uint8Array(LC * LR); trail = new Float32Array(LC * LR); gen = 0;
  // Guns along the top edge, spaced so that one gun's gliders leave the floor before reaching the next gun.
  const gap = LR + 44;
  for (let gx = 2; gx + 36 < LC; gx += gap) GUN.forEach(([c, r]) => { if (r + 2 < LR) grid[(r + 2) * LC + gx + c] = 1; });
  drawLife();
}
function stepLife() {
  const nx = new Uint8Array(grid.length);
  for (let r = 0; r < LR; r++) for (let c = 0; c < LC; c++) {
    let s = 0;
    for (let dr = -1; dr <= 1; dr++) { const rr = r + dr; if (rr < 0 || rr >= LR) continue; for (let dc = -1; dc <= 1; dc++) { const cc = c + dc; if ((!dr && !dc) || cc < 0 || cc >= LC) continue; s += grid[rr * LC + cc]; } }
    const i = r * LC + c, alive = grid[i];
    nx[i] = (alive && (s === 2 || s === 3)) || (!alive && s === 3) ? 1 : 0;
    if (alive && !nx[i]) trail[i] = 1; else trail[i] = Math.max(0, trail[i] - 0.18);
  }
  grid = nx; gen++;
}
function drawLife() {
  lx.clearRect(0, 0, LW, LH);
  let live = 0;
  for (let i = 0; i < grid.length; i++) {
    const x = (i % LC) * CELL, y = ((i / LC) | 0) * CELL;
    if (grid[i]) { live++; lx.fillStyle = '#56514c'; lx.fillRect(x, y, CELL - 1, CELL - 1); }
    else if (trail[i] > 0) { lx.fillStyle = 'rgba(86,81,76,' + (trail[i] * 0.4).toFixed(2) + ')'; lx.fillRect(x, y, CELL - 1, CELL - 1); }
  }
  stat.innerHTML = 'Поколение <b>' + gen + '</b>, живых клеток <b>' + live + '</b>';
}
base.addEventListener('click', e => {
  if (e.target.closest('a, button')) return;
  const r = base.getBoundingClientRect(), c0 = ((e.clientX - r.left) * (LW / r.width) / CELL) | 0, r0 = ((e.clientY - r.top) * (LH / r.height) / CELL) | 0;
  GLIDER.forEach(([c, rr]) => { const cc = c0 + c - 1, r2 = r0 + rr - 1; if (cc >= 0 && r2 >= 0 && cc < LC && r2 < LR) grid[r2 * LC + cc] = 1; });
  drawLife();
});

// The basement cat: the club's pixel cat. It lies sleepy-eyed, wakes up when the cursor comes,
// runs over with a little hop and looks where the cursor is. It blinks now and then.
const CAT_ROWS = [
  '               #       #  ',
  '              ###     ### ',
  '             ##o#    ##o# ',
  '            ##oo##  ##oo# ',
  '           ##oo########o# ',
  '         ################ ',
  '        ################# ',
  '       ################## ',
  '       ################## ',
  '       ###################',
  ' ##### ###################',
  '##############ooo####ooo##',
  '##########################',
  '###   ####################',
  '         ################ ',
  '           #############  ',
];
const catCx = catEl.getContext('2d'), PIX = 4, CAT_W = 26 * PIX, CAT_H = 17 * PIX;
catEl.width = CAT_W * 2; catEl.height = CAT_H * 2; catEl.style.width = CAT_W + 'px'; catEl.style.height = CAT_H + 'px';
let bx = -1, catX = 40, catFace = 1, catHop = 0, nextBlink = 2500;
function catDraw(moving, now) {
  const g = catCx; g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, CAT_W, CAT_H);
  if (catFace < 0) { g.translate(CAT_W, 0); g.scale(-1, 1); }
  const near = bx > -1 && Math.abs(bx - (catX + CAT_W / 2)) < 260;
  const look = bx > -1 ? clamp(Math.round((bx - (catX + CAT_W / 2)) / 120) * catFace, -1, 1) : 0;
  const blink = now > nextBlink && now < nextBlink + 140;
  if (now > nextBlink + 140) nextBlink = now + 2500 + Math.random() * 3500;
  const hop = moving ? Math.abs(Math.sin(catHop)) * 3 : 0;
  CAT_ROWS.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === ' ') return;
    const eye = r === 11 && ch === 'o';
    if (eye) return;
    g.fillStyle = ch === '#' ? '#d9d5ce' : '#8f8a83';
    g.fillRect(c * PIX, r * PIX + PIX - hop, PIX, PIX);
  }));
  // eyes: sleepy slits at rest, open and looking when the cursor is near
  if (!blink) {
    g.fillStyle = '#0e0d0c';
    [14, 21].forEach(c0 => {
      const y0 = 11 * PIX + PIX - hop;
      if (near || moving) {
        // open: a round dark eye, two blocks tall, with a light glint on the side the cat is looking
        g.fillStyle = '#0e0d0c'; g.fillRect(c0 * PIX, y0 - PIX, PIX * 3, PIX * 2); g.fillRect((c0 + 0.5) * PIX, y0 - PIX * 1.5, PIX * 2, PIX * 3);
        g.fillStyle = '#d9d5ce'; g.fillRect((c0 + 1 + look) * PIX + 1, y0 - PIX + 1, PIX - 2, PIX - 2);
      } else { g.fillStyle = '#0e0d0c'; g.fillRect(c0 * PIX, y0 + PIX * 0.25, PIX * 3, PIX * 0.6); }
    });
  }
  catEl.style.transform = 'translateX(' + catX.toFixed(1) + 'px)';
}
function lifeLoop(now) {
  if (!lifeOn) { lifeRaf = 0; return; }
  lifeRaf = requestAnimationFrame(lifeLoop);
  if (now - lastStep > 90) { lastStep = now; stepLife(); drawLife(); }
  const target = bx > -1 ? clamp(bx - CAT_W / 2, 8, LW - CAT_W - 8) : catX;
  const dist = target - catX, moving = Math.abs(dist) > 6;
  if (moving) { catX += Math.sign(dist) * Math.min(Math.abs(dist), 3.2); catFace = Math.sign(dist); catHop += 0.35; }
  catDraw(moving, now);
}
base.addEventListener('pointermove', e => { const r = base.getBoundingClientRect(); bx = (e.clientX - r.left) * (r.width ? LW / r.width : 1); });
base.addEventListener('pointerleave', () => { bx = -1; });
new IntersectionObserver(es => {
  lifeOn = es[0].isIntersecting && !reduce;
  if (lifeOn && !lifeRaf) lifeRaf = requestAnimationFrame(lifeLoop);
}).observe(base);
catDraw(false, 0);

lifeReset();
let resizeT = 0;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(lifeReset, 120); });
// The text sets the floor's height: once the fonts are in, the floor is measured again.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(lifeReset, () => {});

const buildEl = document.getElementById('build');
if (buildEl) buildEl.textContent = __BUILD__;
