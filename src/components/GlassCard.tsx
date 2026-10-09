import type { ReactNode } from 'react'

interface GlassCardProps {
  /** Extra classes appended after the shared frosted-panel base. */
  className?: string
  children: ReactNode
}

/** The shared frosted-glass panel used across pages and dashboard cards. */
export function GlassCard({ className = '', children }: GlassCardProps) {
  return (
    <div
      className={`backdrop-blur-[40px] bg-white/25 border-2 border-white/80 rounded-3xl p-4 sm:p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] ${className}`}
    >
      {children}
    </div>
  )
}
