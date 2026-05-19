import { useState, useEffect, useRef } from 'react'

export default function ResumeGenerator({ jobId }) {
  const [status, setStatus] = useState(null)
  const [output, setOutput] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    fetchStatus()
    return () => clearInterval(pollRef.current)
  }, [jobId])

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/resume/status/${jobId}`)
      const data = await res.json()
      setStatus(data.status)
      if (data.output) setOutput(data.output)
      if (['pending', 'generating'].includes(data.status)) {
        clearInterval(pollRef.current)
        pollRef.current = setInterval(poll, 3000)
      }
    } catch {}
  }

  async function poll() {
    try {
      const res = await fetch(`/api/resume/status/${jobId}`)
      const data = await res.json()
      setStatus(data.status)
      if (data.output) setOutput(data.output)
      if (!['pending', 'generating'].includes(data.status)) clearInterval(pollRef.current)
    } catch {}
  }

  async function generate() {
    setStatus('pending')
    try {
      await fetch(`/api/resume/generate/${jobId}`, { method: 'POST' })
      pollRef.current = setInterval(poll, 3000)
    } catch { setStatus('failed') }
  }

  if (!status || status === 'not_started') {
    return (
      <button
        onClick={generate}
        className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer"
        style={{ backgroundColor: 'rgba(15,23,42,0.06)', color: '#1E293B', border: '1px solid rgba(15,23,42,0.08)' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(15,23,42,0.10)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(15,23,42,0.06)'}
      >
        Generate Resume
      </button>
    )
  }

  if (status === 'pending' || status === 'generating') {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Generating…
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span style={{ color: '#B91C1C' }}>Generation failed</span>
        <button
          onClick={generate}
          className="underline cursor-pointer transition-opacity hover:opacity-70"
          style={{ color: '#0EA5E9' }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (status === 'done' && output) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <a
            href={`/api/resume/download/${jobId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer"
            style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Download PDF
          </a>
          <button
            onClick={generate}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer"
            style={{ backgroundColor: 'rgba(15,23,42,0.06)', color: '#1E293B' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(15,23,42,0.10)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(15,23,42,0.06)'}
          >
            Regenerate
          </button>
        </div>
        <div className="flex gap-3 text-xs" style={{ color: '#64748B' }}>
          <span>Match: <strong style={{ color: '#1E293B' }}>{output.match_score}%</strong></span>
          {output.ats_flags?.length > 0 && (
            <span style={{ color: '#92400E' }}>{output.ats_flags.length} ATS flag{output.ats_flags.length > 1 ? 's' : ''}</span>
          )}
        </div>
        {output.missing_keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {output.missing_keywords.map(k => (
              <span
                key={k}
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#92400E' }}
              >
                {k}
              </span>
            ))}
          </div>
        )}
        {output?.eval_warnings?.length > 0 && (
          <div className="mt-1 space-y-1">
            {output.eval_warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs" style={{ color: '#92400E' }}>
                <span>⚠</span>
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}
