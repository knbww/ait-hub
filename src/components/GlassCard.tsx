import type { ReactNode } from 'react'

interface GlassCardProps {
  /** Extra classes appended after the shared frosted-panel base (e.g. shadow variants). */
  className?: string
  children: ReactNode
}

/** The shared frosted-glass panel used across dashboard cards. */
export function GlassCard({ className = '', children }: GlassCardProps) {
  return (
    <div
      className={`backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-6 ${className}`}
    >
      {children}
    </div>
  )
}
