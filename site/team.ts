// aitclub.org/team, the team recruitment: the hero's figures and the department covers that come
// alive under the cursor. The form itself lives on aitclub.org/apply (apply.ts).

import '@fontsource-variable/jetbrains-mono'
import './club.css'
import './team.css'
import { book, chart, drawThumb, gears, megaphone, picture, scatter } from './ascii'
import type { Shape } from './ascii'
import { startHero } from './team-hero'
import { TONE } from './team-form'
import type { DepartmentId } from '../src/lib/recruitment'

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const N = innerWidth < 760 ? 10000 : 24000

const logo = document.querySelector<HTMLImageElement>('.bar img')!
const fonts = document.fonts?.load ? document.fonts.load('9px "JetBrains Mono Variable"').catch(() => undefined) : Promise.resolve()
const loaded = logo.complete && logo.naturalWidth ? Promise.resolve() : new Promise<void>((resolve) => {
  logo.addEventListener('load', () => resolve(), { once: true })
  logo.addEventListener('error', () => resolve(), { once: true })
})

type Figures = Record<DepartmentId, Shape> & { logo: Shape; scatter: Shape }
const make = (n: number): Figures => ({
  logo: picture(logo, 2.1, n), scatter: scatter(n), education: book(n), pr: megaphone(n), operations: gears(n), data: chart(n),
})

let small: Figures | null = null
const covers = [...document.querySelectorAll<HTMLCanvasElement>('canvas.dept-cover')]
const drawCover = (c: HTMLCanvasElement, t = 0, rot = 0.5) => {
  const id = c.dataset.figure as DepartmentId
  if (small) drawThumb(c, small[id], TONE[id], rot, t, 1.05)
}

// Under the cursor a cover turns a little, and the gears go round.
for (const c of covers) {
  const card = c.closest('article')
  if (!card || reduce) continue
  let raf = 0, t0 = 0
  const frame = (now: number) => {
    const t = (now - t0) / 1000
    drawCover(c, t, 0.5 + Math.sin(t * 1.6) * 0.25)
    raf = requestAnimationFrame(frame)
  }
  card.addEventListener('pointerenter', () => { if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(frame) } })
  card.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); raf = 0; drawCover(c) })
}

Promise.all([fonts, loaded]).then(() => {
  const big = make(N)
  startHero({
    hero: document.getElementById('hero')!,
    field: document.getElementById('field') as HTMLCanvasElement,
    grid: document.getElementById('grid') as HTMLCanvasElement,
    start: big.scatter,
    reduce,
    figures: [
      { shape: big.logo, name: 'AIT Club', dir: 'Межшкольная команда, которая строит клуб', note: ['Build AIT:', 'знак клуба собирается из отдельных символов'], rot: 0.22, src: 'build ait with us ' },
      { shape: big.education, name: 'Education', dir: 'Lead Mentor и Co-Mentor трёх направлений', note: ['Красным', 'закладка: тема, которую ведёшь ты'], rot: 0.45, src: 'lead mentor co-mentor практикум теория ' },
      { shape: big.pr, name: 'PR & Creative', dir: 'SMM, дизайн, видео, тексты и сообщество', note: ['Красным', 'то, что слышат о клубе'], rot: 0.55, src: 'reels figma canva контент-план telegram ' },
      { shape: big.operations, name: 'Operations', dir: 'Процессы, мероприятия, люди и партнёры', note: ['Красным', 'оси, на которых всё вращается'], rot: 0.35, src: 'AIT Week дедлайн спикер расписание ' },
      { shape: big.data, name: 'Data & Analytics', dir: 'Цифры набора, посещаемости и AIT Week', note: ['Красным', 'доля, на которую стоит посмотреть'], rot: 0.5, src: 'SELECT count(*) FROM registrations; ' },
    ],
  })
  small = make(3200)
  covers.forEach((c) => drawCover(c))
  let rT = 0
  window.addEventListener('resize', () => { clearTimeout(rT); rT = window.setTimeout(() => covers.forEach((c) => drawCover(c)), 150) })
})
