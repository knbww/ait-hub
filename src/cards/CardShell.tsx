import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'

interface CardShellProps {
  icon: LucideIcon
  title: string
  /** Optional "open the section" link in the header. */
  to?: string
  linkLabel?: string
  children: ReactNode
}

export function CardShell({ icon: Icon, title, to, linkLabel, children }: CardShellProps) {
  return (
    <GlassCard>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-5 h-5 shrink-0 text-[#750014]" />
          <h2 className="text-lg font-light truncate">{title}</h2>
        </div>
        {to && linkLabel && (
          <Link to={to} className="text-xs text-gray-600 hover:text-gray-900 whitespace-nowrap py-2 -my-2">
            {linkLabel} →
          </Link>
        )}
      </div>
      {children}
    </GlassCard>
  )
}
