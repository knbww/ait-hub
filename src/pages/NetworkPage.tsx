import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { cardVariants, pageVariants } from '../lib/animations'
import { useMentors } from '../hooks/useMentors'
import { BookMeetingModal } from '../components/BookMeetingModal'

export function NetworkPage() {
  const { data: alumni = [] } = useMentors()
  const [selected, setSelected] = useState<{ id?: string; name: string } | null>(null)

  return (
    <>
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-7xl mx-auto"
    >
      <div className="relative">
        <motion.div
          variants={cardVariants}
          className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]"
        >
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-7 h-7" />
            <h2 className="text-3xl font-light">Alumni &amp; Mentorship</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {alumni.map((person, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-normal mb-1">{person.name}</h3>
                    <p className="text-sm text-gray-600">
                      {person.university} '{person.year}
                    </p>
                    <p className="text-sm text-gray-700 font-normal mt-1">{person.role}</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-300 to-purple-400"></div>
                </div>
                <button
                  onClick={() => setSelected({ id: person.id, name: person.name })}
                  className="w-full px-4 py-2 border-2 border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 transition-all duration-300 text-sm"
                >
                  Book 15-min Meeting
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
    {selected && <BookMeetingModal mentor={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
