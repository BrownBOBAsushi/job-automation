import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import FilterBar from './FilterBar'
import JobDetail from './JobDetail'
import JobList from './JobList'
import PipelineButton from './PipelineButton'
import SearchBar from './SearchBar'

const DEFAULT_FILTERS = {
  minScore: 1,
  recommendations: ['Apply', 'Maybe', 'Skip'],
  platforms: ['mycareersfuture', 'indeed'],
  arrangements: [],
  jobTypes: [],
}

export default function Dashboard() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedJob, setSelectedJob] = useState(null)

  // Pipeline state (lifted so EmptyState CTA can trigger it)
  const [pipeline, setPipeline] = useState({ status: 'idle', last_run: null })
  const pollRef = useRef(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      const data = await res.json()
      setJobs(data)
      setSelectedJob(prev => prev ? (data.find(j => j.id === prev.id) ?? prev) : null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPipelineStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline/status')
      setPipeline(await res.json())
    } catch {}
  }, [])

  const runPipeline = useCallback(async () => {
    try {
      await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setPipeline(p => ({ ...p, status: 'scraping' }))
    } catch {}
  }, [])

  useEffect(() => { fetchJobs(); fetchPipelineStatus() }, [fetchJobs, fetchPipelineStatus])

  useEffect(() => {
    if (['scraping', 'scoring'].includes(pipeline.status)) {
      pollRef.current = setInterval(fetchPipelineStatus, 3000)
    } else {
      clearInterval(pollRef.current)
      if (pipeline.status === 'done') fetchJobs()
    }
    return () => clearInterval(pollRef.current)
  }, [pipeline.status, fetchPipelineStatus, fetchJobs])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return jobs
      .filter(job => {
        const score = job.score
        if (!score) return true
        if (score.fit_score < filters.minScore) return false
        if (!filters.recommendations.includes(score.recommendation)) return false
        if (filters.platforms.length && !filters.platforms.includes(job.platform)) return false
        if (filters.arrangements.length && !filters.arrangements.includes(job.work_arrangement)) return false
        if (filters.jobTypes.length && !filters.jobTypes.includes(job.job_type)) return false
        if (s && !`${job.title} ${job.company} ${job.jd_text}`.toLowerCase().includes(s)) return false
        return true
      })
      .sort((a, b) => (b.score?.fit_score ?? 0) - (a.score?.fit_score ?? 0))
  }, [jobs, filters, search])

  function handleStatusChange(jobId, newStatus) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j))
    setSelectedJob(prev => prev?.id === jobId ? { ...prev, status: newStatus } : prev)
  }

  const running = ['scraping', 'scoring'].includes(pipeline.status)

  return (
    <div className="-mx-6 -my-6 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* ── Top control bar ── */}
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{
          background: 'rgba(253,252,246,0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(15,23,42,0.07)',
        }}
      >
        <SearchBar value={search} onChange={setSearch} />
        <FilterBar filters={filters} onChange={setFilters} />
        <div className="shrink-0 ml-auto flex items-center gap-3">
          {pipeline.last_run && !running && (
            <span className="text-xs hidden lg:block" style={{ color: '#94A3B8' }}>
              Last run {new Date(pipeline.last_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <PipelineButton status={pipeline.status} onRun={runPipeline} />
        </div>
      </div>

      {/* ── Two-panel body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: job list */}
        <div
          className="w-80 flex-none overflow-y-auto glass-surface"
          style={{ borderRight: '1px solid rgba(15,23,42,0.07)' }}
        >
          <JobList
            jobs={filtered}
            allJobsCount={jobs.length}
            loading={loading}
            selectedJobId={selectedJob?.id}
            onSelect={setSelectedJob}
          />
        </div>

        {/* Right: detail or empty state */}
        <div className="flex-1 overflow-y-auto">
          {selectedJob ? (
            <JobDetail job={selectedJob} onStatusChange={handleStatusChange} />
          ) : (
            <RightEmpty
              jobs={jobs}
              loading={loading}
              running={running}
              onRun={runPipeline}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function RightEmpty({ jobs, loading, running, onRun }) {
  if (loading) return null

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #7C3AED)' }}
        >
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        {/* Copy */}
        <div className="text-center max-w-xs">
          <h2 className="font-display font-bold text-xl" style={{ color: '#1E293B' }}>
            No jobs yet
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: '#64748B' }}>
            Run the pipeline to scrape and score matching internship listings from MyCareersFuture and Indeed.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onRun}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
          onMouseEnter={e => { if (!running) e.currentTarget.style.backgroundColor = '#1E293B' }}
          onMouseLeave={e => { if (!running) e.currentTarget.style.backgroundColor = '#0F172A' }}
        >
          {running ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Running pipeline…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
              Run Pipeline
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm" style={{ color: '#94A3B8' }}>← Select a job to view details</p>
    </div>
  )
}
