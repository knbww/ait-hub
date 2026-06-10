import { motion } from 'framer-motion'
import { FileText, Target } from 'lucide-react'
import { cardVariants, pageVariants } from '../lib/animations'
import { researchPapers } from '../data/mock'

export function ResearchPage() {
  return (
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
            <FileText className="w-7 h-7" />
            <h2 className="text-3xl font-light">Research &amp; Paper Repository</h2>
          </div>

          <div className="space-y-4">
            {researchPapers.map((paper, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300 cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-normal mb-1">{paper.title}</h3>
                    <p className="text-sm text-gray-600">By {paper.author}</p>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#750014]/10 text-[#750014] text-sm">
                    <Target className="w-4 h-4" />
                    <span>{paper.citations} citations</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {paper.tags.map((tag, tidx) => (
                    <span
                      key={tidx}
                      className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-xs font-normal"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
