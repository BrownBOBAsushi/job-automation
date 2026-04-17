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
      <button onClick={generate}
        className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition">
        Generate Resume
      </button>
    )
  }

  if (status === 'pending' || status === 'generating') {
    return (
      <div className="flex items-center gap-2 text-xs text-indigo-400">
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Generating resume...
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-400">Generation failed</span>
        <button onClick={generate} className="text-xs text-indigo-400 hover:text-indigo-300 underline">Retry</button>
      </div>
    )
  }

  if (status === 'done' && output) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <a href={`/api/resume/download/${jobId}`} target="_blank" rel="noopener noreferrer"
            className="inline-block px-3 py-1.5 text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg transition">
            Download PDF
          </a>
          <button onClick={generate}
            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition">
            Regenerate
          </button>
        </div>
        <div className="flex gap-3 text-xs text-gray-400">
          <span>Match: <strong className="text-gray-200">{output.match_score}%</strong></span>
          {output.ats_flags?.length > 0 && (
            <span className="text-orange-400">{output.ats_flags.length} ATS flag{output.ats_flags.length > 1 ? 's' : ''}</span>
          )}
        </div>
        {output.missing_keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {output.missing_keywords.map(k => (
              <span key={k} className="px-1.5 py-0.5 bg-orange-950 text-orange-400 text-xs rounded">{k}</span>
            ))}
          </div>
        )}
        {output?.eval_warnings?.length > 0 && (
          <div className="mt-2 space-y-1">
            {output.eval_warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
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
