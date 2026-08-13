'use client'

export type ToastSoundKind = 'success' | 'error' | 'info'
export type ToastSoundStyle = 'chime' | 'beep' | 'ping'

export const TOAST_SOUND_STYLES: {
  id: ToastSoundStyle
  label: string
  description: string
}[] = [
  { id: 'chime', label: '종소리', description: '맑은 두 음' },
  { id: 'beep', label: '전자음', description: '또렷한 비프' },
  { id: 'ping', label: '핑', description: '짧고 강한 한 번' },
]

const STORAGE_KEY = 'mirae.toastSoundStyle'
const DEFAULT_STYLE: ToastSoundStyle = 'chime'

let sharedAudioContext: AudioContext | null = null
let rememberedStyle: ToastSoundStyle | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx()
  }
  return sharedAudioContext
}

function isToastSoundStyle(value: string): value is ToastSoundStyle {
  return value === 'chime' || value === 'beep' || value === 'ping'
}

export function getToastSoundStyle(): ToastSoundStyle {
  if (rememberedStyle) return rememberedStyle
  if (typeof window === 'undefined') return DEFAULT_STYLE
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && isToastSoundStyle(stored)) {
      rememberedStyle = stored
      return stored
    }
  } catch {
    // localStorage 차단 시 기본값
  }
  return DEFAULT_STYLE
}

export function setToastSoundStyle(style: ToastSoundStyle) {
  rememberedStyle = style
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, style)
  } catch {
    // localStorage 차단 시 메모리만 유지
  }
}

function toastTonePlan(kind: ToastSoundKind, style: ToastSoundStyle) {
  if (style === 'beep') {
    if (kind === 'success') {
      return {
        type: 'square' as OscillatorType,
        peak: 0.22,
        tones: [
          { freq: 980, start: 0, dur: 0.08 },
          { freq: 1310, start: 0.08, dur: 0.1 },
        ],
      }
    }
    if (kind === 'error') {
      return {
        type: 'square' as OscillatorType,
        peak: 0.24,
        tones: [
          { freq: 360, start: 0, dur: 0.11 },
          { freq: 280, start: 0.12, dur: 0.14 },
        ],
      }
    }
    return {
      type: 'square' as OscillatorType,
      peak: 0.2,
      tones: [{ freq: 820, start: 0, dur: 0.09 }],
    }
  }

  if (style === 'ping') {
    if (kind === 'success') {
      return {
        type: 'triangle' as OscillatorType,
        peak: 0.28,
        tones: [{ freq: 1400, start: 0, dur: 0.16 }],
      }
    }
    if (kind === 'error') {
      return {
        type: 'triangle' as OscillatorType,
        peak: 0.28,
        tones: [
          { freq: 520, start: 0, dur: 0.1 },
          { freq: 390, start: 0.11, dur: 0.14 },
        ],
      }
    }
    return {
      type: 'triangle' as OscillatorType,
      peak: 0.24,
      tones: [{ freq: 1100, start: 0, dur: 0.12 }],
    }
  }

  // chime — 기본, 종소리처럼 두 음
  if (kind === 'success') {
    return {
      type: 'triangle' as OscillatorType,
      peak: 0.3,
      tones: [
        { freq: 1046, start: 0, dur: 0.14 },
        { freq: 1568, start: 0.09, dur: 0.2 },
      ],
    }
  }
  if (kind === 'error') {
    return {
      type: 'triangle' as OscillatorType,
      peak: 0.32,
      tones: [
        { freq: 466, start: 0, dur: 0.14 },
        { freq: 349, start: 0.12, dur: 0.2 },
      ],
    }
  }
  return {
    type: 'triangle' as OscillatorType,
    peak: 0.26,
    tones: [{ freq: 880, start: 0, dur: 0.14 }],
  }
}

/** 짧은 알림음 — 외부 파일 없이 Web Audio로 재생 */
export function playToastSound(kind: ToastSoundKind, style?: ToastSoundStyle) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const resolvedStyle = style ?? getToastSoundStyle()

    void ctx.resume().then(() => {
      const now = ctx.currentTime
      const plan = toastTonePlan(kind, resolvedStyle)
      const master = ctx.createGain()
      master.gain.setValueAtTime(0.0001, now)
      master.connect(ctx.destination)

      const last = plan.tones[plan.tones.length - 1]
      const endAt = now + last.start + last.dur + 0.05
      master.gain.exponentialRampToValueAtTime(plan.peak, now + 0.015)
      master.gain.exponentialRampToValueAtTime(0.0001, endAt)

      for (const tone of plan.tones) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = plan.type
        osc.frequency.setValueAtTime(tone.freq, now + tone.start)
        gain.gain.setValueAtTime(0.0001, now + tone.start)
        gain.gain.exponentialRampToValueAtTime(1, now + tone.start + 0.012)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur)
        osc.connect(gain)
        gain.connect(master)
        osc.start(now + tone.start)
        osc.stop(now + tone.start + tone.dur + 0.03)
      }
    })
  } catch {
    // 오디오 미지원·자동재생 차단 시 무시
  }
}
