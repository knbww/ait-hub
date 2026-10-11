import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

const format = (n: number) => Math.round(n).toLocaleString('ru-RU')

/** A number that runs up to its value when it first appears, and from the old value to the new
 * one when it changes. */
export function CountUp({ value, className = '' }: { value: number; className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = format(value)
      shown.current = value
      return
    }
    const controls = animate(shown.current, value, {
      duration: 0.9,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => {
        shown.current = v
        el.textContent = format(v)
      },
    })
    return () => controls.stop()
  }, [value, reduce])

  return <span ref={ref} className={`tabular-nums ${className}`} aria-label={format(value)}>{reduce ? format(value) : '0'}</span>
}
