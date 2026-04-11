import { useState, useEffect } from 'react'
import ResumeUploader from '../components/ResumeUploader'

const DEFAULT_KEYWORDS = [
  'software engineer intern',
  'AI engineer intern',
  'product manager intern',
  'data analyst intern',
  'backend developer intern',
]

export default function Settings() {
  const [resumeContent, setResumeContent] = useState(null)
  const [loadingResume, setLoadingResume] = useState(true)
  const [keywords, setKeywords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pipeline_keywords')) || DEFAULT_KEYWORDS }
    catch { return DEFAULT_KEYWORDS }
  })
  const [newKeyword, setNewKeyword] = useState('')

  useEffect(() => { fetchResume() }, [])

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

  function saveKeywords(kws) {
    setKeywords(kws)
    localStorage.setItem('pipeline_keywords', JSON.stringify(kws))
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
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-xs text-gray-500">Manage your resume and pipeline configuration</p>
      </div>

      {/* Resume upload */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Master Resume</h2>
        <ResumeUploader onUploaded={fetchResume} />

        {loadingResume ? (
          <div className="h-32 bg-gray-900 rounded-xl animate-pulse" />
        ) : resumeContent ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Preview</p>
            <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
              {resumeContent}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-gray-600">No resume uploaded yet.</p>
        )}
      </section>

      {/* Keywords */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Pipeline Keywords</h2>
        <p className="text-xs text-gray-500">These keywords are used when you click "Run Pipeline".</p>

        <div className="flex flex-wrap gap-2">
          {keywords.map(kw => (
            <div key={kw} className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1">
              <span className="text-xs text-gray-300">{kw}</span>
              <button onClick={() => removeKeyword(kw)} className="text-gray-600 hover:text-red-400 transition ml-1">×</button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder="e.g. data science intern"
            className="flex-1 text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition"
          />
          <button onClick={addKeyword}
            className="px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition">
            Add
          </button>
        </div>

        <button
          onClick={() => saveKeywords(DEFAULT_KEYWORDS)}
          className="text-xs text-gray-600 hover:text-gray-400 underline transition"
        >
          Reset to defaults
        </button>
      </section>
    </div>
  )
}
