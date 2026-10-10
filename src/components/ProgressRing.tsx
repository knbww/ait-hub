/** Circular progress (0…1) with the percentage in the middle. */
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped)}
          className="text-[#750014] transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-light" style={{ fontSize: size / 4.2 }}>
        {Math.round(clamped * 100)}%
      </span>
    </div>
  )
}
