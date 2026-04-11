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
      const ts = new Date().toLocaleString()
      setLastUploaded(ts)
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
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
          dragging ? 'border-indigo-500 bg-indigo-950/30' : 'border-gray-700 hover:border-gray-600 bg-gray-900'
        }`}
      >
        <input ref={inputRef} type="file" accept=".docx" className="hidden"
          onChange={e => { if (e.target.files[0]) upload(e.target.files[0]) }} />

        <svg className="w-8 h-8 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>

        {uploading ? (
          <p className="text-sm text-gray-400">Uploading...</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-300">Drop your resume here</p>
            <p className="text-xs text-gray-500 mt-1">.docx files only · click to browse</p>
          </>
        )}
      </div>

      {lastUploaded && (
        <p className="text-xs text-gray-500 mt-2">Last uploaded: {lastUploaded}</p>
      )}

      {toast && (
        <div className={`mt-2 text-xs text-center py-2 px-3 rounded-lg ${
          toast.type === 'error' ? 'bg-red-950 text-red-400' : 'bg-green-950 text-green-400'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
