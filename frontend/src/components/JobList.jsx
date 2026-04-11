import JobCard from './JobCard'

export default function JobList({ jobs }) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No jobs to display. Run the pipeline to scrape and score new listings.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {jobs.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}
