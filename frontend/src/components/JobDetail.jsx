import { useState } from 'react'
import ResumeGenerator from './ResumeGenerator'

const REC_STYLE = {
  Apply: { bg: 'rgba(14,165,233,0.1)', color: '#0369A1', border: 'rgba(14,165,233,0.2)' },
  Maybe: { bg: 'rgba(245,158,11,0.1)', color: '#92400E', border: 'rgba(245,158,11,0.2)' },
  Skip:  { bg: 'rgba(239,68,68,0.08)', color: '#B91C1C', border: 'rgba(239,68,68,0.15)' },
}

const PLATFORM_LABEL = { mycareersfuture: 'MyCareersFuture', indeed: 'Indeed' }
const STATUSES = ['new', 'saved', 'applied', 'interviewing', 'offer']

function ScoreRing({ score }) {
  const style = score >= 8
    ? { bg: 'rgba(34,197,94,0.1)', color: '#15803D', border: 'rgba(34,197,94,0.2)' }
    : score >= 5
    ? { bg: 'rgba(245,158,11,0.1)', color: '#92400E', border: 'rgba(245,158,11,0.2)' }
    : { bg: 'rgba(239,68,68,0.08)', color: '#B91C1C', border: 'rgba(239,68,68,0.15)' }
  return (
    <span
      className="text-2xl font-bold px-4 py-2 rounded-2xl tabular-nums shrink-0"
      style={{ backgroundColor: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {score}<span className="text-sm font-normal opacity-40">/10</span>
    </span>
  )
}

function Badge({ children, style }) {
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs font-medium"
      style={style ?? { backgroundColor: 'rgba(15,23,42,0.05)', color: '#64748B' }}
    >
      {children}
    </span>
  )
}

function Section({ children }) {
  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)' }}
    >
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
      {children}
    </p>
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
    <div className="p-6 space-y-4 max-w-3xl">
      {/* Header */}
      <Section>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl font-bold leading-snug" style={{ color: '#0F172A' }}>
              {job.title}
            </h2>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>
              {job.company}{job.location ? ` · ${job.location}` : ''}
            </p>
          </div>
          {score?.fit_score != null && <ScoreRing score={score.fit_score} />}
        </div>

        <div className="flex flex-wrap gap-2">
          {score?.recommendation && (
            <Badge style={{
              backgroundColor: REC_STYLE[score.recommendation]?.bg,
              color: REC_STYLE[score.recommendation]?.color,
              border: `1px solid ${REC_STYLE[score.recommendation]?.border}`,
            }}>
              {score.recommendation}
            </Badge>
          )}
          {job.platform && <Badge>{PLATFORM_LABEL[job.platform] ?? job.platform}</Badge>}
          {job.job_type && <Badge className="capitalize">{job.job_type}</Badge>}
          {job.work_arrangement && <Badge>{job.work_arrangement}</Badge>}
          {job.stipend && (
            <Badge style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#15803D' }}>{job.stipend}</Badge>
          )}
          {job.posted_date && (
            <Badge>Posted {job.posted_date.slice(0, 10)}</Badge>
          )}
        </div>
      </Section>

      {/* Score breakdown */}
      {score && (score.matched_skills?.length > 0 || score.gaps?.length > 0 || score.reasoning) && (
        <Section>
          <SectionLabel>AI Assessment</SectionLabel>
          {score.reasoning && (
            <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>{score.reasoning}</p>
          )}
          {score.matched_skills?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Matched skills</p>
              <div className="flex flex-wrap gap-1.5">
                {score.matched_skills.map(s => (
                  <span
                    key={s}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#15803D', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {score.gaps?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Gaps</p>
              <div className="flex flex-wrap gap-1.5">
                {score.gaps.map(g => (
                  <span
                    key={g}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#B91C1C', border: '1px solid rgba(239,68,68,0.15)' }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Job Description */}
      <Section>
        <SectionLabel>Job Description</SectionLabel>
        <pre
          className="text-sm whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto rounded-xl p-4"
          style={{ backgroundColor: 'rgba(15,23,42,0.03)', color: '#334155' }}
        >
          {job.jd_text || 'No description available.'}
        </pre>
      </Section>

      {/* Actions */}
      <Section>
        <SectionLabel>Actions</SectionLabel>
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Status</p>
            <select
              value={job.status ?? 'new'}
              onChange={handleStatusChange}
              disabled={updatingStatus}
              className="text-sm rounded-full px-3 py-1.5 outline-none transition-all duration-150 disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: 'rgba(15,23,42,0.06)',
                color: '#1E293B',
                border: '1px solid transparent',
              }}
              onFocus={e => { e.target.style.border = '1px solid rgba(14,165,233,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12)' }}
              onBlur={e => { e.target.style.border = '1px solid transparent'; e.target.style.boxShadow = 'none' }}
            >
              {STATUSES.map(s => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </div>

          {job.url && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Apply</p>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-4 py-1.5 transition-all duration-150 cursor-pointer"
                style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1E293B'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0F172A'}
              >
                View listing
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Tailored Resume</p>
            <ResumeGenerator jobId={job.id} />
          </div>
        </div>
      </Section>
    </div>
  )
}
