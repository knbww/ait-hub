// The «Join Our Team» application form on aitclub.org/team.
//
// Five steps drawn from src/lib/recruitment.ts: Personal Info → Role → Role Questions → Availability →
// Review. Answers live in this tab (sessionStorage) until the application is sent or the tab is
// closed: a shared school computer doesn't keep them. Each step is checked before the next; the
// database checks everything again. One application goes once: the button locks while it's on its
// way, and a retry carries the same key, so a lost answer never makes a second application. The
// confirmation appears only after the database has the application.

import {
  APPLICANT_STATUSES, AVAILABILITY_QUESTIONS, CONSENT_VERSION, DEPARTMENTS, DEPARTMENT_QUESTIONS, NIS_CITIES, ROLES, ROUND, STEPS,
  answerText, buildPayload, contactHref, department, emptyForm, gradeOptions, isNis, normalizeLink, role, roleDepartment, schoolOf,
  stepOfField, validateStep,
} from '../src/lib/recruitment'
import type { ApplicationForm, DepartmentId, Errors, Question, RoleId } from '../src/lib/recruitment'
import { drawThumb } from './ascii'
import type { Shape, Tone } from './ascii'

const API = import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/apply` : ''
// The Hub's Turnstile widget serves the form too, once aitclub.org is among its hostnames; a widget
// of its own for the site is possible (VITE_TEAM_TURNSTILE_SITE_KEY) but not needed.
const SITE_KEY = import.meta.env.VITE_TEAM_TURNSTILE_SITE_KEY || import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
const CONTACT = (import.meta.env.VITE_TEAM_CONTACT ?? '').trim()
const STORE = 'ait-team-application'
const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
export const TONE: Record<DepartmentId, Tone> = { education: 'ink', pr: 'red', operations: 'paper', data: 'graphite' }

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id: string) => void
    }
  }
}

// ── Building the page ───────────────────────────────────────────────────────
type Child = Node | string | null | undefined | false | Child[]
type Props = Record<string, unknown>

const add = (el: Element, c: Child) => {
  if (Array.isArray(c)) c.forEach((x) => add(el, x))
  else if (c !== null && c !== undefined && c !== false) el.append(c)
}

/** An element from props and children; text stays text (no HTML is ever parsed from a string). */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') el.className = String(v)
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener)
    else if (k === 'value' || k === 'checked') Reflect.set(el, k, v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  add(el, children)
  return el
}

/** The contact for questions and for withdrawing consent, as a link. */
export function contactNode(): Node {
  const href = contactHref(CONTACT)
  if (!href) return h('span', { class: 'contact-missing' }, CONTACT || 'контакт не указан (VITE_TEAM_CONTACT)')
  return h('a', { href, ...(href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {}) }, CONTACT)
}

const len = (v: string) => [...v].length
const words = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many
}

interface Receipt {
  id: string
  created_at: string
  department: string
  role: string
}

interface Draft {
  form: ApplicationForm
  step: number
  seen: number
  key: string
}

const newKey = () =>
  crypto.randomUUID?.() ??
  '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16))

export interface FormHandle {
  chooseRole: (dept: DepartmentId, role: RoleId, focus?: boolean) => void
  setShapes: (shapes: Partial<Record<DepartmentId, Shape>> & { logo?: Shape; scatter?: Shape }) => void
}

export function mountForm(root: HTMLElement, reduce: boolean): FormHandle {
  let draft: Draft = { form: emptyForm(), step: 0, seen: 0, key: newKey() }
  let restored = false
  try {
    const raw = sessionStorage.getItem(STORE)
    if (raw) {
      const saved = JSON.parse(raw) as Draft
      if (saved && saved.form && typeof saved.step === 'number' && saved.key) {
        draft = { ...saved, form: { ...emptyForm(), ...saved.form } }
        restored = true
      }
    }
  } catch {
    // A private window or blocked storage: the form works, it just won't survive a reload.
  }
  const form = draft.form
  let step = Math.min(4, Math.max(0, draft.step))
  let seen = Math.max(step, draft.seen ?? 0)
  let key = draft.key
  let errors: Errors = {}
  let notice: { kind: 'error' | 'info'; text: string } | null = null
  let sending = false
  let state: 'form' | 'done' | 'closed' = 'form'
  let receipt: Receipt | null = null
  let token: string | null = null
  let widget: string | null = null
  let shapes: Partial<Record<DepartmentId, Shape>> & { logo?: Shape; scatter?: Shape } = {}
  let picked: string | null = null
  let saveT = 0

  const save = () => {
    clearTimeout(saveT)
    saveT = window.setTimeout(() => {
      try {
        sessionStorage.setItem(STORE, JSON.stringify({ form, step, seen, key }))
      } catch {
        // see above
      }
    }, 250)
  }
  const forget = () => {
    clearTimeout(saveT)
    try {
      sessionStorage.removeItem(STORE)
    } catch {
      // see above
    }
  }

  // ── Fields ────────────────────────────────────────────────────────────────
  const fid = (id: string) => `f-${id}`
  const describedBy = (id: string, hint?: string) => [hint ? `${fid(id)}-hint` : '', errors[id] ? `${fid(id)}-err` : ''].filter(Boolean).join(' ') || undefined
  const errorNode = (id: string) => (errors[id] ? h('p', { class: 'f-err', id: `${fid(id)}-err` }, errors[id]) : null)
  const hintNode = (id: string, hint?: string) => (hint ? h('p', { class: 'f-hint', id: `${fid(id)}-hint` }, hint) : null)

  function counter(id: string, value: string, max: number) {
    const el = h('span', { class: 'f-count', 'aria-hidden': 'true' }, `${len(value)} / ${max}`)
    if (len(value) > max) el.classList.add('over')
    el.dataset.for = id
    return el
  }
  const updateCounter = (id: string, value: string, max: number) => {
    const el = root.querySelector<HTMLElement>(`.f-count[data-for="${id}"]`)
    if (!el) return
    el.textContent = `${len(value)} / ${max}`
    el.classList.toggle('over', len(value) > max)
  }

  function textField(o: { id: string; label: string; value: string; onInput: (v: string) => void; hint?: string; type?: string;
    autocomplete?: string; inputmode?: string; max?: number; placeholder?: string; multiline?: boolean; required?: boolean; prefix?: string }) {
    const attrs: Props = {
      id: fid(o.id), name: o.id, class: o.multiline ? 'f-area' : 'f-input', value: o.value, autocomplete: o.autocomplete ?? 'off',
      inputmode: o.inputmode, placeholder: o.placeholder, 'aria-invalid': errors[o.id] ? 'true' : undefined,
      'aria-describedby': describedBy(o.id, o.hint), 'aria-required': o.required ? 'true' : undefined, spellcheck: o.type ? 'false' : undefined,
      oninput: (e: Event) => {
        const v = (e.target as HTMLInputElement).value
        o.onInput(v)
        if (o.max) updateCounter(o.id, v, o.max)
        save()
      },
    }
    const control = o.multiline
      ? h('textarea', { ...attrs, rows: 4 })
      : h('input', { ...attrs, type: o.type ?? 'text', maxlength: o.max ? o.max + 20 : undefined })
    return h('div', { class: `field${errors[o.id] ? ' has-err' : ''}` },
      h('label', { for: fid(o.id), class: 'f-label' }, o.label, o.required ? null : h('span', { class: 'f-opt' }, 'необязательно')),
      hintNode(o.id, o.hint),
      o.prefix ? h('div', { class: 'f-prefix' }, h('span', { 'aria-hidden': 'true' }, o.prefix), control) : control,
      o.multiline && o.max ? counter(o.id, o.value, o.max) : null,
      errorNode(o.id))
  }

  function selectField(o: { id: string; label: string; value: string; options: { id: string; label: string; group?: string }[];
    onChange: (v: string) => void; placeholder: string; hint?: string; required?: boolean }) {
    const groups = new Map<string, HTMLElement[]>()
    const loose: HTMLElement[] = []
    for (const opt of o.options) {
      const el = h('option', { value: opt.id }, opt.label)
      if (opt.id === o.value) el.setAttribute('selected', '')
      if (opt.group) groups.set(opt.group, [...(groups.get(opt.group) ?? []), el])
      else loose.push(el)
    }
    const select = h('select', {
      id: fid(o.id), name: o.id, class: 'f-input', 'aria-invalid': errors[o.id] ? 'true' : undefined, 'aria-describedby': describedBy(o.id, o.hint),
      onchange: (e: Event) => { o.onChange((e.target as HTMLSelectElement).value); save(); render(fid(o.id)) },
    }, h('option', { value: '' }, o.placeholder), loose, [...groups].map(([label, opts]) => h('optgroup', { label }, opts)))
    select.value = o.value
    return h('div', { class: `field${errors[o.id] ? ' has-err' : ''}` },
      h('label', { for: fid(o.id), class: 'f-label' }, o.label, o.required === false ? h('span', { class: 'f-opt' }, 'необязательно') : null),
      hintNode(o.id, o.hint), select, errorNode(o.id))
  }

  /** Radio or checkbox options as chips: native inputs, so the keyboard and screen readers work as usual. */
  function choiceField(o: { id: string; label: string; hint?: string; options: { id: string; label: string }[]; multiple?: boolean;
    value: string | string[]; onChange: (v: string | string[]) => void; rerender?: boolean; required?: boolean; extra?: Node | null; wide?: boolean }) {
    const list = Array.isArray(o.value) ? o.value : [o.value]
    const items = o.options.map((opt, i) => {
      const input = h('input', {
        type: o.multiple ? 'checkbox' : 'radio', name: o.id, value: opt.id, id: `${fid(o.id)}-${i}`, checked: list.includes(opt.id),
        onchange: (e: Event) => {
          const el = e.target as HTMLInputElement
          if (o.multiple) {
            const next = new Set(Array.isArray(o.value) ? o.value : [])
            if (el.checked) next.add(opt.id)
            else next.delete(opt.id)
            o.value = o.options.map((x) => x.id).filter((x) => next.has(x))
          } else o.value = opt.id
          o.onChange(o.value)
          save()
          if (o.rerender) render(el.id)
        },
      })
      return h('label', { class: 'chip-opt', for: `${fid(o.id)}-${i}` }, input, h('span', {}, opt.label))
    })
    return h('fieldset', { class: `field${errors[o.id] ? ' has-err' : ''}`, 'aria-describedby': describedBy(o.id, o.hint), id: fid(o.id) },
      h('legend', { class: 'f-label' }, o.label, o.required === false ? h('span', { class: 'f-opt' }, 'необязательно') : null,
        o.multiple ? h('span', { class: 'f-opt' }, 'можно несколько') : null),
      hintNode(o.id, o.hint),
      h('div', { class: `chips${o.wide ? ' chips-wide' : ''}` }, items),
      o.extra ?? null,
      errorNode(o.id))
  }

  function linksField(q: Question) {
    const list = Array.isArray(form.answers[q.id]) ? [...(form.answers[q.id] as string[])] : []
    if (!list.length) list.push('')
    const rows = list.map((v, i) => h('div', { class: 'link-row' },
      h('input', {
        type: 'url', inputmode: 'url', class: 'f-input', id: i === 0 ? fid(q.id) : `${fid(q.id)}-${i}`, value: v,
        placeholder: i === 0 ? 'https://github.com/username' : 'https://', autocomplete: 'off', spellcheck: 'false',
        'aria-label': `${q.label}, ссылка ${i + 1}`, 'aria-invalid': errors[q.id] ? 'true' : undefined, 'aria-describedby': describedBy(q.id, q.hint),
        oninput: (e: Event) => { list[i] = (e.target as HTMLInputElement).value; form.answers[q.id] = [...list]; save() },
      }),
      list.length > 1 ? h('button', { type: 'button', class: 'link-x', 'aria-label': `Убрать ссылку ${i + 1}`,
        onclick: () => { list.splice(i, 1); form.answers[q.id] = [...list]; save(); render(fid(q.id)) } }, '×') : null))
    return h('div', { class: `field${errors[q.id] ? ' has-err' : ''}` },
      h('label', { class: 'f-label', for: fid(q.id) }, q.label, h('span', { class: 'f-opt' }, 'необязательно')),
      hintNode(q.id, q.hint),
      h('div', { class: 'links' }, rows),
      list.length < 3 ? h('button', { type: 'button', class: 'f-more', onclick: () => {
        form.answers[q.id] = [...list, '']; save(); render(`${fid(q.id)}-${list.length}`)
      } }, '+ ещё ссылка') : null,
      errorNode(q.id))
  }

  function questionField(q: Question) {
    const value = form.answers[q.id]
    if (q.kind === 'links') return linksField(q)
    if (q.kind === 'choice' || q.kind === 'choices') {
      const list = Array.isArray(value) ? value : []
      const other = q.other && list.includes('other')
        ? textField({ id: q.other.id, label: q.other.label, value: String(form.answers[q.other.id] ?? ''), max: q.other.max, required: false,
          onInput: (v) => { form.answers[q.other!.id] = v } })
        : null
      return choiceField({
        id: q.id, label: q.label, hint: q.hint, options: q.options ?? [], multiple: q.kind === 'choices', required: q.required,
        value: q.kind === 'choices' ? list : typeof value === 'string' ? value : '',
        rerender: Boolean(q.other || q.exclusive),
        wide: (q.options ?? []).some((x) => x.label.length > 26),
        extra: other,
        onChange: (v) => {
          let next = v
          // «No experience yet» and a tool don't go together: the last choice wins.
          if (q.exclusive && Array.isArray(v)) {
            const prev = Array.isArray(value) ? value : []
            next = v.includes(q.exclusive) && !prev.includes(q.exclusive) ? [q.exclusive] : v.filter((x) => x !== q.exclusive || v.length === 1)
          }
          form.answers[q.id] = next
        },
      })
    }
    return textField({
      id: q.id, label: q.label, hint: q.hint, value: typeof value === 'string' ? value : '', multiline: q.kind === 'longtext',
      max: q.max, placeholder: q.placeholder, required: q.required, onInput: (v) => { form.answers[q.id] = v },
    })
  }

  // ── Steps ─────────────────────────────────────────────────────────────────
  function personal() {
    const status = form.applicant_status
    const grades = status ? gradeOptions(status) : null
    const nis = isNis(status)
    const schoolLabel = nis ? 'Название школы и город' : status === 'university' ? 'Университет и город' : 'Школа, университет или место работы, город'
    return [
      textField({ id: 'full_name', label: 'Имя и фамилия', value: form.full_name, autocomplete: 'name', max: 120, required: true,
        onInput: (v) => { form.full_name = v } }),
      choiceField({ id: 'applicant_status', label: 'Статус', options: APPLICANT_STATUSES, value: status, rerender: true, required: true,
        onChange: (v) => { form.applicant_status = v as ApplicationForm['applicant_status']; form.grade = '' } }),
      nis ? selectField({ id: 'nis_city', label: 'Школа', value: form.nis_city, placeholder: 'Выбери НИШ',
        options: [...NIS_CITIES.map((c) => ({ id: c, label: `НИШ, ${c}` })), { id: 'other', label: 'Другая НИШ, нет в списке' }],
        onChange: (v) => { form.nis_city = v } }) : null,
      status && (!nis || form.nis_city === 'other')
        ? textField({ id: 'school_other', label: schoolLabel, value: form.school_other, max: 160, required: true, autocomplete: 'organization',
          placeholder: nis ? 'НИШ ХБН, Шымкент' : status === 'university' ? 'Nazarbayev University, Астана' : '',
          onInput: (v) => { form.school_other = v } })
        : null,
      status ? (grades
        ? selectField({ id: 'grade', label: status === 'nis_graduate' ? 'Год выпуска' : status === 'university' ? 'Курс' : 'Класс',
          value: form.grade, options: grades, placeholder: 'Выбери', onChange: (v) => { form.grade = v } })
        : textField({ id: 'grade', label: 'Класс, курс или чем занимаешься', value: form.grade, max: 40, required: true,
          onInput: (v) => { form.grade = v } })) : null,
      textField({ id: 'email', label: 'Email', type: 'email', inputmode: 'email', autocomplete: 'email', value: form.email, max: 254, required: true,
        hint: 'По нему мы свяжемся с тобой.', placeholder: 'name@mail.kz', onInput: (v) => { form.email = v } }),
      textField({ id: 'telegram', label: 'Telegram', value: form.telegram, max: 40, prefix: '@', placeholder: 'username',
        onInput: (v) => { form.telegram = v } }),
    ]
  }

  function roleStep() {
    const dept = department(form.department)
    const cards = DEPARTMENTS.map((d, i) => {
      const input = h('input', {
        type: 'radio', name: 'department', value: d.id, id: `${fid('department')}-${i}`, checked: form.department === d.id,
        onchange: () => {
          form.department = d.id
          if (!d.roles.some((r) => r.id === form.role)) form.role = d.roles.length === 1 ? d.roles[0].id : ''
          if (form.extra_role === form.role) form.extra_role = ''
          save()
          render(`${fid('department')}-${i}`)
        },
      })
      const cover = h('canvas', { class: 'dept-pick-cover', 'data-figure': d.id, 'aria-hidden': 'true' })
      return h('label', { class: 'dept-pick', for: `${fid('department')}-${i}` }, input, cover,
        h('span', { class: 'dept-pick-body' }, h('b', {}, d.title),
          h('span', {}, `${d.roles.length} ${words(d.roles.length, 'роль', 'роли', 'ролей')}`)))
    })
    const roles = dept
      ? choiceField({
        id: 'role', label: 'Основная роль', value: form.role, rerender: true, required: true, wide: true,
        hint: dept.id === 'education'
          ? 'Lead Mentor и Co-Mentor — два полноценных преподавателя направления, они сами договариваются, кто какие занятия ведёт. Подходят обе роли — выбери вторую дополнительной ниже.'
          : undefined,
        options: dept.roles.map((r) => ({ id: r.id, label: `${r.title} — ${r.duty}` })),
        onChange: (v) => { form.role = v as RoleId; if (form.extra_role === v) form.extra_role = '' },
      })
      : null
    const extra = form.role
      ? selectField({
        id: 'extra_role', label: 'Дополнительная интересующая роль', required: false, value: form.extra_role, placeholder: 'Нет',
        hint: 'Одна, из любого департамента: если основная не сложится, рассмотрим эту.',
        options: ROLES.filter((r) => r.id !== form.role).map((r) => ({ id: r.id, label: r.title, group: roleDepartment(r.id)?.title })),
        onChange: (v) => { form.extra_role = v as RoleId | '' },
      })
      : null
    return [
      h('fieldset', { class: `field${errors.department ? ' has-err' : ''}`, id: fid('department') },
        h('legend', { class: 'f-label' }, 'Департамент'),
        h('div', { class: 'dept-picks' }, cards), errorNode('department')),
      roles, extra,
    ]
  }

  function questionsStep() {
    const dept = department(form.department)
    if (!dept) return [h('p', {}, 'Сначала выбери департамент и роль.')]
    const r = role(form.role)
    return [
      h('p', { class: 'f-chosen' }, h('span', {}, 'Роль'), h('b', {}, `${r?.title ?? ''}`), h('span', {}, dept.title),
        h('button', { type: 'button', class: 'f-link', onclick: () => go(1) }, 'Изменить')),
      DEPARTMENT_QUESTIONS[dept.id].map(questionField),
    ]
  }

  const availabilityStep = () => AVAILABILITY_QUESTIONS.map(questionField)

  function reviewStep() {
    const dept = department(form.department)
    const row = (label: string, value: string) => (value ? [h('dt', {}, label), h('dd', {}, value)] : [])
    const section = (title: string, to: number, ...rows: Node[][]) =>
      h('section', { class: 'rv' }, h('div', { class: 'rv-head' }, h('h4', {}, title),
        h('button', { type: 'button', class: 'f-link', onclick: () => go(to), 'aria-label': `Изменить: ${title}` }, 'Изменить')),
      h('dl', {}, rows.flat()))
    const shown = (q: Question) => {
      const v = form.answers[q.id]
      return q.kind === 'links' && Array.isArray(v) ? v.map((x) => normalizeLink(x)).filter(Boolean) : v
    }
    const answers = (qs: Question[]) => qs.map((q) => row(q.label, answerText(q, shown(q), form.answers)))
    const status = APPLICANT_STATUSES.find((s) => s.id === form.applicant_status)?.label ?? ''
    const consentLabel = h('span', {}, 'Даю согласие на обработку заявки и контактных данных на ',
      h('a', { href: '/privacy', target: '_blank', rel: 'noopener' }, 'условиях обработки данных'),
      '. Отозвать согласие и удалить заявку можно в любой момент: ', contactNode(), '.')
    const check = (id: 'volunteer_ack' | 'consent' | 'guardian_consent', label: Node | string) =>
      h('div', { class: `field check${errors[id] ? ' has-err' : ''}` },
        h('label', { class: 'check-row', for: fid(id) },
          h('input', { type: 'checkbox', id: fid(id), checked: form[id], 'aria-invalid': errors[id] ? 'true' : undefined,
            'aria-describedby': errors[id] ? `${fid(id)}-err` : undefined,
            onchange: (e: Event) => { form[id] = (e.target as HTMLInputElement).checked; save() } }),
          h('span', {}, label)),
        errorNode(id))
    return [
      h('p', { class: 'f-lead' }, 'Проверь ответы. Если всё верно, отметь согласия внизу и отправь заявку.'),
      section('О тебе', 0, row('Имя и фамилия', form.full_name.trim()), row('Статус', status), row('Школа или университет', schoolOf(form)),
        row('Класс / курс', form.grade), row('Email', form.email.trim().toLowerCase()), row('Telegram', form.telegram.trim() ? `@${form.telegram.trim().replace(/^@+/, '')}` : '')),
      section('Роль', 1, row('Департамент', dept?.title ?? ''), row('Основная роль', role(form.role)?.title ?? ''),
        row('Дополнительная роль', role(form.extra_role)?.title ?? 'нет')),
      dept ? section('Вопросы роли', 2, ...answers(DEPARTMENT_QUESTIONS[dept.id])) : null,
      section('Время и мотивация', 3, ...answers(AVAILABILITY_QUESTIONS)),
      h('div', { class: 'consents' },
        check('volunteer_ack', 'Понимаю, что участие добровольное и неоплачиваемое'),
        check('consent', consentLabel),
        // Shown and hidden in place: drawing the step again would restart the Cloudflare check.
        choiceField({ id: 'is_adult', label: 'Тебе уже есть 18 лет?', value: form.is_adult === null ? '' : form.is_adult ? 'yes' : 'no',
          options: [{ id: 'yes', label: 'Да' }, { id: 'no', label: 'Нет' }], required: true,
          onChange: (v) => {
            form.is_adult = v === 'yes'
            if (form.is_adult) form.guardian_consent = false
            const g = root.querySelector<HTMLElement>('#guardian')
            if (g) g.hidden = form.is_adult
            const box = root.querySelector<HTMLInputElement>(`#${fid('guardian_consent')}`)
            if (box && form.is_adult) box.checked = false
          } }),
        h('div', { id: 'guardian', hidden: form.is_adult !== false },
          check('guardian_consent', 'Мой родитель или законный представитель знает о заявке и согласен с обработкой моих данных'))),
      h('div', { class: 'captcha', id: 'captcha' }),
    ]
  }

  // ── Moving between steps ──────────────────────────────────────────────────
  function firstInvalid(upTo: number): number {
    for (let s = 0; s < upTo; s++) if (Object.keys(validateStep(s, form)).length) return s
    return -1
  }

  function go(target: number, focusHeading = true) {
    if (sending) return
    if (target > step) {
      const bad = firstInvalid(target)
      if (bad >= 0 && bad < target) {
        if (bad !== step) step = bad
        errors = validateStep(step, form)
        notice = null
        render()
        focusFirstError()
        return
      }
    }
    errors = {}
    notice = null
    step = target
    seen = Math.max(seen, step)
    save()
    render()
    if (focusHeading) {
      root.querySelector<HTMLElement>('.step-title')?.focus({ preventScroll: true })
      const top = root.getBoundingClientRect().top
      if (top < 0 || top > innerHeight * 0.6) root.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
    }
  }

  function focusFirstError() {
    const id = Object.keys(errors)[0]
    if (!id) return
    const el = root.querySelector<HTMLElement>(`#${fid(id)}`)
    const target = el?.matches('fieldset') ? el.querySelector<HTMLElement>('input') : el
    target?.focus({ preventScroll: true })
    ;(el ?? root).scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }

  // ── Turnstile ─────────────────────────────────────────────────────────────
  let scriptLoading: Promise<void> | null = null
  const loadTurnstile = () => {
    if (window.turnstile) return Promise.resolve()
    scriptLoading ??= new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = TURNSTILE
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { scriptLoading = null; reject(new Error('captcha_load_failed')) }
      document.head.appendChild(s)
    })
    return scriptLoading
  }
  function mountCaptcha() {
    const box = root.querySelector<HTMLElement>('#captcha')
    if (!box) return
    if (!SITE_KEY) {
      box.append(h('p', { class: 'f-hint' }, 'Защита от ботов не настроена (VITE_TEAM_TURNSTILE_SITE_KEY): отправка не сработает.'))
      return
    }
    loadTurnstile().then(() => {
      if (!window.turnstile || !box.isConnected) return
      widget = window.turnstile.render(box, {
        sitekey: SITE_KEY, action: 'apply', language: 'ru', theme: 'light', size: 'flexible', 'refresh-expired': 'auto',
        callback: (t: string) => { token = t; root.querySelector('#captcha-wait')?.remove() },
        'expired-callback': () => { token = null },
        'error-callback': () => { token = null },
      })
    }).catch(() => {
      box.append(h('p', { class: 'f-err' }, 'Не загрузилась проверка Cloudflare. Проверь соединение и обнови страницу: ответы сохранятся.'))
    })
  }
  function dropCaptcha() {
    if (widget && window.turnstile) window.turnstile.remove(widget)
    widget = null
    token = null
  }

  // ── Sending ───────────────────────────────────────────────────────────────
  async function send() {
    if (sending) return
    const bad = firstInvalid(5)
    if (bad >= 0) {
      step = bad
      errors = validateStep(step, form)
      notice = { kind: 'error', text: 'Не всё заполнено: проверь отмеченные поля.' }
      render()
      focusFirstError()
      return
    }
    if (!API) {
      notice = { kind: 'error', text: 'Форма не подключена к серверу (нет VITE_SUPABASE_URL).' }
      render()
      return
    }
    if (!token) {
      notice = { kind: 'info', text: 'Подожди пару секунд: Cloudflare проверяет, что ты не робот. Если появилось окошко, отметь его.' }
      renderNotice()
      return
    }
    sending = true
    notice = null
    renderNav()
    renderNotice()
    let res: Response | null = null
    let body: { ok?: boolean; error?: string; field?: string; id?: string; created_at?: string; department?: string; role?: string } = {}
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, key, form: buildPayload(form) }),
        signal: AbortSignal.timeout(25_000),
      })
      body = await res.json()
    } catch {
      // No answer, or no readable one: the application may or may not be there. The same key and
      // token go again next time, and the database answers with what it has.
      sending = false
      notice = { kind: 'error', text: 'Нет связи с сервером. Ответы сохранены в этой вкладке: попробуй отправить ещё раз.' }
      renderNav()
      renderNotice()
      return
    }
    sending = false
    if (res.ok && body.ok && body.id) {
      receipt = { id: body.id, created_at: body.created_at ?? new Date().toISOString(), department: body.department ?? form.department, role: body.role ?? form.role }
      state = 'done'
      dropCaptcha()
      forget()
      render()
      root.querySelector<HTMLElement>('.f-done h3')?.focus({ preventScroll: true })
      root.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
      return
    }
    // A definite answer: nothing was saved, the next try is a new request with a fresh check.
    key = newKey()
    save()
    if (body.error === 'invalid_form') {
      const field = body.field ?? 'form'
      const target = stepOfField(field, form.department)
      step = target
      errors = { ...validateStep(target, form) }
      const shown = field === 'school' ? (isNis(form.applicant_status) && form.nis_city !== 'other' ? 'nis_city' : 'school_other') : field
      if (!Object.keys(errors).length) errors[shown] = 'Проверь это поле: сервер его не принял'
      notice = { kind: 'error', text: 'Сервер не принял одно из полей. Мы показали, какое.' }
      render()
      focusFirstError()
      return
    }
    notice = {
      kind: 'error',
      text: body.error === 'closed' ? 'Приём заявок уже закрыт.'
        : body.error === 'slow_down' ? 'Слишком много заявок с этого адреса или этой почты. Попробуй через час.'
          : body.error === 'captcha' ? 'Проверка Cloudflare не прошла. Отметь её ещё раз и отправь заявку.'
            : 'Сервер сейчас не отвечает как надо. Ответы сохранены: попробуй через несколько минут.',
    }
    if (body.error === 'closed') state = 'closed'
    render()
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  const stepsBar = () => h('ol', { class: 'stepper' }, STEPS.map((s, i) => {
    const done = i < step || (i <= seen && i !== step && !Object.keys(validateStep(i, form)).length)
    return h('li', { class: `${i === step ? 'is-now' : ''}${done ? ' is-done' : ''}`, 'aria-current': i === step ? 'step' : undefined },
      i <= seen && i !== step && !sending
        ? h('button', { type: 'button', onclick: () => go(i), 'aria-label': `Шаг ${i + 1}: ${s.title}` }, s.title)
        : h('span', { class: 'st-static' }, s.title))
  }))

  const navBox = h('div', { class: 'f-nav' })
  const noticeBox = h('div', { class: 'f-notice', role: 'status', 'aria-live': 'polite' })

  function renderNav() {
    navBox.replaceChildren(
      step > 0 ? h('button', { type: 'button', class: 'btn btn-ghost', disabled: sending, onclick: () => go(step - 1) }, 'Назад') : h('span'),
      h('span', { class: 'f-progress' }, `Шаг ${step + 1} из ${STEPS.length}`),
      step < 4
        ? h('button', { type: 'submit', class: 'btn btn-dark' }, 'Далее')
        : h('button', { type: 'submit', class: 'btn btn-accent', disabled: sending, 'aria-busy': sending ? 'true' : undefined },
          sending ? 'Отправляем…' : 'Submit Application'),
    )
  }
  function renderNotice() {
    noticeBox.replaceChildren()
    noticeBox.className = `f-notice${notice ? ` ${notice.kind}` : ''}`
    if (notice) noticeBox.append(h('p', {}, notice.text))
    const missing = Object.keys(errors)
    if (!notice && missing.length > 1) noticeBox.append(h('p', {}, `Проверь ${missing.length} ${words(missing.length, 'поле', 'поля', 'полей')}, отмеченных красным.`))
  }

  const content = () => [personal, roleStep, questionsStep, availabilityStep, reviewStep][step]()

  function drawCovers() {
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-figure]').forEach((c) => {
      const id = c.dataset.figure as DepartmentId
      const sh = shapes[id]
      if (sh) drawThumb(c, sh, TONE[id], 0.5, 0, 0.92)
    })
  }

  function doneView() {
    const r = receipt!
    const dept = department(r.department)
    const when = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' }).format(new Date(r.created_at))
    const copy = h('button', { type: 'button', class: 'f-link', onclick: async () => {
      try { await navigator.clipboard.writeText(r.id); copy.textContent = 'Скопировано' } catch { copy.textContent = 'Выдели и скопируй' }
    } }, 'Скопировать')
    const art = h('canvas', { class: 'done-art', 'aria-hidden': 'true' })
    return h('div', { class: 'f-done' },
      art,
      h('h3', { tabindex: '-1' }, 'Application Submitted!'),
      h('p', { class: 'done-lead' }, 'Спасибо за заявку в AIT Club.'),
      h('p', {}, 'Мы рассмотрим её и свяжемся с тобой по указанному email или Telegram.'),
      h('div', { class: 'done-next' }, h('b', {}, 'Следующий этап'),
        h('span', {}, `${ROUND.interviews} — онлайн-собеседования и небольшие практические задания для отдельных ролей.`)),
      h('dl', { class: 'done-meta' },
        h('dt', {}, 'Номер заявки'), h('dd', {}, h('b', {}, r.id), ' ', copy),
        h('dt', {}, 'Роль'), h('dd', {}, [role(r.role)?.title, dept?.title].filter(Boolean).join(', ')),
        h('dt', {}, 'Отправлена'), h('dd', {}, when)),
      h('p', { class: 'f-hint' }, 'Сохрани номер: он пригодится, если захочешь что-то уточнить или отозвать заявку. Вопросы: ', contactNode(), '.'),
      h('a', { class: 'btn btn-ghost', href: '/' }, 'На главную AIT Club'))
  }

  function closedView() {
    return h('div', { class: 'f-done closed' },
      h('h3', { tabindex: '-1' }, 'Приём заявок закрыт'),
      h('p', {}, `Заявки принимались ${ROUND.applications}. Если есть вопрос о наборе, напиши: `, contactNode(), '.'))
  }

  function playArt() {
    const art = root.querySelector<HTMLCanvasElement>('.done-art')
    if (!art || !shapes.logo) return
    const from = shapes.scatter ?? shapes.logo, to = shapes.logo, t0 = performance.now()
    const frame = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - t0) / 1600)
      drawThumb(art, from, 'paper', 0.2 * (1 - p), 0, 1.05, to, p)
      if (p < 1 && art.isConnected) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  function render(focusId?: string) {
    if (widget) dropCaptcha()
    if (state === 'done' && receipt) {
      root.replaceChildren(doneView())
      playArt()
      return
    }
    if (state === 'closed') {
      root.replaceChildren(closedView())
      return
    }
    const s = STEPS[step]
    const restoredNote = restored && step === 0 && !picked
      ? h('p', { class: 'f-restored' }, 'Мы вернули ответы из этой вкладки. ',
        h('button', { type: 'button', class: 'f-link', onclick: () => reset() }, 'Начать заново'))
      : null
    const pickedNote = picked ? h('p', { class: 'f-restored' }, picked) : null
    renderNav()
    renderNotice()
    const body = h('form', { class: 'f-step', novalidate: true, onsubmit: (e: Event) => { e.preventDefault(); if (step < 4) go(step + 1); else void send() } },
      h('div', { class: 'f-head' },
        h('h3', { class: 'step-title', tabindex: '-1' }, s.title, h('span', {}, s.label))),
      restoredNote, pickedNote,
      h('div', { class: 'f-fields' }, content()),
      noticeBox, navBox)
    root.replaceChildren(
      h('div', { class: 'f-top' }, stepsBar(), h('div', { class: 'f-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${((step + 1) / STEPS.length) * 100}%` }))),
      body)
    drawCovers()
    if (step === 4) mountCaptcha()
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true })
  }

  function reset() {
    forget()
    Object.assign(form, emptyForm())
    key = newKey()
    step = 0
    seen = 0
    restored = false
    picked = null
    errors = {}
    notice = null
    render()
    root.querySelector<HTMLElement>('.step-title')?.focus({ preventScroll: true })
  }

  // Whether the form takes applications now: the database decides, the page asks once.
  if (API) {
    fetch(API, { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { open?: boolean } | null) => { if (s && s.open === false && state === 'form') { state = 'closed'; render() } })
      .catch(() => {})
  }

  render()
  return {
    chooseRole(dept, roleId, focus = true) {
      if (state !== 'form') return
      form.department = dept
      form.role = roleId
      if (form.extra_role === roleId) form.extra_role = ''
      picked = `Выбрана роль ${role(roleId)?.title}, ${department(dept)?.title}. Изменить её можно на шаге 2.`
      save()
      if (step === 1 || step === 2) step = 1
      render()
      if (focus) root.querySelector<HTMLElement>('.step-title')?.focus({ preventScroll: true })
    },
    setShapes(next) {
      shapes = next
      drawCovers()
      if (state === 'done') playArt()
    },
  }
}

export { CONSENT_VERSION }
