import { useRef, useState } from 'react'

type Props = {
  onAnalysisComplete: () => void
}

type Phase = 'idle' | 'extracting' | 'analyzing' | 'saving' | 'done' | 'error'

// Extract frames from a video file using the Canvas API
async function extractFrames(file: File, maxFrames = 6): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) { reject(new Error('Canvas not supported')); return }

    video.playsInline = true
    video.muted = true
    video.preload = 'metadata'
    video.src = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      // Resize to max 768px keeping aspect ratio
      const MAX = 768
      const scale = Math.min(MAX / video.videoWidth, MAX / video.videoHeight, 1)
      canvas.width  = Math.round(video.videoWidth  * scale)
      canvas.height = Math.round(video.videoHeight * scale)

      const duration = video.duration
      const interval = Math.max(duration / maxFrames, 0.5)
      const timestamps: number[] = []
      for (let t = 0.5; t < duration && timestamps.length < maxFrames; t += interval) {
        timestamps.push(t)
      }

      const frames: string[] = []
      let idx = 0

      const capture = () => {
        if (idx >= timestamps.length) {
          URL.revokeObjectURL(video.src)
          resolve(frames)
          return
        }
        video.currentTime = timestamps[idx]
      }

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78)
        frames.push(dataUrl.split(',')[1])
        idx++
        capture()
      }

      video.onerror = () => reject(new Error('Video load error'))
      capture()
    }

    video.onerror = () => reject(new Error('Video load error'))
  })
}

const PHASE_LABELS: Record<Phase, string> = {
  idle:       '',
  extracting: 'Reading your video...',
  analyzing:  'Identifying clothing items...',
  saving:     'Saving to your wardrobe...',
  done:       'Wardrobe updated!',
  error:      'Something went wrong',
}

export default function VideoUpload({ onAnalysisComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragging, setDragging] = useState(false)

  const processFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setErrorMsg('Please upload a video file.')
      setPhase('error')
      return
    }

    try {
      setPhase('extracting')
      const frames = await extractFrames(file)

      setPhase('analyzing')
      const res = await fetch('/api/analyze/closet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Server error')
      }

      setPhase('saving')
      const data = await res.json()
      setCount(data.count ?? 0)

      await new Promise((r) => setTimeout(r, 600))
      setPhase('done')
      setTimeout(onAnalysisComplete, 1200)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setPhase('error')
    }
  }

  const handleFile = (file: File | null | undefined) => {
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const isProcessing = ['extracting', 'analyzing', 'saving'].includes(phase)

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && inputRef.current?.click()}
        className={`
          w-full max-w-xl border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer
          ${isProcessing ? 'cursor-default border-indigo-400 bg-indigo-50' : ''}
          ${dragging ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : ''}
          ${phase === 'idle' ? 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50' : ''}
          ${phase === 'done'  ? 'border-emerald-400 bg-emerald-50' : ''}
          ${phase === 'error' ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        {/* Idle */}
        {phase === 'idle' && (
          <>
            <div className="text-6xl mb-4">🎥</div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">
              Upload a video of your closet
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Walk through your wardrobe — Claude will identify every item automatically
            </p>
            <span className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              Choose Video
            </span>
            <p className="text-xs text-slate-400 mt-3">or drag & drop a video file here</p>
          </>
        )}

        {/* Processing */}
        {isProcessing && (
          <>
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-indigo-700 mb-1">
              {PHASE_LABELS[phase]}
            </h3>
            <p className="text-sm text-slate-500">
              {phase === 'extracting' && 'Pulling frames from your video...'}
              {phase === 'analyzing' && 'Claude is scanning your wardrobe...'}
              {phase === 'saving' && 'Adding items to your closet...'}
            </p>
          </>
        )}

        {/* Done */}
        {phase === 'done' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-emerald-700 mb-1">
              {count} item{count !== 1 ? 's' : ''} found!
            </h3>
            <p className="text-sm text-slate-500">Loading your dashboard...</p>
          </>
        )}

        {/* Error */}
        {phase === 'error' && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-base font-semibold text-red-600 mb-2">{errorMsg}</h3>
            <button
              onClick={(e) => { e.stopPropagation(); setPhase('idle'); setErrorMsg('') }}
              className="text-sm text-indigo-600 underline"
            >
              Try again
            </button>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
