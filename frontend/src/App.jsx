import { Routes, Route, NavLink } from 'react-router-dom'
import Jobs from './pages/Jobs'
import Settings from './pages/Settings'

const NAV = [
  { to: '/', label: 'Jobs' },
  { to: '/settings', label: 'Settings' },
]

export default function App() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#FDFCF6' }}>
      {/* Portfolio-style ambient blobs */}
      <div
        className="fixed top-[-5%] left-[-10%] w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: 'rgb(186,230,253)', filter: 'blur(80px)', opacity: 0.45, mixBlendMode: 'multiply', zIndex: 0 }}
      />
      <div
        className="fixed top-[-5%] right-[-10%] w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: 'rgb(233,213,255)', filter: 'blur(80px)', opacity: 0.45, mixBlendMode: 'multiply', zIndex: 0 }}
      />
      <div
        className="fixed bottom-[-10%] left-[15%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'rgb(252,231,243)', filter: 'blur(80px)', opacity: 0.35, mixBlendMode: 'multiply', zIndex: 0 }}
      />

      {/* Nav */}
      <nav
        className="sticky top-0 z-50 h-14 flex items-center px-6"
        style={{
          background: 'rgba(253,252,246,0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(15,23,42,0.07)',
        }}
      >
        <div className="flex items-center justify-between w-full">
          <span className="font-display font-bold text-sm tracking-tight text-gradient">
            Internship Tracker
          </span>
          <div className="flex items-center gap-1">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-full text-sm transition-all duration-200 cursor-pointer font-medium ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 max-w-screen-2xl mx-auto w-full px-6 py-6 overflow-hidden">
        <Routes>
          <Route path="/" element={<Jobs />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
