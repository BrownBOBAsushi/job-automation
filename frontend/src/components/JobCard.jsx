import { useState } from 'react'
import ResumeGenerator from './ResumeGenerator'

const PLATFORM_STYLES = {
  mycareersfuture: 'bg-teal-950 text-teal-400',
  indeed:          'bg-purple-950 text-purple-400',
  linkedin:        'bg-blue-950 text-blue-400',
}

const REC_STYLES = {
  Apply: 'bg-green-950 text-green-400',
  Maybe: 'bg-yellow-950 text-yellow-400',
  Skip:  'bg-red-950 text-red-400',
}

function ScoreChip({ score }) {
  const colour = score >= 8 ? 'text-green-400 bg-green-950' : score >= 5 ? 'text-yellow-400 bg-yellow-950' : 'text-red-400 bg-red-950'
  return (
    <span className={`text-lg font-bold px-2.5 py-1 rounded-lg tabular-nums ${colour}`}>{score}</span>
  )
}

const STATUSES = ['saved', 'applied', 'interviewing', 'offer']

export default function JobCard({ job, onSaveToTracker }) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(job.applications?.[0]?.status ?? '')
  const [notes, setNotes] = useState(job.applications?.[0]?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const score = job.job_scores?.[0]

  async function saveStatus(newStatus) {
    setStatus(newStatus)
    setSaving(true)
    try {
      await fetch(`/api/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes }),
      })
      onSaveToTracker?.()
    } finally { setSaving(false) }
  }

  async function saveNotes() {
    if (!status) return
    setSaving(true)
    try {
      await fetch(`/api/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition">
      {/* Collapsed row */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_STYLES[job.platform] ?? 'bg-gray-800 text-gray-400'}`}>
              {job.platform === 'mycareersfuture' ? 'MCF' : job.platform}
            </span>
            {score?.recommendation && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${REC_STYLES[score.recommendation] ?? 'bg-gray-800 text-gray-400'}`}>
                {score.recommendation}
              </span>
            )}
            {job.work_arrangement && (
              <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400">{job.work_arrangement}</span>
            )}
            {status && (
              <span className="px-2 py-0.5 rounded text-xs bg-indigo-950 text-indigo-400 capitalize">{status}</span>
            )}
          </div>
          <h3 className="font-semibold text-gray-100 text-sm leading-snug">{job.title}</h3>
          <p className="text-xs text-gray-500">{job.company}{job.location ? ` · ${job.location}` : ''}{job.stipend ? ` · ${job.stipend}` : ''}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {score?.fit_score != null && <ScoreChip score={score.fit_score} />}
          <button onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-500 hover:text-gray-200 transition px-2 py-1">
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          {score?.reasoning && (
            <p className="text-sm text-gray-300 leading-relaxed">{score.reasoning}</p>
          )}

          <div className="flex flex-wrap gap-4">
            {score?.matched_skills?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Matched</p>
                <div className="flex flex-wrap gap-1">
                  {score.matched_skills.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-green-950 text-green-400 text-xs rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {score?.gaps?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Gaps</p>
                <div className="flex flex-wrap gap-1">
                  {score.gaps.map(g => (
                    <span key={g} className="px-2 py-0.5 bg-red-950 text-red-400 text-xs rounded-full">{g}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 underline">
              View original listing ↗
            </a>
          )}

          {/* Application tracker */}
          <div className="flex flex-wrap gap-4 items-start">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Status</p>
              <select value={status} onChange={e => saveStatus(e.target.value)}
                className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-200 focus:outline-none focus:border-indigo-500 transition">
                <option value="">— not tracked —</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex-1 min-w-[180px]">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Notes</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes}
                rows={2} placeholder="Add notes..."
                className="w-full text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500 transition" />
            </div>
          </div>

          {/* Resume generator */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tailored Resume</p>
            <ResumeGenerator jobId={job.id} />
          </div>
        </div>
      )}
    </div>
  )
}
