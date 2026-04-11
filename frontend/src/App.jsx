import { Routes, Route, NavLink } from 'react-router-dom'
import Jobs from './pages/Jobs'
import Applications from './pages/Applications'
import Settings from './pages/Settings'

const NAV = [
  { to: '/', label: 'Jobs' },
  { to: '/applications', label: 'Applications' },
  { to: '/settings', label: 'Settings' },
]

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Top nav */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <span className="text-sm font-semibold text-white tracking-tight">Internship Tracker</span>
          <div className="flex items-center gap-1">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm transition ${
                    isActive
                      ? 'bg-gray-800 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        <Routes>
          <Route path="/" element={<Jobs />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
