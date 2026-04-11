import { useState, useEffect, useRef } from 'react'

const STATUS_STYLES = {
  idle:     'bg-gray-800 text-gray-400',
  scraping: 'bg-blue-950 text-blue-400',
  scoring:  'bg-yellow-950 text-yellow-400',
  done:     'bg-green-950 text-green-400',
  error:    'bg-red-950 text-red-400',
}

export default function PipelineButton({ keywords, onDone }) {
  const [state, setState] = useState({ status: 'idle', last_run: null })
  const pollRef = useRef(null)

  useEffect(() => {
    fetchStatus()
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (['scraping', 'scoring'].includes(state.status)) {
      pollRef.current = setInterval(fetchStatus, 3000)
    } else {
      clearInterval(pollRef.current)
      if (state.status === 'done') onDone?.()
    }
  }, [state.status])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/pipeline/status')
      setState(await res.json())
    } catch {}
  }

  async function run() {
    try {
      await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords?.length ? keywords : null }),
      })
      setState(s => ({ ...s, status: 'scraping' }))
    } catch {}
  }

  const running = ['scraping', 'scoring'].includes(state.status)

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={running}
        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
      >
        {running ? 'Running...' : 'Run Pipeline'}
      </button>

      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_STYLES[state.status] ?? STATUS_STYLES.idle}`}>
        {state.status}
      </span>

      {state.last_run && (
        <span className="text-xs text-gray-500 hidden sm:block">
          Last: {new Date(state.last_run).toLocaleString()}
        </span>
      )}
    </div>
  )
}
