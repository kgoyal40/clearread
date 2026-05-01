import { useState } from 'react'
import ExplanationPanel from './components/ExplanationPanel'
import ReliabilityPanel from './components/ReliabilityPanel'

const API_BASE = 'https://clearread-production-b455.up.railway.app'

const STEPS = [
  { key: 'fetch',         label: 'Reading page'       },
  { key: 'analysis',      label: 'Analysing'          },
  { key: 'reliability',   label: 'Source check'       },
  { key: 'corroboration', label: 'Corroborating'      },
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
    <div className="flex items-center gap-0 mt-4 mb-2 px-1">
      {STEPS.map((step, i) => {
        const done = stepsDone[step.key]
        const active = i === activeIndex
        const pending = !done && !active
        return (
          <div key={step.key} className="flex items-center gap-0 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300
                ${done ? 'bg-emerald-500' : ''} ${active ? 'bg-blue-600' : ''} ${pending ? 'bg-slate-200' : ''}
              `}>
                {done && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                {active && <svg className="w-3 h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>}
                {pending && <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-300
                ${done ? 'text-emerald-600' : ''} ${active ? 'text-blue-600' : ''} ${pending ? 'text-slate-400' : ''}
              `}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 rounded transition-all duration-500
                ${stepsDone[STEPS[i + 1].key] || done ? 'bg-emerald-400' : active ? 'bg-blue-200' : 'bg-slate-200'}
              `} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function SidePanelApp() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const deepDive = true
  const [loadingStates, setLoadingStates] = useState({})

  const handleAnalyze = async () => {
    setLoading(true)
    setResult(null)
    setError(null)
    setLoadingStates({ outlet: true, analysis: true, source_reliability: true, corroboration: true })

    try {
      // Ask background script to extract article from current tab
      const extracted = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'EXTRACT_ARTICLE' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (response?.error) {
            reject(new Error(response.error))
          } else {
            resolve(response)
          }
        })
      })

      if (!extracted.text || extracted.text.length < 100) {
        throw new Error('Could not extract enough text from this page. Try a different article.')
      }

      const body = {
        url: extracted.url,
        article_text: extracted.text,
        title: extracted.title,
      }

      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-base">
          <span className="text-[#0F6E56]">Un</span><span className="text-[#534AB7]">slant</span>
        </h1>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F6E56] hover:bg-[#0b5a46] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-sm font-semibold shadow-sm"
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          {loading ? 'Analysing…' : 'Analyse Page'}
        </button>
      </div>

      <div className="px-3 py-4 space-y-4">
        {/* Step progress */}
        {(loading || Object.values(loadingStates).some(Boolean)) && (
          <AnalysisProgress loading={loading} loadingStates={loadingStates} />
        )}

        {/* Error */}
        {error && !loading && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2 items-start">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-red-800 text-sm">Could not analyse</p>
              <p className="text-red-600 text-xs mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {result.title && (
              <h2 className="text-sm font-semibold text-slate-700 leading-snug">
                &ldquo;{result.title}&rdquo;
              </h2>
            )}

            <ExplanationPanel data={result} deepDive={deepDive} loadingStates={loadingStates} />
            <ReliabilityPanel data={result} deepDive={deepDive} loadingStates={loadingStates} />
          </>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="mt-12 text-center text-slate-400 px-4">
            <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-500">Navigate to a news article</p>
            <p className="text-xs mt-2 leading-relaxed">
              Click <strong>Analyse Page</strong> to get a plain-language breakdown and reliability assessment.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
