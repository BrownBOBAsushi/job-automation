import JobCard from './JobCard'

export default function JobList({ jobs, allJobsCount, loading, selectedJobId, onSelect }) {
  if (loading) {
    return (
      <div className="p-3 space-y-1.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-[72px] rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(15,23,42,0.05)' }} />
        ))}
      </div>
    )
  }

  if (jobs.length === 0 && allJobsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
        <p className="text-sm font-medium" style={{ color: '#1E293B' }}>No jobs yet</p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: '#94A3B8' }}>Run the pipeline to scrape listings.</p>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
        <p className="text-sm font-medium" style={{ color: '#1E293B' }}>No matches</p>
        <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Try adjusting your filters or search.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 py-2 flex items-center justify-between sticky top-0" style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
        <span className="text-xs" style={{ color: '#94A3B8' }}>
          {jobs.length}{allJobsCount !== jobs.length ? ` of ${allJobsCount}` : ''} job{jobs.length !== 1 ? 's' : ''}
        </span>
      </div>
      {jobs.map(job => (
        <JobCard
          key={job.id}
          job={job}
          selected={selectedJobId === job.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
