import { useEffect, useState } from 'react'
import StyleQuiz, { type QuizAnswers } from './components/StyleQuiz'
import VideoUpload from './components/VideoUpload'

type Weather = {
  city: string
  temp: number
  feels_like: number
  description: string
  icon: string
}

type ClosetItem = {
  id: string
  category: string
  brand: string | null
  color: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  Top:       'bg-blue-100 text-blue-700',
  Bottom:    'bg-violet-100 text-violet-700',
  Shoes:     'bg-amber-100 text-amber-700',
  Outerwear: 'bg-emerald-100 text-emerald-700',
  Accessory: 'bg-pink-100 text-pink-700',
}

function Spinner() {
  return (
    <div className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin inline-block" />
  )
}

export default function App() {
  const [quizDone, setQuizDone] = useState(() => !!localStorage.getItem('ootd_quiz_done'))
  const [profile, setProfile] = useState<QuizAnswers | null>(() => {
    try { return JSON.parse(localStorage.getItem('ootd_profile') ?? 'null') }
    catch { return null }
  })

  const [items, setItems] = useState<ClosetItem[]>([])
  const [weather, setWeather] = useState<Weather | null>(null)
  const [weatherStatus, setWeatherStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  const [styling, setStyling] = useState(false)
  const [stylingPhase, setStylingPhase] = useState('')
  const [recommendation, setRecommendation] = useState<string | null>(null)
  const [recommendError, setRecommendError] = useState<string | null>(null)

  const [showUpload, setShowUpload] = useState(false)

  const fetchItems = async () => {
    const data = await fetch('/api/closet').then((r) => r.json())
    setItems(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    fetch('/api/weather')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setWeatherStatus('error')
        else { setWeather(data); setWeatherStatus('ok') }
      })
      .catch(() => setWeatherStatus('error'))
  }, [])

  useEffect(() => {
    if (quizDone) fetchItems()
  }, [quizDone])

  const handleQuizComplete = (answers: QuizAnswers) => {
    setProfile(answers)
    setQuizDone(true)
  }

  const handleAnalysisComplete = () => {
    setShowUpload(false)
    fetchItems()
  }

  const handleGenerate = async () => {
    setStyling(true)
    setStylingPhase('Scanning your wardrobe...')
    setRecommendation(null)
    setRecommendError(null)

    const phaseTimer = setTimeout(() => setStylingPhase('Consulting your stylist...'), 1500)

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weather }),
      })
      const data = await res.json()
      if (data.error) setRecommendError(data.error)
      else setRecommendation(data.advice)
    } catch {
      setRecommendError('Could not reach the AI service.')
    } finally {
      clearTimeout(phaseTimer)
      setStyling(false)
      setStylingPhase('')
    }
  }

  const handleResetQuiz = () => {
    localStorage.removeItem('ootd_quiz_done')
    localStorage.removeItem('ootd_profile')
    setQuizDone(false)
    setProfile(null)
    setRecommendation(null)
  }

  // ── Quiz screen ──────────────────────────────────────────────────
  if (!quizDone) {
    return <StyleQuiz onComplete={handleQuizComplete} />
  }

  // ── Derived state ────────────────────────────────────────────────
  const hasItems = items.length > 0
  // Button is locked if no items or currently generating
  const generateDisabled = !hasItems || styling

  // ── Dashboard ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👗</span>
            <div>
              <h1 className="text-base font-bold leading-none text-slate-900">OOTD Twin</h1>
              <p className="text-xs text-slate-400 mt-0.5">AI Personal Stylist · Lexington, VA</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full">
                {profile.aesthetic}
              </span>
            )}
            <button
              onClick={() => setShowUpload(true)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              🎥 Scan Closet
            </button>
            <button
              onClick={handleResetQuiz}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Retake Quiz
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Video Upload Modal ── */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 w-full max-w-xl shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800">Scan Your Closet</h2>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <VideoUpload onAnalysisComplete={handleAnalysisComplete} />
            </div>
          </div>
        )}

        {/* ── Two-column dashboard (always visible after quiz) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ════ LEFT COLUMN ════ */}
          <div className="flex flex-col gap-5">

            {/* Wardrobe card */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                    Your Wardrobe
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {hasItems ? 'Detected from your closet video' : 'No items yet'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasItems && (
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {items.length} items
                    </span>
                  )}
                  <button
                    onClick={() => setShowUpload(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    + Scan
                  </button>
                </div>
              </div>

              {/* Empty wardrobe CTA */}
              {!hasItems && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="w-full border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl py-10 flex flex-col items-center gap-3 transition-all group"
                >
                  <span className="text-4xl">🎥</span>
                  <p className="text-sm font-medium text-slate-500 group-hover:text-indigo-600 transition-colors">
                    Film a walk-through of your closet
                  </p>
                  <p className="text-xs text-slate-400">
                    Claude will identify every item automatically
                  </p>
                </button>
              )}

              {/* Wardrobe list */}
              {hasItems && (
                <ul className="space-y-1.5 max-h-[380px] overflow-y-auto -mr-1 pr-1">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <span
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                          CATEGORY_COLORS[item.category] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.category}
                      </span>
                      <span className="text-sm text-slate-700 truncate">
                        {item.brand ?? <span className="italic text-slate-400">Unnamed</span>}
                      </span>
                      {item.color && (
                        <span className="ml-auto text-xs text-slate-400 shrink-0 capitalize">
                          {item.color}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Style DNA card — only shown once quiz is done */}
            {profile && (
              <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Your Style DNA
                </h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: 'Aesthetic',  value: profile.aesthetic },
                    { label: 'Palette',    value: profile.palette   },
                    { label: 'Occasion',   value: profile.occasion  },
                    { label: 'Icon vibe',  value: profile.icon      },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/10 rounded-lg p-2.5">
                      <p className="text-slate-400 text-xs">{label}</p>
                      <p className="font-semibold leading-snug mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ════ RIGHT COLUMN ════ */}
          <div className="flex flex-col gap-5">

            {/* Weather card */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Lexington, VA · Today
              </h2>
              {weatherStatus === 'loading' && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Spinner /> Fetching weather...
                </div>
              )}
              {weatherStatus === 'error' && (
                <p className="text-sm text-slate-400">
                  Weather unavailable — the AI will style without it.
                </p>
              )}
              {weather && (
                <div className="flex items-center gap-4">
                  <img
                    src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                    alt={weather.description}
                    className="w-16 h-16"
                  />
                  <div>
                    <p className="text-4xl font-bold text-slate-800 leading-none">{weather.temp}°F</p>
                    <p className="text-sm text-slate-500 capitalize mt-1">{weather.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Feels like {weather.feels_like}°F</p>
                  </div>
                </div>
              )}
            </section>

            {/* AI Stylist card */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="mb-5">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                  AI Stylist
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Claude · Sonnet · {profile?.aesthetic ?? 'Personal'} aesthetic · Spring 2026 trends
                </p>
              </div>

              {/* ── Generate button — locked until wardrobe has items ── */}
              <div className="relative group">
                <button
                  onClick={handleGenerate}
                  disabled={generateDisabled}
                  className={`
                    w-full flex items-center justify-center gap-3 rounded-xl px-4 py-4 font-bold text-base transition-all
                    ${generateDisabled && !styling
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-dashed border-slate-200'
                      : styling
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white cursor-not-allowed shadow-md'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                    }
                  `}
                >
                  {styling ? (
                    <>
                      <Spinner />
                      <span className="text-sm font-semibold">{stylingPhase}</span>
                    </>
                  ) : !hasItems ? (
                    <>
                      <span className="text-lg">🔒</span>
                      <span className="text-sm">Scan your closet to unlock</span>
                    </>
                  ) : (
                    '✨ Generate My Outfit'
                  )}
                </button>

                {/* Tooltip on locked state */}
                {!hasItems && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    Upload a closet video first
                  </div>
                )}
              </div>

              {/* Unlock nudge below button */}
              {!hasItems && (
                <p className="text-center text-xs text-slate-400 mt-3">
                  Use{' '}
                  <button
                    onClick={() => setShowUpload(true)}
                    className="text-indigo-500 hover:text-indigo-700 underline transition-colors"
                  >
                    Scan Closet
                  </button>
                  {' '}to add your wardrobe
                </p>
              )}

              {/* Error */}
              {recommendError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                  {recommendError}
                </div>
              )}

              {/* Result card */}
              {recommendation && (
                <div className="mt-5 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">✨</span>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                      Look of the Day
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {recommendation}
                  </p>
                  <button
                    onClick={handleGenerate}
                    disabled={styling}
                    className="mt-4 text-xs text-indigo-500 hover:text-indigo-700 underline transition-colors disabled:no-underline disabled:text-slate-400"
                  >
                    Generate another look →
                  </button>
                </div>
              )}

              {/* Idle placeholder */}
              {hasItems && !recommendation && !recommendError && !styling && (
                <div className="mt-6 text-center py-8 text-slate-300">
                  <span className="text-5xl block mb-3">✨</span>
                  <p className="text-sm">
                    {items.length} pieces ready.<br />
                    Hit the button for today's look.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
