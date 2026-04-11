import { useState, useEffect, useCallback, useMemo } from 'react'
import PipelineButton from '../components/PipelineButton'
import SearchBar from '../components/SearchBar'
import FilterBar from '../components/FilterBar'
import JobCard from '../components/JobCard'

const DEFAULT_FILTERS = {
  minScore: 1,
  recommendations: ['Apply', 'Maybe', 'Skip'],
  platforms: ['indeed'],
  arrangements: [],
  jobTypes: [],
  stipends: [],
}

function matchesStipend(stipend, filters) {
  if (!filters.stipends.length) return true
  const s = (stipend || '').toLowerCase()
  return filters.stipends.some(opt => {
    if (opt === 'None') return !stipend
    if (opt === '<SGD 1000') return s.includes('sgd') && parseFloat(s.replace(/[^0-9]/g, '')) < 1000
    if (opt === 'SGD 1000–2000') { const n = parseFloat(s.replace(/[^0-9]/g, '')); return n >= 1000 && n <= 2000 }
    if (opt === '>SGD 2000') return parseFloat(s.replace(/[^0-9]/g, '')) > 2000
    return false
  })
}

export default function Jobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      setJobs(await res.json())
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
        const score = job.job_scores?.[0]
        if (!score) return false
        if (score.fit_score < filters.minScore) return false
        if (!filters.recommendations.includes(score.recommendation)) return false
        if (!filters.platforms.includes(job.platform)) return false
        if (filters.arrangements.length && !filters.arrangements.includes(job.work_arrangement)) return false
        if (filters.jobTypes.length && !filters.jobTypes.includes(job.job_type)) return false
        if (!matchesStipend(job.stipend, filters)) return false
        if (s && !`${job.title} ${job.company} ${job.jd_text}`.toLowerCase().includes(s)) return false
        return true
      })
      .sort((a, b) => (b.job_scores?.[0]?.fit_score ?? 0) - (a.job_scores?.[0]?.fit_score ?? 0))
  }, [jobs, filters, search])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Jobs</h1>
          <p className="text-xs text-gray-500">{jobs.length} total · {filtered.length} shown</p>
        </div>
        <PipelineButton onDone={fetchJobs} />
      </div>

      {/* Search */}
      <SearchBar value={search} onChange={setSearch} />

      {/* Filters */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No jobs match your filters.</p>
          <p className="text-xs mt-1">Run the pipeline to scrape new listings.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(job => <JobCard key={job.id} job={job} onSaveToTracker={fetchJobs} />)}
        </div>
      )}
    </div>
  )
}
