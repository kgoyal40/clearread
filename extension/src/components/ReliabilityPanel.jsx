// Political bias → display colour
const BIAS_CONFIG = {
  'Extreme Left':              { pill: 'bg-blue-900 text-white',         dot: 'bg-blue-900'   },
  'Left':                      { pill: 'bg-blue-600 text-white',         dot: 'bg-blue-600'   },
  'Left-Center':               { pill: 'bg-blue-200 text-blue-900',      dot: 'bg-blue-400'   },
  'Center':                    { pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  'Right-Center':              { pill: 'bg-orange-200 text-orange-900',  dot: 'bg-orange-400' },
  'Right':                     { pill: 'bg-orange-500 text-white',       dot: 'bg-orange-500' },
  'Extreme Right':             { pill: 'bg-red-700 text-white',          dot: 'bg-red-700'    },
  'Conspiracy / Pseudoscience':{ pill: 'bg-purple-600 text-white',       dot: 'bg-purple-600' },
  'Pro-Science':               { pill: 'bg-teal-500 text-white',         dot: 'bg-teal-500'   },
  'Satire':                    { pill: 'bg-yellow-400 text-yellow-900',  dot: 'bg-yellow-400' },
}
const BIAS_DEFAULT = { pill: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' }

// Factual reporting → bar config
const FACTUAL_CONFIG = {
  'VERY HIGH':      { bar: 'bg-emerald-500', width: 'w-full',    label: 'Very High',      text: 'text-emerald-700' },
  'HIGH':           { bar: 'bg-green-400',   width: 'w-4/5',     label: 'High',           text: 'text-green-700'   },
  'MOSTLY FACTUAL': { bar: 'bg-lime-400',    width: 'w-3/5',     label: 'Mostly Factual', text: 'text-lime-700'    },
  'MIXED':          { bar: 'bg-yellow-400',  width: 'w-2/5',     label: 'Mixed',          text: 'text-yellow-600'  },
  'LOW':            { bar: 'bg-orange-400',  width: 'w-1/4',     label: 'Low',            text: 'text-orange-600'  },
  'VERY LOW':       { bar: 'bg-red-500',     width: 'w-1/12',    label: 'Very Low',       text: 'text-red-600'     },
}

const STYLE_CONFIG = {
  news:    { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'News Style'    },
  opinion: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Opinion Style' },
  mixed:   { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'Mixed Style'   },
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
}

export default function ReliabilityPanel({ data, deepDive, loadingStates = {} }) {
  const { outlet, reliability_flags, domain, source_reliability } = data

  return (
    <div className="space-y-4">
      {/* Outlet card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 text-base mb-4">Source Reliability</h2>

        {loadingStates.outlet
          ? <div className="space-y-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /><Skeleton className="h-6 w-24 rounded-full" /><Skeleton className="h-2 w-full" /></div>
          : outlet?.found
            ? <OutletInfo outlet={outlet} />
            : <NotFoundNote outlet={outlet} domain={domain} />}

        {/* Source quality score */}
        {loadingStates.source_reliability
          ? <div className="mt-5 pt-4 border-t border-slate-100 space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-2 w-full" /></div>
          : source_reliability?.score != null && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <SourceQualityScore data={source_reliability} />
            </div>
          )}
      </div>

      {/* Content flags card — only shown in deep dive */}
      {deepDive && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 text-base mb-4">Content Flags</h2>
        <div className="space-y-4">
          <FlagRow
            label="Cites Sources"
            value={reliability_flags?.cites_sources}
            positiveIsTrue
            explanation={reliability_flags?.cites_sources_explanation}
          />
          <FlagRow
            label="Emotionally Loaded Language"
            value={reliability_flags?.emotionally_loaded_language}
            positiveIsTrue={false}
            explanation={reliability_flags?.emotionally_loaded_explanation}
          />
          <FramingIssues issues={reliability_flags?.framing_issues} />
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-600">Writing Style</span>
            <StyleBadge style={reliability_flags?.style} />
          </div>
        </div>
      </div>}
    </div>
  )
}

function OutletInfo({ outlet }) {
  const biasKey = outlet.bias_rating || ''
  const bias = BIAS_CONFIG[biasKey] ?? BIAS_DEFAULT
  const factualKey = (outlet.factual_reporting || '').toUpperCase()
  const factual = FACTUAL_CONFIG[factualKey] ?? null
  const isClaudeSource = outlet.source === 'claude'

  return (
    <div className="space-y-4">
      {/* Name + meta */}
      <div>
        <p className="font-semibold text-slate-800">{outlet.name}</p>
        {(outlet.country || outlet.media_type) && (
          <p className="text-xs text-slate-400 mt-0.5">
            {[outlet.media_type, outlet.country].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Bias rating */}
      <div>
        <Label>Political Bias</Label>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mt-1.5 ${bias.pill}`}>
          {outlet.bias_rating || 'Unknown'}
        </span>
      </div>

      {/* Factual reporting bar */}
      {factual && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label>Factual Reporting</Label>
            <span className={`text-xs font-semibold ${factual.text}`}>{factual.label}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-500 ${factual.bar} ${factual.width}`} />
          </div>
        </div>
      )}

      {/* Credibility */}
      {outlet.credibility_rating && outlet.credibility_rating !== 'Unknown' && (
        <div>
          <Label>{isClaudeSource ? 'Credibility' : 'MBFC Credibility'}</Label>
          <p className="text-sm text-slate-700 mt-0.5">{outlet.credibility_rating}</p>
        </div>
      )}

      {/* Claude summary */}
      {isClaudeSource && outlet.summary && (
        <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
          {outlet.summary}
        </p>
      )}

      {/* Claude disclaimer */}
      {isClaudeSource && (
        <div className="flex items-center gap-1.5 pt-1">
          <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-slate-400">Assessment by Claude AI, not a verified database</p>
        </div>
      )}
    </div>
  )
}

function NotFoundNote({ outlet, domain }) {
  let message
  if (outlet?.reason === 'no_api_key') {
    message = 'MBFC API key is not configured. Add RAPIDAPI_KEY to the backend .env file to enable outlet ratings.'
  } else if (outlet?.reason === 'api_error' || outlet?.reason === 'error') {
    message = 'Could not reach the MBFC database right now. The outlet reliability check is unavailable.'
  } else {
    message = `"${domain}" was not found in the Media Bias/Fact Check database. This outlet may be too small, regional, or new to be rated.`
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3">
      <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
    </div>
  )
}

const SOURCE_SCORE_CONFIG = {
  'Very High': { bar: 'bg-emerald-500', width: 'w-full',  text: 'text-emerald-700' },
  'High':      { bar: 'bg-green-400',   width: 'w-4/5',   text: 'text-green-700'   },
  'Medium':    { bar: 'bg-yellow-400',  width: 'w-3/5',   text: 'text-yellow-600'  },
  'Low':       { bar: 'bg-orange-400',  width: 'w-2/5',   text: 'text-orange-600'  },
  'Very Low':  { bar: 'bg-red-500',     width: 'w-1/5',   text: 'text-red-600'     },
}

function SourceQualityScore({ data }) {
  const { score, level, sources_assessed } = data
  const cfg = SOURCE_SCORE_CONFIG[level] ?? SOURCE_SCORE_CONFIG['Medium']
  const known = (sources_assessed || []).filter(s => s.known)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Source Quality Score</span>
        <span className={`text-xs font-semibold ${cfg.text}`}>{level} · {score.toFixed(2)}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-500 ${cfg.bar} ${cfg.width}`} />
      </div>
      {known.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {known.map((s, i) => {
            const isSocial = s.type === 'social_media'
            return (
              <span key={i} className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${isSocial ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                {isSocial && <span className="font-bold">@</span>}
                {s.name} · {s.score.toFixed(2)}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FramingIssues({ issues }) {
  const list = Array.isArray(issues) ? issues : []
  const hasIssues = list.length > 0

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">Language Framing</span>
        <span className={`flex items-center gap-1 text-sm font-semibold ${hasIssues ? 'text-orange-500' : 'text-emerald-600'}`}>
          {hasIssues
            ? <XIcon className="w-3.5 h-3.5 text-orange-400" />
            : <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />}
          {hasIssues ? `${list.length} issue${list.length > 1 ? 's' : ''}` : 'Neutral'}
        </span>
      </div>
      {hasIssues && (
        <div className="mt-2 max-h-56 overflow-y-auto space-y-2">
          {list.map((issue, i) => (
            <div key={i} className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <p className="text-xs font-medium text-orange-800 italic mb-1">"{issue.phrase}"</p>
              <p className="text-xs text-orange-700 leading-relaxed">{issue.explanation}</p>
              {issue.direction && (
                <p className="text-xs text-orange-500 mt-1 font-medium">{issue.direction}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FlagRow({ label, value, positiveIsTrue, explanation }) {
  // Determine if this flag state is "good" or "bad"
  const isGood = positiveIsTrue ? value === true : value === false

  const iconColor = isGood ? 'text-emerald-500' : 'text-red-400'
  const valueColor = isGood ? 'text-emerald-600' : 'text-red-500'
  const valueLabel = value ? 'Yes' : 'No'

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">{label}</span>
        <span className={`flex items-center gap-1 text-sm font-semibold ${valueColor}`}>
          {isGood
            ? <CheckIcon className={`w-3.5 h-3.5 ${iconColor}`} />
            : <XIcon className={`w-3.5 h-3.5 ${iconColor}`} />}
          {valueLabel}
        </span>
      </div>
      {explanation && (
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{explanation}</p>
      )}
    </div>
  )
}

function StyleBadge({ style }) {
  const cfg = STYLE_CONFIG[style] ?? STYLE_CONFIG.mixed
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function Label({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{children}</p>
  )
}

function CheckIcon({ className = 'w-4 h-4 text-emerald-500' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon({ className = 'w-4 h-4 text-red-400' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
