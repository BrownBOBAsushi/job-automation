const PLATFORM_LABEL = { mycareersfuture: 'MCF', indeed: 'Indeed' }

const REC_STYLE = {
  Apply: { bg: 'rgba(14,165,233,0.1)', color: '#0369A1' },
  Maybe: { bg: 'rgba(245,158,11,0.1)', color: '#92400E' },
  Skip:  { bg: 'rgba(239,68,68,0.08)', color: '#B91C1C' },
}

const STATUS_DOT = {
  saved:        '#38BDF8',
  applied:      '#A78BFA',
  interviewing: '#FBBF24',
  offer:        '#34D399',
}

function ScoreBadge({ score }) {
  if (score == null) return null
  const style = score >= 8
    ? { bg: 'rgba(34,197,94,0.1)', color: '#15803D' }
    : score >= 5
    ? { bg: 'rgba(245,158,11,0.1)', color: '#92400E' }
    : { bg: 'rgba(239,68,68,0.08)', color: '#B91C1C' }
  return (
    <span
      className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full shrink-0"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {score}
    </span>
  )
}

export default function JobCard({ job, selected, onSelect }) {
  const score = job.score
  const rec = score?.recommendation

  return (
    <button
      onClick={() => onSelect(job)}
      className="w-full text-left px-4 py-3 transition-all duration-150 cursor-pointer"
      style={{
        backgroundColor: selected ? 'rgba(14,165,233,0.08)' : 'transparent',
        borderLeft: selected ? '2px solid #0EA5E9' : '2px solid transparent',
        borderBottom: '1px solid rgba(15,23,42,0.05)',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = 'rgba(15,23,42,0.03)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {/* Title + score */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3
          className="font-semibold text-sm leading-snug line-clamp-2 flex-1"
          style={{ color: selected ? '#0F172A' : '#1E293B' }}
        >
          {job.title}
        </h3>
        <ScoreBadge score={score?.fit_score} />
      </div>

      {/* Company · location */}
      <p className="text-xs truncate mb-1.5" style={{ color: '#64748B' }}>
        {job.company}{job.location ? ` · ${job.location}` : ''}{job.stipend ? ` · ${job.stipend}` : ''}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap gap-1">
        <span
          className="px-2 py-0.5 rounded-full text-xs"
          style={{ backgroundColor: 'rgba(15,23,42,0.05)', color: '#94A3B8' }}
        >
          {PLATFORM_LABEL[job.platform] ?? job.platform}
        </span>
        {rec && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: REC_STYLE[rec]?.bg, color: REC_STYLE[rec]?.color }}
          >
            {rec}
          </span>
        )}
        {job.job_type && (
          <span
            className="px-2 py-0.5 rounded-full text-xs capitalize"
            style={{ backgroundColor: 'rgba(15,23,42,0.04)', color: '#94A3B8' }}
          >
            {job.job_type}
          </span>
        )}
        {job.status && job.status !== 'new' && (
          <span
            className="px-2 py-0.5 rounded-full text-xs capitalize flex items-center gap-1"
            style={{ backgroundColor: 'rgba(15,23,42,0.04)', color: STATUS_DOT[job.status] ?? '#94A3B8' }}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: STATUS_DOT[job.status] ?? '#9CA3AF' }} />
            {job.status}
          </span>
        )}
      </div>
    </button>
  )
}
