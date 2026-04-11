const COLOURS = {
  saved: 'bg-gray-100 text-gray-600',
  applied: 'bg-blue-100 text-blue-700',
  interviewing: 'bg-purple-100 text-purple-700',
  rejected: 'bg-red-100 text-red-700',
  offer: 'bg-green-100 text-green-700',
}

export default function StatusBadge({ status }) {
  if (!status) return null
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${COLOURS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
