const CONTENT_TYPE_CONFIG = {
  news:          { label: 'News Report',     bg: 'bg-blue-100',   text: 'text-blue-800'   },
  opinion:       { label: 'Opinion',         bg: 'bg-purple-100', text: 'text-purple-800' },
  analysis:      { label: 'Analysis',        bg: 'bg-indigo-100', text: 'text-indigo-800' },
  satire:        { label: 'Satire',          bg: 'bg-yellow-100', text: 'text-yellow-800' },
  press_release: { label: 'Press Release',   bg: 'bg-orange-100', text: 'text-orange-800' },
  unknown:       { label: 'Unknown Type',    bg: 'bg-slate-100',  text: 'text-slate-600'  },
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
}

export default function ExplanationPanel({ data, deepDive, loadingStates = {} }) {
  const { article_analysis, plain_summary, corroboration } = data
  const contentType =
    CONTENT_TYPE_CONFIG[article_analysis?.content_type] ?? CONTENT_TYPE_CONFIG.unknown

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* Panel heading + content-type badge */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900 text-base">Article Explained</h2>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${contentType.bg} ${contentType.text}`}>
          {contentType.label}
        </span>
      </div>

      {/* Plain-language summary */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 min-h-[64px]">
        {loadingStates.analysis
          ? <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
          : <p className="text-sm text-blue-900 leading-relaxed">{plain_summary}</p>}
      </div>

      {/* Central claim */}
      <div className="rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600">
          <div className="text-indigo-200"><ClaimIcon /></div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Central Claim</h3>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 px-4 py-3 min-h-[48px]">
          {loadingStates.analysis
            ? <Skeleton className="h-4 w-3/4" />
            : <p className="text-sm font-medium text-indigo-950 leading-relaxed">{article_analysis?.central_claim || '—'}</p>}
        </div>
        {!loadingStates.corroboration && corroboration && article_analysis?.content_type !== 'opinion' && article_analysis?.content_type !== 'satire' && <CorroborationBar data={corroboration} />}
        {loadingStates.corroboration && article_analysis?.content_type !== 'opinion' && article_analysis?.content_type !== 'satire' && (
          <div className="border-t border-indigo-100 px-4 py-3 bg-slate-50"><Skeleton className="h-3 w-1/2" /></div>
        )}
      </div>


      {/* Collapsible sections */}
      {deepDive && (
        <div className="space-y-4">
          {/* Evidence */}
          <div className="rounded-xl border border-blue-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-600">
              <div className="text-blue-200"><EvidenceIcon /></div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Evidence Provided</h3>
            </div>
            <div className="max-h-56 overflow-y-auto p-4">
              <ScrollableList items={article_analysis?.evidence_provided} emptyText="No specific evidence cited." bulletColor="bg-blue-100 text-blue-600" />
            </div>
          </div>

          {/* What's missing */}
          <div className="rounded-xl border border-amber-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-400">
              <div className="text-amber-900"><MissingIcon /></div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">What's Missing</h3>
            </div>
            <div className="max-h-56 overflow-y-auto p-4 bg-amber-50">
              <ScrollableList items={article_analysis?.what_is_missing} emptyText="Nothing notable missing." bulletColor="bg-amber-100 text-amber-700" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CORROBORATION_CONFIG = {
  'Strong':        { bg: 'bg-emerald-500', label: 'Strongly Corroborated', text: 'text-emerald-700', light: 'bg-emerald-50 border-emerald-100' },
  'Moderate':      { bg: 'bg-green-400',   label: 'Moderately Corroborated', text: 'text-green-700',   light: 'bg-green-50 border-green-100'   },
  'Weak':          { bg: 'bg-yellow-400',  label: 'Weakly Corroborated',    text: 'text-yellow-700', light: 'bg-yellow-50 border-yellow-100' },
  'Single Source': { bg: 'bg-slate-400',   label: 'Single Source',          text: 'text-slate-600',  light: 'bg-slate-50 border-slate-200'   },
  'Contradicted':  { bg: 'bg-red-500',     label: 'Contradicted',           text: 'text-red-700',    light: 'bg-red-50 border-red-100'       },
}

function CorroborationBar({ data }) {
  const cfg = CORROBORATION_CONFIG[data.level] ?? CORROBORATION_CONFIG['Single Source']

  return (
    <div className={`border-t border-indigo-100 px-4 py-3 ${cfg.light} border`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Corroboration</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} text-white`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed mb-2">{data.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {data.supporting?.map((s, i) => (
          <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{s}</span>
        ))}
        {data.contradicting?.map((s, i) => (
          <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{s}</span>
        ))}
      </div>
    </div>
  )
}

function ScrollableList({ items, emptyText, bulletColor }) {
  const list = Array.isArray(items)
    ? items
    : typeof items === 'string' && items
      ? [items]
      : []

  if (list.length === 0) {
    return <p className="text-sm text-slate-400 italic">{emptyText}</p>
  }

  return (
    <ol className="space-y-2">
      {list.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
          <span className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${bulletColor}`}>
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

function ClaimIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  )
}

function EvidenceIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function MissingIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

