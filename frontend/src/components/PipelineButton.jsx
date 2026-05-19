const STATUS_LABEL = {
  idle:     'Run Pipeline',
  scraping: 'Scraping…',
  scoring:  'Scoring…',
  done:     'Done',
  error:    'Error — Retry',
}

export default function PipelineButton({ status, onRun }) {
  const running = ['scraping', 'scoring'].includes(status)
  const isError = status === 'error'

  return (
    <button
      onClick={onRun}
      disabled={running}
      className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      style={{
        backgroundColor: isError ? '#FFF1F2' : running ? 'rgba(15,23,42,0.06)' : '#0F172A',
        color: isError ? '#9F1239' : running ? '#64748B' : '#FFFFFF',
        border: running ? '1px solid rgba(15,23,42,0.1)' : 'none',
      }}
      onMouseEnter={e => { if (!running && !isError) e.currentTarget.style.backgroundColor = '#1E293B' }}
      onMouseLeave={e => { if (!running && !isError) e.currentTarget.style.backgroundColor = '#0F172A' }}
    >
      {running ? (
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
        </svg>
      )}
      {STATUS_LABEL[status] ?? 'Run Pipeline'}
    </button>
  )
}
