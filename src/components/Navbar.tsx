import { useNavigate } from 'react-router-dom'
import { BookOpen, Database, Home, Menu, Network, Search, User } from 'lucide-react'
import { useAuth } from '../context/authContext'

export function Navbar() {
  const navigate = useNavigate()
  const { session } = useAuth()

  return (
    <div className="max-w-7xl mx-auto mb-8 relative">
      <div className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-full px-6 py-4 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/')}
              className="hover:scale-110 hover:rotate-12 transition-all duration-300"
            >
              <Home className="w-6 h-6" />
            </button>
            <button className="hover:scale-110 hover:rotate-12 transition-all duration-300">
              <Search className="w-6 h-6" />
            </button>
            <button
              onClick={() => navigate('/research')}
              className="hover:scale-110 transition-all duration-300"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/network')}
              className="hover:scale-110 transition-all duration-300"
            >
              <Network className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/resources')}
              className="hover:scale-110 transition-all duration-300"
            >
              <Database className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(session ? '/profile' : '/login')}
              title={session ? 'Your profile' : 'Sign in'}
              className="hover:scale-110 hover:rotate-12 transition-all duration-300"
            >
              <User className="w-6 h-6" />
            </button>
            <button className="px-6 py-2 border-2 border-gray-900 rounded-full font-normal hover:bg-gray-900 hover:text-white hover:scale-105 hover:shadow-[0_4px_16px_0_rgba(0,0,0,0.25)] transition-all duration-300">
              Apply Now
            </button>
            <button className="hover:scale-110 hover:rotate-12 transition-all duration-300">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
