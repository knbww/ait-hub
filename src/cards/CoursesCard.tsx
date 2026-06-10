import { GlassCard } from '../components/GlassCard'

export function CoursesCard() {
  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <h2 className="text-2xl font-light mb-6">My courses</h2>

        <div className="backdrop-blur-[35px] bg-white/20 border border-white/50 rounded-2xl p-6 shadow-[0_4px_16px_0_rgba(31,38,135,0.15)]">
          <h3 className="text-xl font-normal mb-6">Harvard CS50 AI</h3>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">60% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-[#750014] h-1.5 rounded-full" style={{ width: '60%' }}></div>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <button className="flex-1 px-4 py-1.5 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 hover:shadow-lg transition-all duration-300 text-sm">
              Continue Course
            </button>
            <button className="flex-1 px-4 py-1.5 border border-gray-900 rounded-lg font-normal hover:bg-gray-900 hover:text-white hover:scale-105 hover:shadow-lg transition-all duration-300 text-sm">
              View Syllabus
            </button>
          </div>

          <div className="space-y-1 text-sm text-gray-700">
            <p>Instructor: David J. Malan</p>
            <p>Duration: 12 Weeks</p>
            <p>Level: Intermediate</p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
