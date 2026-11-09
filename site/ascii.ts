// ASCII figures for aitclub.org/team, made the way the home page's hero makes its own (club.js):
// a cloud of points in roughly [-1, 1]³ is turned, projected, counted per character cell and drawn
// with a density ramp in JetBrains Mono; red marks the one thing that matters in each figure.
//
// Figures of the four departments: an open book with a bookmark (Education), a megaphone (PR &
// Creative), two gears that turn (Operations), a chart with one slice pulled out (Data & Analytics),
// and the club's sign assembling from scattered symbols.

export const MONO = '"JetBrains Mono Variable", ui-monospace, Menlo, Consolas, monospace'
const RAMP = ' .:-=+*#%@'
export const glyph = (v: number, k = 1) => RAMP[Math.min(9, 1 + ((Math.log2(1 + v / k) * 2.3) | 0))]
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const TAU = Math.PI * 2
const rnd = Math.random

type Vec = [number, number, number]

/** A part of a figure: its share of the points, where one lands, red or not, which gear it turns with. */
interface Prim {
  w: number
  g: () => Vec
  a?: boolean
  group?: number
}

/** Group g (from 1) turns around (cx, cy) at `speed` radians a second. */
export interface Spin {
  cx: number
  cy: number
  speed: number
}

export interface Shape {
  P: Float32Array
  A: Uint8Array
  G: Uint8Array
  n: number
  spin?: Spin[]
  box?: { cx: number; cy: number; hw: number; hh: number }
}

// Points sorted left to right, so a morph runs across the figure like a wave.
function build(prims: Prim[], n: number, spin?: Spin[]): Shape {
  const total = prims.reduce((s, p) => s + p.w, 0)
  const out: [number, number, number, number, number][] = []
  for (const p of prims) {
    const c = Math.max(1, Math.round((p.w / total) * n))
    for (let j = 0; j < c; j++) out.push([...p.g(), p.a ? 1 : 0, p.group ?? 0])
  }
  while (out.length > n) out.splice((rnd() * out.length) | 0, 1)
  while (out.length < n) out.push(out[(rnd() * out.length) | 0].slice() as (typeof out)[number])
  out.sort((a, b) => a[0] + a[1] * 0.3 - (b[0] + b[1] * 0.3))
  const P = new Float32Array(n * 3), A = new Uint8Array(n), G = new Uint8Array(n)
  out.forEach((q, i) => { P[i * 3] = q[0]; P[i * 3 + 1] = q[1]; P[i * 3 + 2] = q[2]; A[i] = q[3]; G[i] = q[4] })
  return { P, A, G, n, spin }
}

const seg = (a: Vec, b: Vec, jitter = 0): Vec => {
  const t = rnd(), j = () => (rnd() - 0.5) * jitter
  return [a[0] + (b[0] - a[0]) * t + j(), a[1] + (b[1] - a[1]) * t + j(), a[2] + (b[2] - a[2]) * t + j()]
}
/** A point of a flat ring (or a sector of it) at depth z. Uniform over the area. */
const ring = (cx: number, cy: number, r0: number, r1: number, z: number, a0 = 0, a1 = TAU): Vec => {
  const r = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0)), a = a0 + rnd() * (a1 - a0)
  return [cx + r * Math.cos(a), cy + r * Math.sin(a), z]
}

/** Scattered symbols: the pieces the club's sign is built from. */
export function scatter(n: number): Shape {
  return build([{ w: 1, g: () => {
    const a = rnd() * TAU, r = Math.pow(rnd(), 0.6)
    return [Math.cos(a) * r * 1.25, Math.sin(a) * r * 0.75, (rnd() - 0.5) * 0.8]
  } }], n)
}

/** Education: an open book, lines of text on its pages, a red bookmark. */
export function book(n: number): Shape {
  const z = (u: number) => -0.3 * Math.sin(Math.PI * Math.min(1, u * 1.1)) - 0.02
  const page = (s: number, u: number, v: number): Vec => [s * (0.04 + 0.92 * u), 0.62 * v, z(u)]
  const prims: Prim[] = []
  for (const s of [-1, 1]) {
    prims.push({ w: 1.1, g: () => page(s, rnd(), rnd() * 2 - 1) })
    for (let k = 0; k < 7; k++) {
      const v = 0.78 - k * 0.24, end = k === 6 ? 0.5 : 0.86
      prims.push({ w: 0.15, g: () => page(s, 0.12 + rnd() * (end - 0.12), v + (rnd() - 0.5) * 0.035) })
    }
    // The edge of the pages under the open ones, and the cover's edge.
    for (let l = 0; l < 3; l++) {
      prims.push({ w: 0.1, g: () => { const p = page(s, 1, rnd() * 2 - 1); return [p[0] - s * l * 0.012, p[1] - l * 0.012, p[2] + l * 0.035] } })
      prims.push({ w: 0.08, g: () => { const p = page(s, rnd(), -1); return [p[0], p[1] - l * 0.014, p[2] + l * 0.035] } })
    }
    prims.push({ w: 0.12, g: () => page(s, rnd(), 1) })
  }
  prims.push({ w: 0.14, g: () => seg([0, -0.62, 0.02], [0, 0.62, 0.02], 0.01) })
  // The bookmark: along the right page from the top, then hanging below the book with a notch.
  prims.push({ w: 0.42, a: true, g: () => {
    const u = 0.07 + rnd() * 0.07, v = 1 - rnd() * 2.75
    if (v >= -1) return page(1, u, v)
    const y = 0.62 * v, x = 0.04 + 0.92 * u, notch = Math.abs(u - 0.105) * 2.2
    return [x, Math.max(y, -1.21 + notch), z(u) - 0.02]
  } })
  return build(prims, n)
}

/** PR & Creative: a megaphone and three red waves of sound. */
export function megaphone(n: number): Shape {
  const prims: Prim[] = [
    { w: 1.7, g: () => {
      const t = Math.sqrt(rnd()), a = rnd() * TAU, r = 0.13 + 0.42 * Math.pow(t, 1.3)
      return [-0.5 + 0.85 * t, r * Math.cos(a), r * Math.sin(a)]
    } },
    { w: 0.36, g: () => { const a = rnd() * TAU, r = 0.55 + (rnd() - 0.5) * 0.03; return [0.35 + (rnd() - 0.5) * 0.02, r * Math.cos(a), r * Math.sin(a)] } },
    { w: 0.26, g: () => { const a = rnd() * TAU; return [-0.78 + rnd() * 0.28, 0.11 * Math.cos(a), 0.11 * Math.sin(a)] } },
    { w: 0.08, g: () => { const r = Math.sqrt(rnd()) * 0.11, a = rnd() * TAU; return [-0.78, r * Math.cos(a), r * Math.sin(a)] } },
    // The grip.
    { w: 0.3, g: () => { const p = seg([-0.33, -0.13, 0], [-0.43, -0.62, 0]); return [p[0] + (rnd() - 0.5) * 0.09, p[1], p[2] + (rnd() - 0.5) * 0.09] } },
  ]
  for (const R of [0.72, 0.9, 1.08]) {
    prims.push({ w: 0.2 + R * 0.1, a: true, g: () => {
      const a = (rnd() - 0.5) * 1.1, r = R + (rnd() - 0.5) * 0.035
      return [0.3 + r * Math.cos(a), r * Math.sin(a) * 0.95, (rnd() - 0.5) * 0.05]
    } })
  }
  return build(prims, n)
}

/** Operations: two meshing gears that turn; their axles are red. */
export function gears(n: number): Shape {
  const prims: Prim[] = []
  const gear = (cx: number, cy: number, root: number, tip: number, teeth: number, hub: number, phase: number, group: number, holes: number) => {
    const th = 0.06, hm = (hub + root) / 2, hr = (root - hub) * 0.3
    const centres = Array.from({ length: holes }, (_, k) => {
      const a = phase + Math.PI / teeth + (TAU * k) / holes
      return [cx + hm * Math.cos(a), cy + hm * Math.sin(a)]
    })
    // The face of a gear has round holes in it: that is what makes it read as a gear.
    const face = (zz: number): Vec => {
      for (let t = 0; t < 40; t++) {
        const p = ring(cx, cy, hub, root, zz)
        if (centres.every(([x, y]) => Math.hypot(p[0] - x, p[1] - y) > hr)) return p
      }
      return ring(cx, cy, hub, hub * 1.05, zz)
    }
    for (const zz of [-th, th]) {
      prims.push({ w: (root * root - hub * hub) * 1.7, group, g: () => face(zz) })
      prims.push({ w: hub * hub * 2.6, a: true, group, g: () => ring(cx, cy, hub * 0.45, hub, zz) })
    }
    for (const [x, y] of centres) {
      prims.push({ w: hr * 0.9, group, g: () => { const a = rnd() * TAU; return [x + hr * Math.cos(a), y + hr * Math.sin(a), (rnd() - 0.5) * 2 * th] } })
    }
    prims.push({ w: root * 0.5, group, g: () => { const a = rnd() * TAU; return [cx + root * Math.cos(a), cy + root * Math.sin(a), (rnd() - 0.5) * 2 * th] } })
    const half = Math.PI / teeth * 0.52
    for (let k = 0; k < teeth; k++) {
      const c = phase + (TAU * k) / teeth
      prims.push({ w: (tip - root) * half * 2.6, group, g: () => {
        // A tooth narrows a little towards its tip.
        const t = rnd(), r = root + t * (tip - root), a = c + (rnd() * 2 - 1) * half * (1 - 0.3 * t)
        const zz = rnd() < 0.8 ? (rnd() < 0.5 ? -th : th) : (rnd() - 0.5) * 2 * th
        return [cx + r * Math.cos(a), cy + r * Math.sin(a), zz]
      } })
    }
  }
  const alpha = (-36 * Math.PI) / 180, ta = 12, tb = 8, pa = 0.52, pb = (pa * tb) / ta
  const ax = -0.4, ay = 0.16, bx = ax + (pa + pb) * Math.cos(alpha), by = ay + (pa + pb) * Math.sin(alpha)
  // A gap of the big gear faces the small one, whose tooth sits in it.
  gear(ax, ay, pa - 0.06, pa + 0.07, ta, 0.13, alpha - Math.PI / ta, 1, 5)
  gear(bx, by, pb - 0.06, pb + 0.07, tb, 0.1, alpha + Math.PI, 2, 4)
  const wa = 0.45
  return build(prims, n, [{ cx: ax, cy: ay, speed: wa }, { cx: bx, cy: by, speed: (-wa * ta) / tb }])
}

/** Data & Analytics: a ring chart with its red slice pulled out, and four bars. */
export function chart(n: number): Shape {
  const prims: Prim[] = []
  const cx = -0.34, cy = 0.06, r0 = 0.3, r1 = 0.6, th = 0.07
  const slices: [number, number, boolean][] = [[0, 0.28, true], [0.28, 0.55, false], [0.55, 0.8, false], [0.8, 1, false]]
  for (const [s0, s1, red] of slices) {
    const a0 = s0 * TAU + 0.035, a1 = s1 * TAU - 0.035, mid = (a0 + a1) / 2, out = red ? 0.09 : 0
    const ox = cx + out * Math.cos(mid), oy = cy + out * Math.sin(mid), area = (a1 - a0) * (r1 * r1 - r0 * r0)
    for (const zz of [-th, th]) prims.push({ w: area * (red ? 1.6 : 1), a: red, g: () => ring(ox, oy, r0, r1, zz, a0, a1) })
    prims.push({ w: (a1 - a0) * 0.12, a: red, g: () => { const a = a0 + rnd() * (a1 - a0); return [ox + r1 * Math.cos(a), oy + r1 * Math.sin(a), (rnd() - 0.5) * 2 * th] } })
  }
  const base = -0.5
  ;[0.34, 0.58, 0.44, 0.78].forEach((h, i) => {
    const x = 0.5 + i * 0.17, w = 0.1, d = 0.12
    prims.push({ w: h * 1.1 + 0.15, g: () => {
      const f = (rnd() * 5) | 0, u = rnd(), v = rnd()
      if (f === 0) return [x - w / 2 + u * w, base + v * h, -d / 2]
      if (f === 1) return [x - w / 2 + u * w, base + v * h, d / 2]
      if (f === 2) return [x - w / 2, base + v * h, -d / 2 + u * d]
      if (f === 3) return [x + w / 2, base + v * h, -d / 2 + u * d]
      return [x - w / 2 + u * w, base + h, -d / 2 + v * d]
    } })
  })
  prims.push({ w: 0.2, g: () => seg([0.4, base - 0.02, 0], [1.06, base - 0.02, 0], 0.012) })
  return build(prims, n)
}

/** A picture (the club's sign): darker pixels get more points. */
export function picture(img: HTMLImageElement, width: number, n: number): Shape {
  const w = 480, h = Math.max(1, Math.round((480 * img.naturalHeight) / Math.max(1, img.naturalWidth)))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.drawImage(img, 0, 0, w, h)
  const d = x.getImageData(0, 0, w, h).data, px: [number, number, number][] = []
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const k = (yy * w + xx) * 4
    if (d[k + 3] < 60) continue
    const v = (1 - (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255) * (d[k + 3] / 255)
    if (v > 0.08) px.push([xx, yy, v])
  }
  if (!px.length) return scatter(n)
  const s = width / w
  const pick = (): Vec => {
    for (let t = 0; t < 40; t++) {
      const p = px[(rnd() * px.length) | 0]
      if (rnd() < 0.02 + p[2] * 0.98) return [(p[0] + rnd()) * s - width / 2, -((p[1] + rnd()) * s - (h * s) / 2), (rnd() - 0.5) * 0.12]
    }
    const p = px[0]
    return [p[0] * s - width / 2, -(p[1] * s - (h * s) / 2), 0]
  }
  return build([{ w: 1, g: pick }], n)
}

/** Positions of a shape at a moment: the gears turn, the rest stays. */
export function turned(sh: Shape, i: number, t: number, out: Vec): Vec {
  let x = sh.P[i * 3], y = sh.P[i * 3 + 1]
  const g = sh.G[i]
  if (g && sh.spin) {
    const s = sh.spin[g - 1], a = t * s.speed, c = Math.cos(a), sn = Math.sin(a), dx = x - s.cx, dy = y - s.cy
    x = s.cx + dx * c - dy * sn
    y = s.cy + dx * sn + dy * c
  }
  out[0] = x; out[1] = y; out[2] = sh.P[i * 3 + 2]
  return out
}

/** A figure's extent, ignoring the stray 1% of points on each side. */
export function boxOf(sh: Shape) {
  if (sh.box) return sh.box
  const q = (arr: number[], t: number) => arr[Math.min(arr.length - 1, Math.max(0, (arr.length * t) | 0))]
  const xs: number[] = [], ys: number[] = []
  for (let i = 0; i < sh.n; i += 4) { xs.push(sh.P[i * 3]); ys.push(sh.P[i * 3 + 1]) }
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b)
  const x0 = q(xs, 0.01), x1 = q(xs, 0.99), y0 = q(ys, 0.01), y1 = q(ys, 0.99)
  return (sh.box = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: Math.max(0.2, (x1 - x0) / 2), hh: Math.max(0.2, (y1 - y0) / 2) })
}

// ── Small pictures: covers of the department cards ──────────────────────────
export type Tone = 'ink' | 'red' | 'paper' | 'graphite'
export const TONES: Record<Tone, { bg: string; fg: string; acc: string }> = {
  ink: { bg: '#1b1a18', fg: '#f3f2ee', acc: '#e0465c' },
  red: { bg: '#750014', fg: '#f3d9dd', acc: '#ffffff' },
  paper: { bg: '#e9e6df', fg: '#141414', acc: '#750014' },
  graphite: { bg: '#40464c', fg: '#eef0f1', acc: '#ff9a8a' },
}

/** Draws a shape on a canvas in a tone, turned by `rot`, at `t` seconds of the gears. With `to`, the
 * points are on their way to another shape, `p` of it (0…1), the left ones first. */
export function drawThumb(canvas: HTMLCanvasElement, sh: Shape, tone: Tone, rot: number, t = 0, scale = 1, to?: Shape, p = 0) {
  const r = canvas.getBoundingClientRect(), w = Math.max(10, r.width), h = Math.max(10, r.height), k = Math.min(2, devicePixelRatio || 1)
  if (canvas.width !== Math.round(w * k) || canvas.height !== Math.round(h * k)) { canvas.width = Math.round(w * k); canvas.height = Math.round(h * k) }
  const c = canvas.getContext('2d')!, T = TONES[tone]
  c.setTransform(k, 0, 0, k, 0, 0)
  c.fillStyle = T.bg
  c.fillRect(0, 0, w, h)
  const fs = w < 240 ? 5 : 6
  c.font = `${fs}px ${MONO}`
  c.textBaseline = 'top'
  const cw = c.measureText('M').width || fs * 0.6, ch = Math.round(fs * 1.2), C = Math.ceil(w / cw), R = Math.ceil(h / ch)
  const d = new Float32Array(C * R), a = new Uint8Array(C * R), b0 = boxOf(sh), b1 = to ? boxOf(to) : b0, m = to ? ease(p) : 0
  const b = { cx: b0.cx + (b1.cx - b0.cx) * m, cy: b0.cy + (b1.cy - b0.cy) * m, hw: b0.hw + (b1.hw - b0.hw) * m, hh: b0.hh + (b1.hh - b0.hh) * m }
  const s = Math.min((w * 0.4) / b.hw, (h * 0.36) / b.hh) * scale, cr = Math.cos(rot), sr = Math.sin(rot), q: Vec = [0, 0, 0], q2: Vec = [0, 0, 0]
  for (let i = 0; i < sh.n; i++) {
    turned(sh, i, t, q)
    let lt = 0
    if (to && i < to.n) {
      turned(to, i, t, q2)
      lt = ease(clamp((p - (i / sh.n) * 0.3) / 0.7, 0, 1))
      for (let k = 0; k < 3; k++) q[k] += (q2[k] - q[k]) * lt
    }
    const x = q[0] - b.cx, y = q[1] - b.cy, z = q[2]
    const X = x * cr + z * sr, Z = -x * sr + z * cr, sc = 3.2 / (3.2 + Z)
    const px = w / 2 + X * s * sc, py = h / 2 - y * s * sc
    if (px < 0 || py < 0) continue
    const col = (px / cw) | 0, row = (py / ch) | 0
    if (col >= C || row >= R) continue
    d[row * C + col] += 1
    if (lt > 0.5 && to ? to.A[i] : sh.A[i]) a[row * C + col] = 1
  }
  c.fillStyle = T.fg
  c.globalAlpha = 0.16
  for (let row = 2; row < R; row += 3) for (let col = (row % 2) * 3; col < C; col += 6) if (!d[row * C + col]) c.fillText('.', col * cw, row * ch)
  c.globalAlpha = 1
  for (let i = 0; i < d.length; i++) if (d[i] && !a[i]) c.fillText(glyph(d[i]), (i % C) * cw, ((i / C) | 0) * ch)
  c.fillStyle = T.acc
  for (let i = 0; i < d.length; i++) if (a[i]) c.fillText(glyph(d[i] + 3), (i % C) * cw, ((i / C) | 0) * ch)
}
