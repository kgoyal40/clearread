import { useState } from 'react'

export default function UrlInput({ onAnalyze, loading }) {
  const [url, setUrl] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()

    const trimmed = url.trim()
    if (!trimmed) {
      setValidationError('Please enter a URL.')
      return
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setValidationError('URL must start with http:// or https://')
      return
    }

    setValidationError('')
    onAnalyze(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (validationError) setValidationError('')
            }}
            placeholder="https://example.com/article…"
            className="w-full h-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              bg-white placeholder-slate-400 text-slate-800 shadow-sm"
            disabled={loading}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold
            hover:bg-blue-700 active:bg-blue-800
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors shadow-sm whitespace-nowrap"
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>
      {validationError && (
        <p className="mt-2 text-sm text-red-500 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd" />
          </svg>
          {validationError}
        </p>
      )}
    </form>
  )
}
