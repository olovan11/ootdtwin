import { useState } from 'react'

export type QuizAnswers = {
  aesthetic: string
  palette: string
  occasion: string
  priority: string
  icon: string
}

const STEPS = [
  {
    question: "What's your style vibe?",
    field: 'aesthetic' as const,
    options: ['Minimalist', 'Classic', 'Streetwear', 'Bohemian', 'Preppy', 'Bold'],
    emoji: ['🤍', '👔', '🧢', '🌸', '⚓', '🔥'],
  },
  {
    question: 'Your color palette?',
    field: 'palette' as const,
    options: ['Neutrals & Earth', 'Pastels & Soft', 'Bold & Bright', 'Dark & Moody', 'Mix Everything'],
    emoji: ['🤎', '🌸', '🌈', '🖤', '🎨'],
  },
  {
    question: 'You mainly dress for?',
    field: 'occasion' as const,
    options: ['Casual every day', 'Work & professional', 'Nights out', 'All occasions'],
    emoji: ['☕', '💼', '✨', '🌟'],
  },
  {
    question: 'Your style priority?',
    field: 'priority' as const,
    options: ['Maximum comfort', 'Maximum style', 'The perfect balance'],
    emoji: ['😌', '💅', '⚖️'],
  },
  {
    question: 'Which icon matches your energy?',
    field: 'icon' as const,
    options: ['Clean & Minimal', 'Edgy & Cool', 'Classic & Polished', 'Eclectic & Bold', 'Sporty & Fresh'],
    emoji: ['🧊', '🖤', '💎', '🦚', '⚡'],
  },
]

type Props = { onComplete: (answers: QuizAnswers) => void }

export default function StyleQuiz({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({})
  const [saving, setSaving] = useState(false)

  const current = STEPS[step]
  const progress = ((step) / STEPS.length) * 100

  const handleSelect = async (option: string) => {
    const updated = { ...answers, [current.field]: option }
    setAnswers(updated)

    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      // Final step — save and complete
      setSaving(true)
      try {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        })
      } catch { /* best-effort */ }
      localStorage.setItem('ootd_quiz_done', '1')
      localStorage.setItem('ootd_profile', JSON.stringify(updated))
      onComplete(updated as QuizAnswers)
    }
  }

  if (saving) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">✨</div>
          <p className="text-white text-xl font-semibold">Building your style profile...</p>
          <p className="text-slate-400 text-sm mt-2">This only takes a second</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6">
      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Style Quiz</span>
          <span>{step + 1} / {STEPS.length}</span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">{current.question}</h1>
          <p className="text-slate-400 text-sm">Pick the one that feels most like you</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {current.options.map((option, i) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              className="flex items-center gap-4 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500 rounded-2xl text-left transition-all group"
            >
              <span className="text-2xl">{current.emoji[i]}</span>
              <span className="text-white font-medium group-hover:text-indigo-300 transition-colors">
                {option}
              </span>
            </button>
          ))}
        </div>

        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="mt-6 text-slate-500 hover:text-slate-300 text-sm w-full text-center transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Branding */}
      <div className="mt-12 text-center">
        <p className="text-slate-600 text-xs">👗 OOTD Twin · Your AI Personal Stylist</p>
      </div>
    </div>
  )
}
