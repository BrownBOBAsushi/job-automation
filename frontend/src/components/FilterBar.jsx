import { useState, useRef, useEffect } from 'react'

const PLATFORMS    = ['mycareersfuture', 'indeed']
const PLATFORM_LABEL = { mycareersfuture: 'MCF', indeed: 'Indeed' }
const RECS         = ['Apply', 'Maybe', 'Skip']
const ARRANGEMENTS = ['Remote', 'Hybrid', 'On-site']
const JOB_TYPES    = ['internship', 'full-time', 'contract', 'part-time']

const DEFAULT_FILTERS = {
  minScore: 1,
  recommendations: ['Apply', 'Maybe', 'Skip'],
  platforms: ['mycareersfuture', 'indeed'],
  arrangements: [],
  jobTypes: [],
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer"
      style={{
        backgroundColor: active ? '#0F172A' : 'rgba(15,23,42,0.06)',
        color: active ? '#FFFFFF' : '#64748B',
      }}
    >
      {children}
    </button>
  )
}

function toggle(arr, val) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

function countActiveFilters(filters) {
  let n = 0
  if (filters.minScore > 1) n++
  if (filters.recommendations.length !== RECS.length) n++
  if (filters.platforms.length !== PLATFORMS.length) n++
  if (filters.arrangements.length > 0) n++
  if (filters.jobTypes.length > 0) n++
  return n
}

export default function FilterBar({ filters, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function t(key, val) {
    onChange({ ...filters, [key]: toggle(filters[key], val) })
  }

  const active = countActiveFilters(filters)

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer"
        style={{
          backgroundColor: open || active > 0 ? '#0F172A' : 'rgba(15,23,42,0.06)',
          color: open || active > 0 ? '#FFFFFF' : '#64748B',
        }}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
        </svg>
        Filters
        {active > 0 && (
          <span
            className="w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
            style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF', fontSize: '10px' }}
          >
            {active}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 left-0 z-50 rounded-2xl p-4 space-y-3 w-72 shadow-xl"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(15,23,42,0.08)',
          }}
        >
          {/* Min score */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Min score</span>
              <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>{filters.minScore}</span>
            </div>
            <input
              type="range" min={1} max={10} value={filters.minScore}
              onChange={e => onChange({ ...filters, minScore: Number(e.target.value) })}
              className="w-full cursor-pointer accent-slate-900"
            />
          </div>

          {/* Recommendation */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Recommendation</p>
            <div className="flex flex-wrap gap-1.5">
              {RECS.map(r => (
                <Chip key={r} active={filters.recommendations.includes(r)} onClick={() => t('recommendations', r)}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Platform</p>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <Chip key={p} active={filters.platforms.includes(p)} onClick={() => t('platforms', p)}>
                  {PLATFORM_LABEL[p] ?? p}
                </Chip>
              ))}
            </div>
          </div>

          {/* Work arrangement */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Arrangement</p>
            <div className="flex flex-wrap gap-1.5">
              {ARRANGEMENTS.map(a => (
                <Chip key={a} active={filters.arrangements.includes(a)} onClick={() => t('arrangements', a)}>
                  {a}
                </Chip>
              ))}
            </div>
          </div>

          {/* Job type */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>Type</p>
            <div className="flex flex-wrap gap-1.5">
              {JOB_TYPES.map(j => (
                <Chip key={j} active={filters.jobTypes.includes(j)} onClick={() => t('jobTypes', j)}>
                  {j}
                </Chip>
              ))}
            </div>
          </div>

          {/* Reset */}
          {active > 0 && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="text-xs transition-opacity hover:opacity-70 cursor-pointer pt-1"
              style={{ color: '#94A3B8' }}
            >
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
