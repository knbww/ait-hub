import { motion } from 'framer-motion'
import { Database, FileText, Zap } from 'lucide-react'
import { cardVariants, pageVariants } from '../lib/animations'

export function ResourcesPage() {
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
            <Database className="w-7 h-7" />
            <h2 className="text-3xl font-light">Resource Library</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300 cursor-pointer">
              <Zap className="w-6 h-6 mb-3" />
              <h4 className="font-normal mb-2">Cloud Credits</h4>
              <p className="text-sm text-gray-600">Google Colab Pro, AWS Credits</p>
            </div>
            <div className="p-5 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300 cursor-pointer">
              <FileText className="w-6 h-6 mb-3" />
              <h4 className="font-normal mb-2">Templates</h4>
              <p className="text-sm text-gray-600">LaTeX, Notion Dashboards</p>
            </div>
            <div className="p-5 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300 cursor-pointer">
              <Database className="w-6 h-6 mb-3" />
              <h4 className="font-normal mb-2">Datasets</h4>
              <p className="text-sm text-gray-600">Verified Research Data</p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
