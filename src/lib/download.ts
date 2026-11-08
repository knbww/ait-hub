// Client-side file downloads: CSV for the backup sheets (opens in Google Sheets and Excel),
// JSON for a member's data request.

type Cell = string | number | boolean | null | undefined

/** A spreadsheet runs a cell starting with one of these as a formula, and names and notes come
 * from members: a leading apostrophe keeps them text. A Telegram handle is left as it is. */
const FORMULA_START = /^\s*[=+\-@]/
const HANDLE = /^@[A-Za-z0-9_]+$/

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'boolean' ? (value ? 'да' : 'нет') : String(value)
  if (typeof value === 'string' && FORMULA_START.test(text) && !HANDLE.test(text)) text = `'${text}`
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

function save(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** UTF-8 with a BOM so Excel shows Cyrillic correctly. */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  save(filename, new Blob(['﻿', toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }))
}

export function downloadJson(filename: string, data: unknown) {
  save(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
}

export function stampedName(base: string, ext: string): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${base}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${ext}`
}
