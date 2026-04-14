import { useState, useEffect, useCallback, useMemo } from 'react'
import PipelineButton from '../components/PipelineButton'
import SearchBar from '../components/SearchBar'
import FilterBar from '../components/FilterBar'
import JobCard from '../components/JobCard'
import JobDetail from '../components/JobDetail'

const DEFAULT_FILTERS = {
  minScore: 1,
  recommendations: ['Apply', 'Maybe', 'Skip'],
  platforms: ['mycareersfuture', 'indeed'],
  arrangements: [],
  jobTypes: [],
}

export default function Jobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedJob, setSelectedJob] = useState(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      const data = await res.json()
      setJobs(data)
      // Refresh selected job data if one is selected
      setSelectedJob(prev => prev ? (data.find(j => j.id === prev.id) ?? prev) : null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return jobs
      .filter(job => {
        const score = job.score
        if (!score) return true  // show unscored jobs
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

  return (
    <div className="-m-6 flex overflow-hidden" style={{ height: 'calc(100vh - 3rem)' }}>
      {/* ── Left panel ── */}
      <div className="w-96 flex-none flex flex-col border-r border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500">{filtered.length} / {jobs.length} jobs</p>
            </div>
            <PipelineButton onDone={fetchJobs} />
          </div>
          <SearchBar value={search} onChange={setSearch} />
        </div>

        {/* Filters */}
        <div className="border-b border-gray-800">
          <FilterBar filters={filters} onChange={setFilters} />
        </div>

        {/* Job list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-3 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-900 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-600 px-4">
              <p className="text-sm">No jobs match your filters.</p>
              <p className="text-xs mt-1">Run the pipeline to scrape new listings.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {filtered.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selectedJob?.id === job.id}
                  onSelect={setSelectedJob}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 overflow-y-auto bg-gray-950">
        {selectedJob ? (
          <JobDetail
            job={selectedJob}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-700">
            <div className="text-center">
              <p className="text-sm">Select a job to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
