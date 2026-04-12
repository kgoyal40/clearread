import { useState } from 'react'
import UrlInput from './components/UrlInput'
import ExplanationPanel from './components/ExplanationPanel'
import ReliabilityPanel from './components/ReliabilityPanel'

const STEPS = [
  { key: 'fetch',       label: 'Fetching article'         },
  { key: 'analysis',    label: 'Analysing content'        },
  { key: 'reliability', label: 'Checking source'          },
  { key: 'corroboration', label: 'Corroborating claim'    },
]

function AnalysisProgress({ loading, loadingStates }) {
  const isActive = loading || Object.values(loadingStates).some(Boolean)
  if (!isActive) return null

  const stepsDone = {
    fetch:         !loading,
    analysis:      !loading && !loadingStates.analysis,
    reliability:   !loading && !loadingStates.outlet && !loadingStates.source_reliability,
    corroboration: !loading && !loadingStates.corroboration,
  }

  const activeIndex = STEPS.findIndex(s => !stepsDone[s.key])

  return (
    <div className="flex items-center gap-0 mt-8 mb-2 px-1">
      {STEPS.map((step, i) => {
        const done = stepsDone[step.key]
        const active = i === activeIndex
        const pending = !done && !active

        return (
          <div key={step.key} className="flex items-center gap-0 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300
                ${done    ? 'bg-emerald-500'  : ''}
                ${active  ? 'bg-blue-600'     : ''}
                ${pending ? 'bg-slate-200'    : ''}
              `}>
                {done && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {active && (
                  <svg className="w-3.5 h-3.5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {pending && <div className="w-2 h-2 rounded-full bg-slate-400" />}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap transition-colors duration-300
                ${done    ? 'text-emerald-600' : ''}
                ${active  ? 'text-blue-600'    : ''}
                ${pending ? 'text-slate-400'   : ''}
              `}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 rounded transition-all duration-500
                ${stepsDone[STEPS[i + 1].key] || done ? 'bg-emerald-400' : active ? 'bg-blue-200' : 'bg-slate-200'}
              `} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function DeepDiveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
    </svg>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export default function App() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [deepDive, setDeepDive] = useState(false)
  const [loadingStates, setLoadingStates] = useState({})

  const handleAnalyze = async (url) => {
    setLoading(true)
    setResult(null)
    setError(null)
    setDeepDive(false)
    setLoadingStates({ outlet: true, analysis: true, source_reliability: true, corroboration: true })

    try {
      const apiBase = import.meta.env.VITE_API_URL ?? '/api'
      const res = await fetch(`${apiBase}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail || `Request failed with status ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const { type, data } = JSON.parse(line.slice(6))

            if (type === 'error') {
              setError(data.detail || 'Unknown error')
              setLoading(false)
              setLoadingStates({})
              return
            }
            if (type === 'title') {
              setResult(data)
              setLoading(false)
            }
            if (type === 'outlet') {
              setResult(prev => ({ ...prev, outlet: data }))
              setLoadingStates(prev => ({ ...prev, outlet: false }))
            }
            if (type === 'analysis') {
              setResult(prev => ({ ...prev, ...data }))
              setLoadingStates(prev => ({ ...prev, analysis: false }))
            }
            if (type === 'source_reliability') {
              setResult(prev => ({ ...prev, source_reliability: data }))
              setLoadingStates(prev => ({ ...prev, source_reliability: false }))
            }
            if (type === 'corroboration') {
              setResult(prev => ({ ...prev, corroboration: data }))
              setLoadingStates(prev => ({ ...prev, corroboration: false }))
            }
            if (type === 'done') {
              setLoadingStates({})
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
      setLoadingStates({})
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-1 flex items-center gap-3">
          <img src="/clearread-logo.svg" alt="ClearRead" className="h-20 cursor-pointer" onClick={() => window.location.reload()} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* URL input */}
        <UrlInput onAnalyze={handleAnalyze} loading={loading} />

        {/* Loading — initial fetch before title arrives */}
        {loading && (
          <div className="mt-16 flex flex-col items-center gap-4">
            <div className="relative w-12 h-12">
              <div className="w-12 h-12 border-4 border-slate-200 rounded-full" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-slate-600 font-medium">Analyzing article…</p>
            </div>
          </div>
        )}

        {/* Step progress — shown during initial load and while streaming */}
        {(loading || Object.values(loadingStates).some(Boolean)) && (
          <AnalysisProgress loading={loading} loadingStates={loadingStates} />
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-3 items-start">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-red-800">Could not analyze this article</p>
              <p className="text-red-600 text-sm mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="mt-8">
            {result.title && (
              <h2 className="text-lg font-semibold text-slate-700 mb-5 leading-snug">
                &ldquo;{result.title}&rdquo;
              </h2>
            )}
            {/* Deep Dive toggle */}
            <button
              onClick={() => setDeepDive(v => !v)}
              className="mb-5 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-600 shadow-sm"
            >
              <DeepDiveIcon />
              Deep Dive
              <ChevronIcon open={deepDive} />
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <ExplanationPanel data={result} deepDive={deepDive} loadingStates={loadingStates} />
              </div>
              <div className="lg:col-span-2">
                <ReliabilityPanel data={result} deepDive={deepDive} loadingStates={loadingStates} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="mt-20 text-center text-slate-400">
            <div className="w-16 h-16 mx-auto mb-5 bg-slate-100 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-slate-500">Paste a news article URL above</p>
            <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              ClearRead will explain the article in plain language and assess the reliability of the source outlet.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
