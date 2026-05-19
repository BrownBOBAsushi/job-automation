export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative flex-1 max-w-xs">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        style={{ color: '#94A3B8' }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
      <input
        type="search"
        placeholder="Search jobs…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-9 pr-3 py-1.5 text-sm rounded-full outline-none transition-all duration-200"
        style={{
          backgroundColor: 'rgba(15,23,42,0.06)',
          color: '#1E293B',
          border: '1px solid transparent',
        }}
        onFocus={e => {
          e.target.style.backgroundColor = '#fff'
          e.target.style.border = '1px solid rgba(14,165,233,0.4)'
          e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12)'
        }}
        onBlur={e => {
          e.target.style.backgroundColor = 'rgba(15,23,42,0.06)'
          e.target.style.border = '1px solid transparent'
          e.target.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}
