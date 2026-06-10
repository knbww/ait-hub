import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { GlassCard } from '../components/GlassCard'
import { pageVariants } from '../lib/animations'
import { supabase } from '../lib/supabase'
import type { ProfileRow } from '../lib/db-rows'

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

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-2xl mx-auto"
    >
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-1">Admin · Member roster</h2>
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
    </motion.div>
  )
}
