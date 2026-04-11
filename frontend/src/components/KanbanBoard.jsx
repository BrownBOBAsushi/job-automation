import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'

const COLUMNS = [
  { id: 'saved',       label: 'Saved',       colour: 'text-gray-400' },
  { id: 'applied',     label: 'Applied',     colour: 'text-blue-400' },
  { id: 'interviewing',label: 'Interviewing',colour: 'text-purple-400' },
  { id: 'offer',       label: 'Offer',       colour: 'text-green-400' },
]

const SCORE_COLOUR = s =>
  s >= 8 ? 'text-green-400' : s >= 5 ? 'text-yellow-400' : 'text-red-400'

function KanbanCard({ job, isDragging }) {
  const score = job.job_scores?.[0]
  return (
    <div className={`bg-gray-800 border rounded-xl p-3 space-y-1.5 cursor-grab active:cursor-grabbing transition ${
      isDragging ? 'border-indigo-500 opacity-50 rotate-1' : 'border-gray-700'
    }`}>
      <p className="text-sm font-medium text-gray-100 leading-snug">{job.title}</p>
      <p className="text-xs text-gray-400">{job.company}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded capitalize">
          {job.platform === 'mycareersfuture' ? 'MCF' : job.platform}
        </span>
        {score?.fit_score != null && (
          <span className={`text-xs font-bold tabular-nums ${SCORE_COLOUR(score.fit_score)}`}>
            {score.fit_score}/10
          </span>
        )}
      </div>
    </div>
  )
}

function DraggableCard({ job }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <KanbanCard job={job} isDragging={isDragging} />
    </div>
  )
}

function Column({ id, label, colour, jobs }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[180px] bg-gray-900 rounded-xl p-3 transition ${
        isOver ? 'ring-2 ring-indigo-500' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold uppercase tracking-wide ${colour}`}>{label}</span>
        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">{jobs.length}</span>
      </div>
      <div className="space-y-2">
        {jobs.map(job => <DraggableCard key={job.id} job={job} />)}
        {jobs.length === 0 && (
          <div className="text-xs text-gray-700 text-center py-6 border border-dashed border-gray-800 rounded-lg">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({ jobs, onStatusChange }) {
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }))

  // Group jobs by status
  const grouped = {}
  COLUMNS.forEach(c => { grouped[c.id] = [] })
  jobs.forEach(job => {
    const status = job.applications?.[0]?.status
    if (status && grouped[status]) {
      grouped[status].push(job)
    } else {
      grouped['saved'].push(job)  // default to saved if no status
    }
  })

  const activeJob = activeId ? jobs.find(j => j.id === activeId) : null

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const newStatus = COLUMNS.find(c => c.id === over.id)?.id
    if (!newStatus) return

    try {
      await fetch(`/api/jobs/${active.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      onStatusChange?.()
    } catch (e) {
      console.error('Status update failed', e)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={e => setActiveId(e.active.id)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map(col => (
          <Column key={col.id} {...col} jobs={grouped[col.id]} />
        ))}
      </div>

      <DragOverlay>
        {activeJob && <KanbanCard job={activeJob} />}
      </DragOverlay>
    </DndContext>
  )
}
