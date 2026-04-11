export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
      <input
        type="text"
        placeholder="Search title, company, or JD..."
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
      />
    </div>
  )
}
