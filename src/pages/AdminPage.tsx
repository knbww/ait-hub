import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { GlassCard } from '../components/GlassCard'
import { pageVariants } from '../lib/animations'
import { supabase } from '../lib/supabase'
import type { ApplicationRow, BookingRow, ProfileRow } from '../lib/db-rows'

export function AdminPage() {
  const { data: roster = [] } = useQuery<ProfileRow[]>({
    queryKey: ['admin', 'roster'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .order('full_name', { ascending: true })
        .returns<ProfileRow[]>()
      if (error) throw error
      return data
    },
  })

  const { data: applications = [] } = useQuery<ApplicationRow[]>({
    queryKey: ['admin', 'applications'],
    queryFn: async () => {
      if (!supabase) return []
      try {
        const { data, error } = await supabase
          .from('applications')
          .select('id, full_name, email, status, created_at')
          .order('created_at', { ascending: false })
          .returns<ApplicationRow[]>()
        if (error) throw error
        return data
      } catch (e) {
        console.warn('admin applications query failed:', e)
        return []
      }
    },
  })

  const { data: bookings = [] } = useQuery<BookingRow[]>({
    queryKey: ['admin', 'bookings'],
    queryFn: async () => {
      if (!supabase) return []
      try {
        const { data, error } = await supabase
          .from('mentorship_bookings')
          .select('id, mentor_name, requester_name, requester_email, status, created_at')
          .order('created_at', { ascending: false })
          .returns<BookingRow[]>()
        if (error) throw error
        return data
      } catch (e) {
        console.warn('admin bookings query failed:', e)
        return []
      }
    },
  })

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-2xl mx-auto space-y-6"
    >
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-1">Member roster</h2>
        <p className="text-sm text-gray-600 mb-6">{roster.length} members</p>
        <div className="space-y-1">
          {roster.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/30 transition-colors"
            >
              <span className="text-sm font-normal">{m.full_name}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-[#750014]/10 text-[#750014] capitalize">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-1">Applications</h2>
        <p className="text-sm text-gray-600 mb-6">{applications.length} submitted</p>
        {applications.length === 0 ? (
          <p className="text-sm text-gray-500">No applications yet.</p>
        ) : (
          <div className="space-y-1">
            {applications.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/30 transition-colors"
              >
                <span className="text-sm font-normal">
                  {a.full_name ?? '—'}{' '}
                  <span className="text-gray-500">&lt;{a.email}&gt;</span>
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-900/10 capitalize">
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-1">Mentorship requests</h2>
        <p className="text-sm text-gray-600 mb-6">{bookings.length} requested</p>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-500">No requests yet.</p>
        ) : (
          <div className="space-y-1">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/30 transition-colors"
              >
                <span className="text-sm font-normal">
                  {b.requester_name} → {b.mentor_name ?? 'Mentor'}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-900/10 capitalize">
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}
