// The hero of aitclub.org/team: the club's sign assembles from scattered symbols, then the figures
// of the four departments follow one another, as the home page's hero does with its directions.
// Under the cursor a figure shows what it is made of, written in its own words.

import { MONO, boxOf, clamp, ease, glyph, turned } from './ascii'
import type { Shape } from './ascii'

export interface Figure {
  shape: Shape
  name: string
  dir: string
  /** The red part of the caption, then the rest. */
  note: [string, string]
  rot: number
  src: string
}

interface Options {
  hero: HTMLElement
  field: HTMLCanvasElement
  grid: HTMLCanvasElement
  figures: Figure[]
  start: Shape
  reduce: boolean
}

const HOLD = 5200, MORPH = 2000, FIRST = 2600

export function startHero({ hero, field, grid, figures, start, reduce }: Options) {
  const ctx = field.getContext('2d')!, gtx = grid.getContext('2d')!
  const N = figures[0].shape.n, DK = N / 9000
  const nameEl = document.getElementById('nowName')!, dirEl = document.getElementById('nowDir')!, noteEl = document.getElementById('nowNote')!
  const textBox = document.getElementById('nowText')!, dotsBox = document.getElementById('dots')!
  const ink = () => getComputedStyle(document.documentElement)
  let colors = { ink: '#141414', dim: 'rgb(20 20 20 / 0.13)', red: '#750014' }
  const readColors = () => {
    const s = ink()
    colors = { ink: s.getPropertyValue('--ascii').trim() || colors.ink, dim: s.getPropertyValue('--ascii-dim').trim() || colors.dim, red: s.getPropertyValue('--ascii-red').trim() || colors.red }
  }
  readColors()

  let W = 0, H = 0, dpr = 1, fs = 7, cw = 4.2, chh = 8, cols = 0, rows = 0, CX = 0, CY = 0, R = 90, SMAX = 200
  let dens = new Float32Array(0), acc = new Uint8Array(0), mark = new Uint8Array(0)
  let area = { l: 0, r: 0, t: 0, b: 0 }
  let cur = 0, nxt = 0, from: Shape | null = reduce ? null : start, phase: 'hold' | 'morph' = reduce ? 'hold' : 'morph'
  let holdStart = performance.now(), tStart = performance.now() + 450, morphDur = FIRST, running = false, raf = 0
  let mx = -1e5, my = -1e5

  const drawGrid = () => {
    gtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    gtx.clearRect(0, 0, W, H)
    gtx.font = `${fs}px ${MONO}`
    gtx.textBaseline = 'top'
    gtx.fillStyle = colors.dim
    for (let r = 2; r < rows; r += 3) for (let c = (r % 2) * 3; c < cols; c += 6) gtx.fillText('.', c * cw, r * chh)
  }

  const resize = () => {
    W = hero.clientWidth; H = hero.clientHeight; dpr = Math.min(2, devicePixelRatio || 1)
    for (const el of [field, grid]) { el.width = Math.round(W * dpr); el.height = Math.round(H * dpr) }
    const mob = W < 760
    fs = mob ? 6 : 7
    ctx.font = `${fs}px ${MONO}`
    cw = Math.max(3.5, ctx.measureText('M').width); chh = Math.round(fs * 1.15)
    cols = Math.ceil(W / cw); rows = Math.ceil(H / chh)
    dens = new Float32Array(cols * rows); acc = new Uint8Array(cols * rows); mark = new Uint8Array(cols * rows)
    // The figures live in the free part of the hero: right of the text and above the caption card on a
    // computer, above the heading on a phone.
    const hr = hero.getBoundingClientRect(), k0 = hr.width ? W / hr.width : 1
    const rel = (el: Element | null) => {
      const r = el?.getBoundingClientRect() ?? hr
      return { l: (r.left - hr.left) * k0, r: (r.right - hr.left) * k0, t: (r.top - hr.top) * k0, b: (r.bottom - hr.top) * k0 }
    }
    const copy = rel(hero.querySelector('.hero-copy')), card = rel(hero.querySelector('.now')), h1 = rel(hero.querySelector('h1'))
    if (mob) { area = { l: 16, r: W - 16, t: 78, b: Math.max(150, h1.t - 18) }; R = 64; SMAX = W * 0.36 }
    else { area = { l: Math.min(copy.r + 56, W * 0.62), r: W - Math.max(32, W * 0.035), t: 104, b: Math.max(H * 0.5, card.t - 28) }; R = 92; SMAX = Math.min(H * 0.34, 320) }
    CX = (area.l + area.r) / 2; CY = (area.t + area.b) / 2
    drawGrid()
    kick()
  }
  const fit = (b: { hw: number; hh: number }) => Math.min(SMAX, (area.r - area.l) / 2 / (b.hw * 1.12), (area.b - area.t) / 2 / (b.hh * 1.12))

  const dots = figures.map((f, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('aria-label', `Показать: ${f.name}`)
    b.addEventListener('click', () => goTo(i))
    dotsBox.appendChild(b)
    return b
  })

  function caption(i: number) {
    textBox.classList.add('out')
    setTimeout(() => {
      const f = figures[i]
      nameEl.textContent = f.name
      dirEl.textContent = f.dir
      const em = document.createElement('i')
      em.textContent = f.note[0]
      noteEl.replaceChildren(em, document.createTextNode(` ${f.note[1]}`))
      textBox.classList.remove('out')
    }, reduce ? 0 : 320)
    dots.forEach((d, k) => { d.classList.toggle('on', k === i); d.setAttribute('aria-pressed', String(k === i)) })
  }

  function goTo(i: number, dur = MORPH) {
    if (i === cur && phase === 'hold') return
    if (phase === 'morph') return
    caption(i)
    if (reduce) { cur = nxt = i; draw(performance.now()); return }
    from = null; morphDur = dur; nxt = i; phase = 'morph'; tStart = performance.now()
  }

  const p3: [number, number, number] = [0, 0, 0], q3: [number, number, number] = [0, 0, 0]
  function draw(now: number) {
    if (!dens.length) return
    let p = 0
    if (phase === 'hold' && !reduce && now - holdStart > HOLD) goTo((cur + 1) % figures.length)
    if (phase === 'morph') {
      p = clamp((now - tStart) / morphDur, 0, 1)
      if (p >= 1) { cur = nxt; from = null; phase = 'hold'; holdStart = now; p = 0 }
    }
    const A = from ?? figures[cur].shape, B = figures[phase === 'morph' ? nxt : cur].shape
    const t = now / 1000, ep = ease(p), m = phase === 'morph' ? ep : 0
    const rotA = from ? 0.25 : figures[cur].rot, rotB = figures[phase === 'morph' ? nxt : cur].rot
    const amp = rotA + (rotB - rotA) * m
    const ry = reduce ? 0.35 * amp : Math.sin(now * 0.00035) * amp, rx = 0.1
    const cyr = Math.cos(ry), syr = Math.sin(ry), cxr = Math.cos(rx), sxr = Math.sin(rx), f = 3.2
    const bA = boxOf(A), bB = boxOf(B)
    const ox = bA.cx + (bB.cx - bA.cx) * m, oy = bA.cy + (bB.cy - bA.cy) * m
    const Sd = fit(bA) + (fit(bB) - fit(bA)) * m
    dens.fill(0); acc.fill(0)
    for (let i = 0; i < N; i++) {
      turned(A, i, t, p3)
      let x = p3[0], y = p3[1], z = p3[2], lt = 0
      if (phase === 'morph') {
        turned(B, i, t, q3)
        lt = ease(clamp((p - (i / N) * 0.3) / 0.7, 0, 1))
        x += (q3[0] - x) * lt; y += (q3[1] - y) * lt; z += (q3[2] - z) * lt
        const bump = Math.sin(lt * Math.PI)
        y += Math.sin(i * 12.9898) * 0.1 * bump; z += Math.cos(i * 78.233) * 0.25 * bump
      }
      x -= ox; y -= oy
      const X = x * cyr + z * syr
      let Z = -x * syr + z * cyr
      const Y = y * cxr - Z * sxr
      Z = y * sxr + Z * cxr
      const sc = f / (f + Z), px = CX + X * Sd * sc, py = CY - Y * Sd * sc
      if (px < 0 || py < 0) continue
      const c = (px / cw) | 0, r = (py / chh) | 0
      if (c >= cols || r >= rows) continue
      const ci = r * cols + c
      dens[ci] += 0.6 + 0.4 * sc
      if (lt > 0.5 ? B.A[i] : A.A[i]) acc[ci] = 1
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.font = `${fs}px ${MONO}`
    ctx.textBaseline = 'top'
    const src = from && p < 0.5 ? 'build ait with us ' : figures[phase === 'morph' && p > 0.5 ? nxt : cur].src
    const xray: number[] = []
    mark.fill(0)
    if (!reduce && mx > -1e4) {
      const c0 = Math.max(0, ((mx - R) / cw) | 0), c1 = Math.min(cols - 1, ((mx + R) / cw) | 0)
      const r0 = Math.max(0, ((my - R) / chh) | 0), r1 = Math.min(rows - 1, ((my + R) / chh) | 0)
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const ci = r * cols + c
        if (!dens[ci]) continue
        const dx = c * cw - mx, dy = r * chh - my
        if (dx * dx + dy * dy < R * R) { mark[ci] = 1; xray.push(ci) }
      }
    }
    ctx.fillStyle = colors.ink
    for (let ci = 0; ci < dens.length; ci++) {
      const v = dens[ci]
      if (!v || acc[ci] || mark[ci]) continue
      ctx.fillText(glyph(v, DK), (ci % cols) * cw, ((ci / cols) | 0) * chh)
    }
    ctx.fillStyle = colors.red
    for (let ci = 0; ci < dens.length; ci++) {
      if (!acc[ci] || mark[ci]) continue
      ctx.fillText(glyph(dens[ci] + 3 * DK, DK), (ci % cols) * cw, ((ci / cols) | 0) * chh)
    }
    for (const ci of xray) {
      const c = ci % cols, r = (ci / cols) | 0
      ctx.fillText(src[(c + r * 7) % src.length], c * cw, r * chh)
    }
  }

  function loop(now: number) {
    if (!running) { raf = 0; return }
    draw(now)
    raf = requestAnimationFrame(loop)
  }
  function kick() {
    if (reduce || !running) { requestAnimationFrame((t) => draw(t)); return }
    if (!raf) raf = requestAnimationFrame(loop)
  }
  new IntersectionObserver((es) => { running = es[0].isIntersecting && !document.hidden; kick() }).observe(hero)
  document.addEventListener('visibilitychange', () => { running = !document.hidden && hero.getBoundingClientRect().bottom > 0; kick() })
  hero.addEventListener('pointermove', (e) => {
    const r = field.getBoundingClientRect(), k = r.width ? W / r.width : 1
    mx = (e.clientX - r.left) * k; my = (e.clientY - r.top) * (r.height ? H / r.height : 1)
    if (reduce) kick()
  })
  hero.addEventListener('pointerleave', () => { mx = my = -1e5; if (reduce) kick() })

  let rT = 0
  const refit = () => { clearTimeout(rT); rT = window.setTimeout(resize, 120) }
  window.addEventListener('resize', refit)
  // Moved between a Retina screen and an ordinary one, a window keeps its size but not its density.
  const watchDensity = () => matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { refit(); watchDensity() }, { once: true })
  watchDensity()

  caption(0)
  resize()
}
