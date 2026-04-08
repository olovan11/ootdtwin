import { useEffect, useRef, useState } from 'react'
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
  fabric: string | null
  formality: number | null
  season: string | null
}

// ── Agent pipeline steps ────────────────────────────────────────
const AGENT_STEPS = [
  { emoji: '🔍', label: 'Intake Agent',   detail: 'Analyzing wardrobe...'          },
  { emoji: '🌤️', label: 'Context Agent',  detail: 'Fetching Lexington weather...'  },
  { emoji: '🧠', label: 'Style Agent',    detail: 'Applying Style DNA...'           },
  { emoji: '✨', label: 'Outfit Agent',   detail: 'Finalizing look...'              },
]
const STEP_DELAYS = [0, 1400, 2900, 4400]

// ── Category colors ─────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Top:       'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  Bottom:    'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  Shoes:     'bg-amber-500/20  text-amber-300  border border-amber-500/30',
  Outerwear: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  Accessory: 'bg-pink-500/20  text-pink-300   border border-pink-500/30',
}

// ── Formality badge ──────────────────────────────────────────────
function FormalityDot({ score }: { score: number | null }) {
  if (!score) return null
  const color = score >= 7 ? 'bg-indigo-400' : score >= 4 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500 ml-auto shrink-0">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {score}/10
    </span>
  )
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <div className={`rounded-full border-2 border-current border-r-transparent animate-spin inline-block ${className}`} />
  )
}

// ── Glass card ───────────────────────────────────────────────────
function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-800/40 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl ${className}`}>
      {children}
    </div>
  )
}

export default function App() {
  const [quizDone, setQuizDone] = useState(() => !!localStorage.getItem('ootd_quiz_done'))
  const [profile, setProfile] = useState<QuizAnswers | null>(() => {
    try { return JSON.parse(localStorage.getItem('ootd_profile') ?? 'null') }
    catch { return null }
  })

  const [items, setItems]       = useState<ClosetItem[]>([])
  const [weather, setWeather]   = useState<Weather | null>(null)
  const [weatherStatus, setWeatherStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  const [styling, setStyling]           = useState(false)
  const [activeStep, setActiveStep]     = useState(-1)
  const [recommendation, setRecommendation] = useState<string | null>(null)
  const [recommendError, setRecommendError] = useState<string | null>(null)
  const [feedback, setFeedback]         = useState<'up' | 'down' | null>(null)

  const [showUpload, setShowUpload] = useState(false)

  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

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
    setActiveStep(0)
    setRecommendation(null)
    setRecommendError(null)
    setFeedback(null)

    // Simulate per-agent status advances
    stepTimers.current.forEach(clearTimeout)
    stepTimers.current = STEP_DELAYS.slice(1).map((delay, i) =>
      setTimeout(() => setActiveStep(i + 1), delay)
    )

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
      stepTimers.current.forEach(clearTimeout)
      stepTimers.current = []
      setStyling(false)
      setActiveStep(-1)
    }
  }

  const handleFeedback = async (rating: 1 | 5) => {
    if (!recommendation || feedback) return
    setFeedback(rating === 5 ? 'up' : 'down')
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outfit: recommendation, rating }),
    }).catch(() => { /* best-effort */ })
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

  const hasItems        = items.length > 0
  const generateDisabled = !hasItems || styling

  // ── Dashboard ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">

      {/* ── Header ── */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👗</span>
            <div>
              <h1 className="text-base font-bold leading-none text-white">OOTD Twin</h1>
              <p className="text-xs text-slate-500 mt-0.5">AI Personal Stylist · Lexington, VA</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full">
                {profile.aesthetic}
              </span>
            )}
            <button
              onClick={() => setShowUpload(true)}
              className="text-xs bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              🎥 Scan Closet
            </button>
            <button
              onClick={handleResetQuiz}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Retake Quiz
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Video Upload Modal ── */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <GlassCard className="p-8 w-full max-w-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white">Scan Your Closet</h2>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-slate-500 hover:text-slate-300 text-2xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>
              <VideoUpload onAnalysisComplete={handleAnalysisComplete} />
            </GlassCard>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ════ LEFT COLUMN ════ */}
          <div className="flex flex-col gap-5">

            {/* ── Wardrobe card ── */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Your Wardrobe
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {hasItems ? 'Scanned by Intake Agent' : 'No items yet'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasItems && (
                    <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      {items.length} items
                    </span>
                  )}
                  <button
                    onClick={() => setShowUpload(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full transition-colors"
                  >
                    + Scan
                  </button>
                </div>
              </div>

              {/* Empty wardrobe CTA */}
              {!hasItems && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="w-full border border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-xl py-10 flex flex-col items-center gap-3 transition-all group"
                >
                  <span className="text-4xl">🎥</span>
                  <p className="text-sm font-medium text-slate-400 group-hover:text-indigo-300 transition-colors">
                    Film a walk-through of your closet
                  </p>
                  <p className="text-xs text-slate-600">
                    Intake Agent will tag every item automatically
                  </p>
                </button>
              )}

              {/* Wardrobe list */}
              {hasItems && (
                <ul className="space-y-1 max-h-[380px] overflow-y-auto -mr-1 pr-1">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <span
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                          CATEGORY_COLORS[item.category] ?? 'bg-white/10 text-slate-400'
                        }`}
                      >
                        {item.category}
                      </span>
                      <span className="text-sm text-slate-300 truncate">
                        {item.brand ?? <span className="italic text-slate-600">Unnamed</span>}
                      </span>
                      {item.fabric && (
                        <span className="text-xs text-slate-600 hidden sm:inline shrink-0">
                          {item.fabric}
                        </span>
                      )}
                      <FormalityDot score={item.formality} />
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>

            {/* ── Style DNA card ── */}
            {profile && (
              <GlassCard className="p-5 bg-gradient-to-br from-indigo-900/40 to-purple-900/30">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                  Style DNA
                </h2>
                <p className="text-xs text-slate-600 mb-4">Your aesthetic profile · managed by Style Agent</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: 'Aesthetic',   value: profile.aesthetic },
                    { label: 'Palette',     value: profile.palette   },
                    { label: 'Occasion',    value: profile.occasion  },
                    { label: 'Icon vibe',   value: profile.icon      },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/5 border border-white/[0.06] rounded-xl p-3">
                      <p className="text-slate-500 text-xs mb-0.5">{label}</p>
                      <p className="font-semibold text-slate-200 leading-snug">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-slate-500">
                    Style Agent is weighting your {profile.occasion} formality preference
                  </span>
                </div>
              </GlassCard>
            )}
          </div>

          {/* ════ RIGHT COLUMN ════ */}
          <div className="flex flex-col gap-5">

            {/* ── Weather card ── */}
            <GlassCard className="p-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Lexington, VA · Today
              </h2>
              {weatherStatus === 'loading' && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Spinner /> Fetching weather...
                </div>
              )}
              {weatherStatus === 'error' && (
                <p className="text-sm text-slate-500">
                  Weather unavailable — Context Agent will style without it.
                </p>
              )}
              {weather && (
                <div className="flex items-center gap-4">
                  <img
                    src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                    alt={weather.description}
                    className="w-16 h-16 opacity-90"
                  />
                  <div>
                    <p className="text-4xl font-bold text-white leading-none">{weather.temp}°F</p>
                    <p className="text-sm text-slate-400 capitalize mt-1">{weather.description}</p>
                    <p className="text-xs text-slate-600 mt-0.5">Feels like {weather.feels_like}°F</p>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* ── AI Stylist card ── */}
            <GlassCard className="p-5">
              <div className="mb-5">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  AI Stylist
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  4-Agent Pipeline · Claude Sonnet · Spring 2026 trends
                </p>
              </div>

              {/* ── Generate button ── */}
              <div className="relative group">
                <button
                  onClick={handleGenerate}
                  disabled={generateDisabled}
                  className={`
                    w-full flex items-center justify-center gap-3 rounded-xl px-4 py-4 font-bold text-base transition-all
                    ${generateDisabled && !styling
                      ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-dashed border-white/10'
                      : styling
                        ? 'bg-gradient-to-r from-indigo-600/80 to-purple-600/80 text-white cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
                    }
                  `}
                >
                  {!hasItems ? (
                    <>
                      <span className="text-lg">🔒</span>
                      <span className="text-sm">Scan your closet to unlock</span>
                    </>
                  ) : styling ? (
                    <>
                      <Spinner />
                      <span className="text-sm font-semibold">Running agents...</span>
                    </>
                  ) : (
                    '✨ Generate My Outfit'
                  )}
                </button>

                {!hasItems && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    Upload a closet video first
                  </div>
                )}
              </div>

              {/* Nudge */}
              {!hasItems && (
                <p className="text-center text-xs text-slate-600 mt-3">
                  Use{' '}
                  <button
                    onClick={() => setShowUpload(true)}
                    className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                  >
                    Scan Closet
                  </button>
                  {' '}to add your wardrobe
                </p>
              )}

              {/* ── Agent status log ── */}
              {styling && (
                <div className="mt-5 space-y-2">
                  {AGENT_STEPS.map((step, i) => {
                    const status =
                      activeStep < i  ? 'pending'
                      : activeStep === i ? 'running'
                      : 'done'
                    return (
                      <div
                        key={step.label}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-500 ${
                          status === 'running'
                            ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300'
                            : status === 'done'
                              ? 'text-slate-500'
                              : 'text-slate-700'
                        }`}
                      >
                        <span className={status === 'pending' ? 'grayscale opacity-30' : ''}>
                          {step.emoji}
                        </span>
                        <span className="font-medium">{step.label}</span>
                        <span className="text-current opacity-70">{step.detail}</span>
                        <span className="ml-auto">
                          {status === 'running' && <Spinner className="w-3 h-3" />}
                          {status === 'done'    && <span className="text-emerald-500">✓</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Error */}
              {recommendError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  {recommendError}
                </div>
              )}

              {/* ── Recommendation card ── */}
              {recommendation && (
                <div className="mt-5 p-5 bg-gradient-to-br from-indigo-900/40 to-purple-900/30 border border-indigo-500/20 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">✨</span>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                      Look of the Day
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {recommendation}
                  </p>

                  {/* ── Feedback row ── */}
                  <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                    {feedback ? (
                      <span className="text-xs text-slate-500">
                        {feedback === 'up' ? '✓ Glad you love it!' : '✓ Noted — Style Agent will learn from this.'}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">How's this look?</span>
                        <button
                          onClick={() => handleFeedback(5)}
                          className="text-lg hover:scale-110 transition-transform"
                          title="Love it"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => handleFeedback(1)}
                          className="text-lg hover:scale-110 transition-transform"
                          title="Not for me"
                        >
                          👎
                        </button>
                      </div>
                    )}
                    <button
                      onClick={handleGenerate}
                      disabled={styling}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors disabled:no-underline disabled:text-slate-600"
                    >
                      Generate another →
                    </button>
                  </div>
                </div>
              )}

              {/* Idle placeholder */}
              {hasItems && !recommendation && !recommendError && !styling && (
                <div className="mt-6 text-center py-8 text-slate-700">
                  <span className="text-5xl block mb-3">✨</span>
                  <p className="text-sm">
                    {items.length} pieces ready.<br />
                    Hit the button to run the pipeline.
                  </p>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </main>
    </div>
  )
}
