const PLATFORM_LABEL = { mycareersfuture: 'MCF', indeed: 'Indeed' }

const PLATFORM_STYLES = {
  mycareersfuture: 'bg-teal-950 text-teal-400',
  indeed: 'bg-purple-950 text-purple-400',
}

const REC_STYLES = {
  Apply: 'bg-green-950 text-green-400',
  Maybe: 'bg-yellow-950 text-yellow-400',
  Skip: 'bg-red-950 text-red-400',
}

const STATUS_DOT = {
  new: 'bg-gray-600',
  saved: 'bg-blue-500',
  applied: 'bg-indigo-500',
  interviewing: 'bg-yellow-500',
  offer: 'bg-green-500',
}

function ScoreBadge({ score }) {
  if (score == null) return null
  const cls = score >= 8
    ? 'bg-green-950 text-green-400'
    : score >= 5
    ? 'bg-yellow-950 text-yellow-400'
    : 'bg-red-950 text-red-400'
  return (
    <span className={`text-sm font-bold px-2 py-0.5 rounded tabular-nums ${cls}`}>{score}</span>
  )
}

export default function JobCard({ job, selected, onSelect }) {
  const score = job.score

  return (
    <button
      onClick={() => onSelect(job)}
      className={`w-full text-left px-4 py-3 transition ${
        selected
          ? 'bg-gray-800 border-l-2 border-indigo-500'
          : 'hover:bg-gray-900/60 border-l-2 border-transparent'
      }`}
    >
      {/* Row 1: badges */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PLATFORM_STYLES[job.platform] ?? 'bg-gray-800 text-gray-400'}`}>
          {PLATFORM_LABEL[job.platform] ?? job.platform}
        </span>
        {score?.recommendation && (
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${REC_STYLES[score.recommendation] ?? 'bg-gray-800 text-gray-400'}`}>
            {score.recommendation}
          </span>
        )}
        {job.job_type && (
          <span className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-500">
            {job.job_type}
          </span>
        )}
      </div>

      {/* Row 2: title + score */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-100 text-sm leading-snug line-clamp-2 flex-1">
          {job.title}
        </h3>
        <ScoreBadge score={score?.fit_score} />
      </div>

      {/* Row 3: company · location */}
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {job.company}{job.location ? ` · ${job.location}` : ''}
        {job.stipend ? ` · ${job.stipend}` : ''}
      </p>

      {/* Row 4: status dot */}
      {job.status && job.status !== 'new' && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[job.status] ?? 'bg-gray-600'}`} />
          <span className="text-xs text-gray-500 capitalize">{job.status}</span>
        </div>
      )}
    </button>
  )
}
