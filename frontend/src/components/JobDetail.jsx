import { useState } from 'react'
import ResumeGenerator from './ResumeGenerator'

const REC_STYLES = {
  Apply: 'bg-green-950 text-green-400 border border-green-900',
  Maybe: 'bg-yellow-950 text-yellow-400 border border-yellow-900',
  Skip: 'bg-red-950 text-red-400 border border-red-900',
}

const PLATFORM_LABEL = { mycareersfuture: 'MyCareersFuture', indeed: 'Indeed' }

const STATUSES = ['new', 'saved', 'applied', 'interviewing', 'offer']

function ScoreRing({ score }) {
  const cls = score >= 8
    ? 'text-green-400 bg-green-950 border-green-800'
    : score >= 5
    ? 'text-yellow-400 bg-yellow-950 border-yellow-800'
    : 'text-red-400 bg-red-950 border-red-800'
  return (
    <span className={`text-2xl font-bold px-3 py-1.5 rounded-xl border tabular-nums ${cls}`}>
      {score}
      <span className="text-sm font-normal opacity-60">/10</span>
    </span>
  )
}

export default function JobDetail({ job, onStatusChange }) {
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const score = job.score

  async function handleStatusChange(e) {
    const newStatus = e.target.value
    setUpdatingStatus(true)
    try {
      await fetch(`/api/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      onStatusChange?.(job.id, newStatus)
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-white leading-snug">{job.title}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {job.company}
              {job.location ? ` · ${job.location}` : ''}
            </p>
          </div>
          {score?.fit_score != null && <ScoreRing score={score.fit_score} />}
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-2">
          {score?.recommendation && (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${REC_STYLES[score.recommendation] ?? 'bg-gray-800 text-gray-400'}`}>
              {score.recommendation}
            </span>
          )}
          {job.platform && (
            <span className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 text-gray-400">
              {PLATFORM_LABEL[job.platform] ?? job.platform}
            </span>
          )}
          {job.job_type && (
            <span className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 text-gray-400 capitalize">
              {job.job_type}
            </span>
          )}
          {job.work_arrangement && (
            <span className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 text-gray-400">
              {job.work_arrangement}
            </span>
          )}
          {job.stipend && (
            <span className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 text-gray-300 font-medium">
              {job.stipend}
            </span>
          )}
          {job.posted_date && (
            <span className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 text-gray-500">
              Posted {job.posted_date.slice(0, 10)}
            </span>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      {score && (
        <div className="space-y-3">
          {score.matched_skills?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Matched Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {score.matched_skills.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-green-950 text-green-400 text-xs rounded-full border border-green-900">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {score.gaps?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Gaps</p>
              <div className="flex flex-wrap gap-1.5">
                {score.gaps.map(g => (
                  <span key={g} className="px-2 py-0.5 bg-red-950 text-red-400 text-xs rounded-full border border-red-900">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
          {score.reasoning && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Assessment</p>
              <p className="text-sm text-gray-300 leading-relaxed">{score.reasoning}</p>
            </div>
          )}
        </div>
      )}

      <hr className="border-gray-800" />

      {/* JD */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Job Description</p>
        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto bg-gray-900 rounded-xl p-4 border border-gray-800">
          {job.jd_text || 'No description available.'}
        </pre>
      </div>

      <hr className="border-gray-800" />

      {/* Actions */}
      <div className="flex flex-wrap items-start gap-6">
        {/* Status */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Status</p>
          <select
            value={job.status ?? 'new'}
            onChange={handleStatusChange}
            disabled={updatingStatus}
            className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-indigo-500 transition disabled:opacity-50"
          >
            {STATUSES.map(s => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
        </div>

        {/* Apply link */}
        {job.url && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Apply</p>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg border border-gray-700 transition"
            >
              View listing ↗
            </a>
          </div>
        )}

        {/* Resume generator */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Tailored Resume</p>
          <ResumeGenerator jobId={job.id} />
        </div>
      </div>
    </div>
  )
}
