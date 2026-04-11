import { useState, useEffect, useCallback } from 'react'
import KanbanBoard from '../components/KanbanBoard'

export default function Applications() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      const all = await res.json()
      // Only show jobs that have been saved to tracker
      setJobs(all.filter(j => j.applications?.length > 0))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Applications</h1>
        <p className="text-xs text-gray-500">{jobs.length} tracked · drag cards to update status</p>
      </div>

      {loading ? (
        <div className="flex gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1 h-48 bg-gray-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No applications tracked yet.</p>
          <p className="text-xs mt-1">Open a job card and set its status to start tracking.</p>
        </div>
      ) : (
        <KanbanBoard jobs={jobs} onStatusChange={fetchJobs} />
      )}
    </div>
  )
}
