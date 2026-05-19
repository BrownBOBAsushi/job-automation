import { useState, useEffect } from 'react'
import ResumeUploader from '../components/ResumeUploader'

const DEFAULT_KEYWORDS = [
  'software engineer intern',
  'product manager intern',
  'AI engineer intern',
  'fintech intern',
  'full stack intern',
  'data analyst intern',
]

export default function Settings() {
  const [resumeContent, setResumeContent] = useState(null)
  const [loadingResume, setLoadingResume] = useState(true)
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS)
  const [loadingKeywords, setLoadingKeywords] = useState(true)
  const [newKeyword, setNewKeyword] = useState('')
  const [savingKeywords, setSavingKeywords] = useState(false)

  useEffect(() => {
    fetchResume()
    fetchKeywords()
  }, [])

  async function fetchResume() {
    setLoadingResume(true)
    try {
      const res = await fetch('/api/resume')
      if (res.ok) {
        const { content } = await res.json()
        setResumeContent(content)
      }
    } catch {}
    setLoadingResume(false)
  }

  async function fetchKeywords() {
    setLoadingKeywords(true)
    try {
      const res = await fetch('/api/settings/keywords')
      if (res.ok) {
        const { keywords: kws } = await res.json()
        setKeywords(kws)
      }
    } catch {}
    setLoadingKeywords(false)
  }

  async function saveKeywords(kws) {
    setKeywords(kws)
    setSavingKeywords(true)
    try {
      await fetch('/api/settings/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: kws }),
      })
    } finally {
      setSavingKeywords(false)
    }
  }

  function addKeyword() {
    const trimmed = newKeyword.trim()
    if (!trimmed || keywords.includes(trimmed)) return
    saveKeywords([...keywords, trimmed])
    setNewKeyword('')
  }

  function removeKeyword(kw) {
    saveKeywords(keywords.filter(k => k !== kw))
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="font-display text-xl font-bold" style={{ color: '#0F172A' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Manage your resume and pipeline configuration</p>
      </div>

      {/* Resume upload */}
      <section
        className="rounded-2xl p-6 space-y-4"
        style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Master Resume</h2>
        <ResumeUploader onUploaded={fetchResume} />

        {loadingResume ? (
          <div className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(15,23,42,0.05)' }} />
        ) : resumeContent ? (
          <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94A3B8' }}>Preview</p>
            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto" style={{ color: '#334155' }}>
              {resumeContent}
            </pre>
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#94A3B8' }}>No resume uploaded yet.</p>
        )}
      </section>

      {/* Keywords */}
      <section
        className="rounded-2xl p-6 space-y-4"
        style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)' }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Pipeline Keywords</h2>
          {savingKeywords && <span className="text-xs" style={{ color: '#94A3B8' }}>Saving…</span>}
        </div>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Used when you click "Run Pipeline" to target specific roles.
        </p>

        {loadingKeywords ? (
          <div className="h-8 rounded-full animate-pulse w-48" style={{ backgroundColor: 'rgba(15,23,42,0.05)' }} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map(kw => (
              <div
                key={kw}
                className="flex items-center gap-1 rounded-full px-3 py-1.5"
                style={{ backgroundColor: 'rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.08)' }}
              >
                <span className="text-xs" style={{ color: '#334155' }}>{kw}</span>
                <button
                  onClick={() => removeKeyword(kw)}
                  className="ml-1 text-base leading-none cursor-pointer transition-opacity hover:opacity-60"
                  style={{ color: '#94A3B8' }}
                  aria-label={`Remove ${kw}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder="e.g. data science intern"
            className="flex-1 text-sm rounded-full px-4 py-2 outline-none transition-all duration-150"
            style={{ backgroundColor: 'rgba(15,23,42,0.06)', color: '#1E293B', border: '1px solid transparent' }}
            onFocus={e => { e.target.style.border = '1px solid rgba(14,165,233,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12)'; e.target.style.backgroundColor = '#fff' }}
            onBlur={e => { e.target.style.border = '1px solid transparent'; e.target.style.boxShadow = 'none'; e.target.style.backgroundColor = 'rgba(15,23,42,0.06)' }}
          />
          <button
            onClick={addKeyword}
            className="px-4 py-2 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer"
            style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1E293B'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0F172A'}
          >
            Add
          </button>
        </div>

        <button
          onClick={() => saveKeywords(DEFAULT_KEYWORDS)}
          className="text-xs transition-opacity hover:opacity-70 cursor-pointer"
          style={{ color: '#94A3B8' }}
        >
          Reset to defaults
        </button>
      </section>
    </div>
  )
}
