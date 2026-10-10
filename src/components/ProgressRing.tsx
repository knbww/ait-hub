import { motion } from 'framer-motion'

/** Circular progress (0…1) with the percentage in the middle; fills in on first show. */
export function ProgressRing({ value, size = 96, label }: { value: number; size?: number; label?: string }) {
  const stroke = Math.max(6, Math.round(size / 12))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img"
      aria-label={label ?? `${Math.round(clamped * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke}
          className="text-gray-900/10" />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 0.9, ease: 'easeOut' }} className="text-[#750014]" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-light" style={{ fontSize: size / 4.2 }}>
        {Math.round(clamped * 100)}%
      </span>
    </div>
  )
}
