import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cardVariants } from '../lib/animations'

interface GlassCardProps {
  /** Extra classes appended after the shared frosted-panel base. */
  className?: string
  children: ReactNode
}

/** The shared frosted-glass panel used across pages and dashboard cards. Inside a page it rises
 * into place after the cards before it (the page's variants run the sequence). */
export function GlassCard({ className = '', children }: GlassCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      className={`backdrop-blur-[40px] bg-white/25 border-2 border-white/80 rounded-3xl p-4 sm:p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] ${className}`}
    >
      {children}
    </motion.div>
  )
}
