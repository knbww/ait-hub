import { motion } from 'framer-motion'
import { GlassCard } from '../components/GlassCard'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'

export function ProfilePage() {
  const { profile, session, role, signOut } = useAuth()

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-md mx-auto"
    >
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-6">Your Profile</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Name</dt>
            <dd className="font-normal">{profile?.full_name ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Email</dt>
            <dd className="font-normal">{session?.user.email ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Role</dt>
            <dd className="font-normal capitalize">{role}</dd>
          </div>
        </dl>
        <button
          onClick={signOut}
          className="mt-6 w-full px-4 py-2 border border-gray-900 rounded-lg text-sm hover:bg-gray-900 hover:text-white transition-all duration-300"
        >
          Sign out
        </button>
      </GlassCard>
    </motion.div>
  )
}
