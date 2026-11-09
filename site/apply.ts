// aitclub.org/apply: the team application form on a page of its own (team-form.ts). A role chosen on
// aitclub.org/team comes in the address (?role=…): it is chosen once, then the address forgets it,
// so a reload doesn't undo a change made in the form.

import '@fontsource-variable/jetbrains-mono'
import './club.css'
import './team.css'
import { book, chart, gears, megaphone, picture, scatter } from './ascii'
import { mountForm } from './team-form'
import { roleDepartment } from '../src/lib/recruitment'
import type { RoleId } from '../src/lib/recruitment'

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const form = mountForm(document.getElementById('formRoot')!, reduce)

const params = new URLSearchParams(location.search)
const wanted = params.get('role')
const dept = roleDepartment(wanted)
if (wanted && dept) form.chooseRole(dept.id, wanted as RoleId, false)
if (params.has('role')) history.replaceState(null, '', location.pathname + location.hash)

// Small figures for the department cards of step 2 and for the confirmation.
const logo = document.querySelector<HTMLImageElement>('.bar img')!
const fonts = document.fonts?.load ? document.fonts.load('9px "JetBrains Mono Variable"').catch(() => undefined) : Promise.resolve()
const loaded = logo.complete && logo.naturalWidth ? Promise.resolve() : new Promise<void>((resolve) => {
  logo.addEventListener('load', () => resolve(), { once: true })
  logo.addEventListener('error', () => resolve(), { once: true })
})
Promise.all([fonts, loaded]).then(() => {
  const n = 3200
  const shapes = { logo: picture(logo, 2.1, n), scatter: scatter(n), education: book(n), pr: megaphone(n), operations: gears(n), data: chart(n) }
  form.setShapes(shapes)
  let rT = 0
  window.addEventListener('resize', () => { clearTimeout(rT); rT = window.setTimeout(() => form.setShapes(shapes), 150) })
})
