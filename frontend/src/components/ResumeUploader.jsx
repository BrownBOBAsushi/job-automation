import { useState, useRef } from 'react'

export default function ResumeUploader({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [lastUploaded, setLastUploaded] = useState(null)
  const inputRef = useRef()

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function upload(file) {
    if (!file.name.endsWith('.docx')) {
      showToast('Only .docx files accepted', 'error')
      return
    }
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/resume/upload', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      setLastUploaded(new Date().toLocaleString())
      showToast('Resume updated successfully')
      onUploaded?.()
    } catch (e) {
      showToast(`Upload failed: ${e.message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current.click()}
        className="rounded-2xl p-10 text-center cursor-pointer transition-all duration-200"
        style={{
          border: dragging ? '2px dashed #0EA5E9' : '2px dashed rgba(15,23,42,0.1)',
          backgroundColor: dragging ? 'rgba(14,165,233,0.04)' : 'rgba(15,23,42,0.02)',
        }}
      >
        <input ref={inputRef} type="file" accept=".docx" className="hidden"
          onChange={e => { if (e.target.files[0]) upload(e.target.files[0]) }} />

        <svg
          className="w-8 h-8 mx-auto mb-3"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          style={{ color: '#94A3B8' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>

        {uploading ? (
          <p className="text-sm" style={{ color: '#94A3B8' }}>Uploading…</p>
        ) : (
          <>
            <p className="text-sm font-medium" style={{ color: '#1E293B' }}>Drop your resume here</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>.docx only · click to browse</p>
          </>
        )}
      </div>

      {lastUploaded && (
        <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>Last uploaded: {lastUploaded}</p>
      )}

      {toast && (
        <div
          className="mt-2 text-xs text-center py-2 px-3 rounded-xl"
          style={{
            backgroundColor: toast.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
            color: toast.type === 'error' ? '#B91C1C' : '#15803D',
            border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
