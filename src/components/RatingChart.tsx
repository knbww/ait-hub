import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../context/i18nContext'
import { formatDate } from '../lib/club'

export interface RatingPoint {
  id: string
  date: string
  title: string
  place: number | null
  delta: number
  /** Rating after this event. */
  total: number
}

// One series in a lighter step of the club's maroon: passes the palette validator's lightness
// band and 3:1 contrast on the light surface (the brand #750014 is too dark for a mark).
const LINE = '#a3203a'
const HEIGHT = 200
const PAD = { top: 18, right: 52, bottom: 28, left: 40 }

/** Clean tick values (1-2-5 steps) covering [min, max]. */
function niceTicks(min: number, max: number, count = 4): number[] {
  const span = Math.max(1, max - min)
  const raw = span / (count - 1)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v))
  if (ticks.length < 2) ticks.push(start + step)
  return ticks
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** Rating over the rated events, with a tooltip per event (hover or keyboard focus). */
export function RatingChart({ points, label }: { points: RatingPoint[]; label: string }) {
  const { t } = useI18n()
  const [box, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const totals = points.map((p) => p.total)
  const ticks = niceTicks(Math.min(0, ...totals), Math.max(1, ...totals))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const innerW = Math.max(0, width - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1))
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.total)}`).join(' ')
  const area = points.length > 1 ? `${line} L${x(points.length - 1)},${y(yMin)} L${x(0)},${y(yMin)} Z` : ''
  const last = points[points.length - 1]
  const tip = active !== null ? points[active] : null
  const tipLeft = active !== null ? Math.min(Math.max(x(active), 90), Math.max(90, width - 90)) : 0
  // Near the top the tooltip would cover the title: show it under the point instead.
  const tipBelow = tip ? y(tip.total) < 90 : false
  const labelled = new Set([0, points.length - 1, Math.floor((points.length - 1) / 2)])

  return (
    <div ref={box} className="relative w-full" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={label} className="overflow-visible">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="rgb(17 24 39 / 0.08)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-gray-600 text-[11px]">{v}</text>
            </g>
          ))}
          {area && <path d={area} fill={LINE} fillOpacity={0.1} />}
          <motion.path d={line} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          {points.map((p, i) => (
            <g key={p.id}>
              <circle cx={x(i)} cy={y(p.total)} r={active === i ? 6 : 4.5} fill={LINE} stroke="#fff" strokeWidth={2} />
              <circle cx={x(i)} cy={y(p.total)} r={14} fill="transparent" tabIndex={0} className="cursor-pointer outline-none"
                aria-label={`${p.title}: ${p.delta > 0 ? '+' : ''}${p.delta}, ${t('member.chart.after', { n: p.total })}`}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
              {labelled.has(i) && points.length > 1 && (
                <text x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-gray-600 text-[11px]">
                  {formatDate(p.date)}
                </text>
              )}
            </g>
          ))}
          {last && (
            <text x={x(points.length - 1) + 10} y={y(last.total)} dy="0.32em" className="fill-gray-900 text-xs font-medium">
              {last.total}
            </text>
          )}
        </svg>
      )}
      {tip && (
        <div className={`pointer-events-none absolute z-10 -translate-x-1/2 ${tipBelow ? '' : '-translate-y-full'} rounded-xl bg-white/95 shadow-lg border border-white px-3 py-2 text-xs text-gray-800 w-44`}
          style={{ left: tipLeft, top: tipBelow ? y(tip.total) + 14 : y(tip.total) - 10 }}>
          <p className="font-medium leading-snug">{tip.title}</p>
          <p className="text-gray-600">{formatDate(tip.date)}{tip.place ? ` · ${t('member.place', { n: tip.place })}` : ''}</p>
          <p className="mt-1">{tip.delta > 0 ? '+' : ''}{tip.delta} → {tip.total}</p>
        </div>
      )}
    </div>
  )
}
