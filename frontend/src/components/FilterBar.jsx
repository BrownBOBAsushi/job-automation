import { useState } from 'react'

const CHIP = (active) =>
  `px-2 py-1 rounded text-xs font-medium cursor-pointer transition select-none ${
    active
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
  }`

const PLATFORMS    = ['mycareersfuture', 'indeed']
const PLATFORM_LABEL = { mycareersfuture: 'MCF', indeed: 'Indeed' }
const RECS         = ['Apply', 'Maybe', 'Skip']
const ARRANGEMENTS = ['Remote', 'Hybrid', 'On-site']
const JOB_TYPES    = ['internship', 'full-time', 'contract', 'part-time']

function toggle(arr, val) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export default function FilterBar({ filters, onChange }) {
  const [open, setOpen] = useState(false)

  function t(key, val) {
    onChange({ ...filters, [key]: toggle(filters[key], val) })
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-400 hover:text-white transition"
      >
        <span className="font-medium">Filters</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3 border-t border-gray-800 pt-3">
          {/* Min score */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-20 shrink-0">
              Min score: <span className="text-indigo-400 font-semibold">{filters.minScore}</span>
            </span>
            <input
              type="range" min={1} max={10} value={filters.minScore}
              onChange={e => onChange({ ...filters, minScore: Number(e.target.value) })}
              className="flex-1 accent-indigo-500"
            />
          </div>

          {/* Recommendation */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-600 w-20 shrink-0">Rec</span>
            {RECS.map(r => (
              <span key={r} className={CHIP(filters.recommendations.includes(r))} onClick={() => t('recommendations', r)}>
                {r}
              </span>
            ))}
          </div>

          {/* Platform */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-600 w-20 shrink-0">Platform</span>
            {PLATFORMS.map(p => (
              <span key={p} className={CHIP(filters.platforms.includes(p))} onClick={() => t('platforms', p)}>
                {PLATFORM_LABEL[p] ?? p}
              </span>
            ))}
          </div>

          {/* Arrangement */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-600 w-20 shrink-0">Arrangement</span>
            {ARRANGEMENTS.map(a => (
              <span key={a} className={CHIP(filters.arrangements.includes(a))} onClick={() => t('arrangements', a)}>
                {a}
              </span>
            ))}
          </div>

          {/* Job type */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-600 w-20 shrink-0">Type</span>
            {JOB_TYPES.map(j => (
              <span key={j} className={CHIP(filters.jobTypes.includes(j))} onClick={() => t('jobTypes', j)}>
                {j}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
