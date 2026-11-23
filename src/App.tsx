import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { ArrowRight, Check, CircleAlert, Mail, RotateCw, ShieldCheck, Sparkles } from 'lucide-react'

const CODE = '2468'
const WRONG = '1357'
const LEN = 4
const EMAIL_MASKED = 'al••••a@example.com'
const RESEND_SECONDS = 25

type Phase = 'input' | 'verifying' | 'error' | 'connecting' | 'merging' | 'leaving' | 'success'

/* Stage geometry (px) */
const STAGE_W = 304
const STAGE_H = 170
const CX = STAGE_W / 2
const CY = STAGE_H / 2
const BOX_W = 67
const BOX_H = 70
const STEP = 79
const SMALL = 54
const GRID = 57
/* typing order -> 2x2 corner: 1st top-left, 2nd bottom-left, 3rd top-right, 4th bottom-right */
const GRID_POS = [
  [-GRID, -GRID],
  [-GRID, GRID],
  [GRID, -GRID],
  [GRID, GRID],
]

const rowCenter = (i: number) => CX + (i - (LEN - 1) / 2) * STEP

function boxLayout(i: number, phase: Phase) {
  if (phase === 'input' || phase === 'error') {
    return { left: rowCenter(i) - BOX_W / 2, top: CY - BOX_H / 2, width: BOX_W, height: BOX_H }
  }
  if (phase === 'verifying' || phase === 'connecting') {
    const [dx, dy] = GRID_POS[i]
    return { left: CX + dx - SMALL / 2, top: CY + dy - SMALL / 2, width: SMALL, height: SMALL }
  }
  return { left: CX - SMALL / 2, top: CY - SMALL / 2, width: SMALL, height: SMALL }
}

const ease = [0.22, 1, 0.36, 1] as const

export default function App() {
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''))
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(false)
  const [phase, setPhase] = useState<Phase>('input')
  const [greenCount, setGreenCount] = useState(0)
  const [errorKey, setErrorKey] = useState(0)
  const [seconds, setSeconds] = useState(RESEND_SECONDS)
  const [verifiedAt, setVerifiedAt] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<number[]>([])

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const focusInput = useCallback(() => inputRef.current?.focus({ preventScroll: true }), [])

  useEffect(() => {
    focusInput()
    return clearTimers
  }, [focusInput, clearTimers])

  /* resend countdown */
  useEffect(() => {
    if (seconds <= 0) return
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])

  const verify = useCallback(
    (code: string) => {
      setPhase('verifying')
      inputRef.current?.blur()
      later(() => {
        if (code !== CODE) {
          setPhase('error')
          setErrorKey((k) => k + 1)
          later(() => {
            setDigits(Array(LEN).fill(''))
            setActive(0)
            setPhase('input')
            focusInput()
          }, 1500)
          return
        }
        setPhase('connecting')
        setGreenCount(0)
        for (let i = 1; i <= LEN; i++) later(() => setGreenCount(i), 90 + (i - 1) * 170)
        later(() => setPhase('merging'), 1150)
        later(() => setPhase("leaving"), 3050)
        later(() => {
          setVerifiedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
          setPhase('success')
        }, 3550)
      }, 1050)
    },
    [later, focusInput],
  )

  /* auto-submit when the code is complete */
  const full = digits.every((d) => d !== '')
  useEffect(() => {
    if (phase !== 'input' || !full) return
    const id = window.setTimeout(() => verify(digits.join('')), 380)
    return () => clearTimeout(id)
  }, [full, phase, digits, verify])

  const fill = useCallback(
    (text: string, start: number) => {
      const chars = text.replace(/\D/g, '').slice(0, LEN).split('')
      if (!chars.length) return
      const from = chars.length >= LEN ? 0 : start
      setDigits((prev) => {
        const next = [...prev]
        chars.forEach((c, k) => {
          if (from + k < LEN) next[from + k] = c
        })
        return next
      })
      setActive(Math.min(from + chars.length, LEN - 1))
    },
    [],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (phase !== 'input') return
    if (/^\d$/.test(e.key)) {
      e.preventDefault()
      fill(e.key, active)
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setDigits((prev) => {
        const next = [...prev]
        if (next[active]) {
          next[active] = ''
        } else if (active > 0) {
          next[active - 1] = ''
          setActive(active - 1)
        }
        return next
      })
    } else if (e.key === 'Delete') {
      e.preventDefault()
      setDigits((prev) => prev.map((d, k) => (k === active ? '' : d)))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setActive((a) => Math.min(LEN - 1, a + 1))
    } else if (e.key === 'Enter' && full) {
      e.preventDefault()
      verify(digits.join(''))
    }
  }

  const typeCode = (code: string) => {
    if (phase !== 'input') return
    clearTimers()
    setDigits(Array(LEN).fill(''))
    setActive(0)
    focusInput()
    code.split('').forEach((c, k) => {
      later(() => {
        setDigits((prev) => prev.map((d, j) => (j === k ? c : d)))
        setActive(Math.min(k + 1, LEN - 1))
      }, 160 + k * 170)
    })
  }

  const replay = () => {
    clearTimers()
    setDigits(Array(LEN).fill(''))
    setActive(0)
    setGreenCount(0)
    setSeconds(RESEND_SECONDS)
    setPhase('input')
    later(focusInput, 60)
  }

  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (phase !== 'input') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * STAGE_W
    const idx = Math.max(0, Math.min(LEN - 1, Math.floor(x / STEP)))
    const firstEmpty = digits.findIndex((d) => d === '')
    setActive(firstEmpty === -1 ? idx : Math.min(idx, firstEmpty))
    focusInput()
  }

  const inGrid = phase === 'verifying' || phase === 'connecting'
  const showInput = phase !== 'leaving' && phase !== 'success'
  const done = phase === 'leaving' || phase === 'success'

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-8">
        {/* background photo */}
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/living-room.webp)' }}
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease }}
        />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_40%,rgba(20,12,8,0.35)_100%)]" />

        <motion.section
          aria-label="Email verification"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease, delay: 0.15 }}
          className="glass-card relative h-[502px] w-full max-w-[420px] overflow-hidden rounded-[28px]"
        >
          {/* ---------- top icon (shared between screens) ---------- */}
          <div className="absolute left-1/2 top-8 z-10 h-[60px] w-[60px] -translate-x-1/2">
            <AnimatePresence mode="popLayout" initial={false}>
              {!done ? (
                <motion.div
                  key="mail"
                  className="absolute inset-0"
                  exit={{ opacity: 0, scale: 0.6, filter: 'blur(6px)' }}
                  transition={{ duration: 0.35 }}
                >
                  {(phase === 'connecting' || phase === 'merging') && (
                    <>
                      <motion.span
                        className="absolute -inset-3 rounded-full border border-white/10 bg-white/[0.02]"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, ease }}
                      />
                      <motion.span
                        className="absolute -inset-6 rounded-full border border-white/[0.06]"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, ease, delay: 0.08 }}
                      />
                    </>
                  )}
                  <div className="relative grid h-full w-full place-items-center rounded-full border border-white/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_24px_-8px_rgba(0,0,0,0.5)]">
                    <Mail className="h-[22px] w-[22px] text-white" strokeWidth={2} />
                    <AnimatePresence>
                      {phase !== 'verifying' && (
                        <motion.span
                          className="absolute right-[13px] top-[13px] h-[9px] w-[9px] rounded-full bg-[#F0513A] ring-2 ring-[#5a4a44]"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                  {phase === 'verifying' && (
                    <motion.svg
                      className="absolute -inset-[5px]"
                      viewBox="0 0 70 70"
                      initial={{ opacity: 0, rotate: 0 }}
                      animate={{ opacity: 1, rotate: 360 }}
                      transition={{ rotate: { duration: 0.85, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.2 } }}
                    >
                      <circle cx="35" cy="35" r="33.5" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="52 200" />
                    </motion.svg>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="ok"
                  className="absolute -inset-[5px]"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                >
                  {phase === 'success' &&
                    [0, 1].map((k) => (
                      <motion.span
                        key={k}
                        className="absolute inset-0 rounded-full border border-[#4ade80]/50"
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{ scale: 1.75, opacity: 0 }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: k * 1.1 }}
                      />
                    ))}
                  <span className="absolute -inset-3 rounded-full bg-[#22c55e]/10 blur-md" />
                  <div className="relative grid h-full w-full place-items-center rounded-full border border-white/30 bg-[linear-gradient(160deg,#5ee28f_0%,#22b25a_60%,#169a4b_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_30px_-6px_rgba(34,197,94,0.6)]">
                    <AnimatePresence>
                      {phase === 'success' && (
                        <motion.svg viewBox="0 0 24 24" className="h-7 w-7" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <motion.path
                            d="M5 12.5l4.2 4.2L19 7"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.45, ease, delay: 0.1 }}
                          />
                        </motion.svg>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ---------- screen 1 : check your inbox ---------- */}
          <AnimatePresence>
            {showInput && (
              <motion.div
                key="inbox"
                className="absolute inset-0 flex flex-col items-center px-5 pt-[111px] sm:px-8"
                exit={{ opacity: 0, filter: 'blur(14px)', scale: 0.98 }}
                transition={{ duration: 0.5, ease }}
              >
                <h1 className="text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-white">Check your inbox</h1>
                <p className="mt-1 text-center text-[14px] leading-[23px] text-white/70">
                  Enter the {LEN}-digit code we sent
                  <br />
                  to{' '}
                  <span className="glass-chip ml-0.5 inline-block rounded-lg px-2 py-[1px] font-semibold text-white">{EMAIL_MASKED}</span>
                </p>

                {/* stage */}
                <motion.div
                  key={errorKey}
                  className="relative mt-5 shrink-0"
                  style={{ width: STAGE_W, height: STAGE_H }}
                  animate={phase === 'error' ? { x: [0, -10, 10, -7, 7, -3, 0] } : { x: 0 }}
                  transition={{ duration: 0.45, delay: phase === 'error' ? 0.25 : 0 }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onStageClick(e)
                  }}
                >
                  <input
                    ref={inputRef}
                    value=""
                    onChange={(e) => phase === 'input' && fill(e.target.value, active)}
                    onKeyDown={onKeyDown}
                    onPaste={(e) => {
                      e.preventDefault()
                      if (phase === 'input') fill(e.clipboardData.getData('text'), active)
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label={`Verification code, ${LEN} digits. Digit ${active + 1} of ${LEN}`}
                    className="absolute inset-0 z-20 cursor-text opacity-0"
                    style={{ caretColor: 'transparent' }}
                  />

                  {/* connection lines */}
                  <svg className="pointer-events-none absolute inset-0 overflow-visible" width={STAGE_W} height={STAGE_H} aria-hidden>
                    <defs>
                      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="b" />
                        <feMerge>
                          <feMergeNode in="b" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <AnimatePresence>
                      {phase === 'connecting' &&
                        GRID_POS.map(([dx, dy], i) => (
                          <motion.line
                            key={i}
                            x1={CX + dx * 0.72}
                            y1={CY + dy * 0.72}
                            x2={CX}
                            y2={CY}
                            stroke="#9af5b8"
                            strokeWidth={2.6}
                            strokeLinecap="round"
                            filter="url(#glow)"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.25 } }}
                            transition={{ duration: 0.38, ease: 'easeOut', delay: 0.09 + i * 0.17 }}
                          />
                        ))}
                    </AnimatePresence>
                  </svg>
                  <AnimatePresence>
                    {(phase === 'connecting' || phase === 'merging') && (
                      <motion.span
                        className="pointer-events-none absolute h-3 w-3 rounded-full bg-white shadow-[0_0_14px_4px_rgba(160,255,190,0.85)]"
                        style={{ left: CX - 6, top: CY - 6 }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0, transition: { duration: 0.3 } }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.55 }}
                      />
                    )}
                  </AnimatePresence>

                  {/* focus ring + caret + orange glow */}
                  <AnimatePresence>
                    {phase === 'input' && focused && (
                      <motion.div
                        className="pointer-events-none absolute z-10"
                        initial={{ opacity: 0, left: rowCenter(active) - BOX_W / 2 }}
                        animate={{ opacity: 1, left: rowCenter(active) - BOX_W / 2 }}
                        exit={{ opacity: 0 }}
                        transition={{ left: { type: 'spring', stiffness: 520, damping: 36 }, opacity: { duration: 0.15 } }}
                        style={{ top: CY - BOX_H / 2, width: BOX_W, height: BOX_H }}
                      >
                        <span className="absolute -bottom-3 left-1/2 h-5 w-14 -translate-x-1/2 rounded-full bg-[#ff6a2b]/45 blur-[10px]" />
                        <span className="absolute inset-0 rounded-[14px] border-[1.5px] border-white/85 shadow-[0_0_0_4px_rgba(255,255,255,0.05),0_0_22px_rgba(255,255,255,0.12),inset_0_0_12px_rgba(255,255,255,0.06)]" />
                        {!digits[active] && (
                          <span className="caret absolute left-1/2 top-1/2 h-[26px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F26B3A]" />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* digit boxes */}
                  {digits.map((d, i) => {
                    const layout = boxLayout(i, phase)
                    const green = (phase === 'connecting' && greenCount > i) || phase === 'merging'
                    const red = phase === 'error'
                    const merging = phase === 'merging'
                    return (
                      <motion.div
                        key={i}
                        className="otp-box pointer-events-none absolute grid place-items-center overflow-hidden"
                        initial={false}
                        animate={{
                          ...layout,
                          borderRadius: inGrid || merging ? 13 : 14,
                          rotate: phase === 'verifying' ? [0, i % 2 ? 9 : -9, 0] : 0,
                          opacity: merging ? [1, 1, 0] : 1,
                          filter: merging ? ['blur(0px)', 'blur(0px)', 'blur(6px)'] : 'blur(0px)',
                          borderColor: red ? 'rgba(248,113,113,0.85)' : green ? 'rgba(134,239,172,0.55)' : 'rgba(255,255,255,0.16)',
                          boxShadow: green
                            ? '0 0 18px -2px rgba(74,222,128,0.55), inset 0 1px 0 rgba(255,255,255,0.18)'
                            : red
                              ? '0 0 18px -4px rgba(248,113,113,0.6), inset 0 1px 0 rgba(255,255,255,0.12)'
                              : '0 6px 18px -8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
                        }}
                        transition={
                          merging
                            ? { duration: 0.5, ease: [0.65, 0, 0.35, 1], delay: i * 0.03 }
                            : {
                                type: 'spring',
                                stiffness: 260,
                                damping: 24,
                                delay: phase === 'verifying' ? 0.05 + i * 0.07 : phase === 'error' ? i * 0.03 : 0,
                                rotate: { duration: 0.55, ease: 'easeInOut', delay: 0.05 + i * 0.07 },
                                borderColor: { duration: 0.25 },
                                boxShadow: { duration: 0.25 },
                              }
                        }
                      >
                        <motion.span
                          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(74,222,128,0.42),rgba(22,163,74,0.32))]"
                          initial={false}
                          animate={{ opacity: green ? 1 : 0 }}
                          transition={{ duration: 0.25 }}
                        />
                        <motion.span
                          className="absolute inset-0 bg-[rgba(239,68,68,0.16)]"
                          initial={false}
                          animate={{ opacity: red ? 1 : 0 }}
                          transition={{ duration: 0.2 }}
                        />
                        <AnimatePresence mode="popLayout">
                          {d && (
                            <motion.span
                              key={d + i}
                              className="relative font-semibold tabular-nums text-white"
                              initial={{ opacity: 0, y: 10, scale: 0.7 }}
                              animate={{ opacity: 1, y: 0, scale: 1, fontSize: inGrid || merging ? '24px' : '30px' }}
                              exit={{ opacity: 0, y: -6, scale: 0.8 }}
                              transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                            >
                              {d}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}

                  {/* merged square */}
                  <AnimatePresence>
                    {phase === 'merging' && (
                      <>
                        <motion.span
                          className="pointer-events-none absolute rounded-[32px] border border-white/12 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          style={{ left: CX - 66, top: CY - 66, width: 132, height: 132 }}
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1, 1.02, 1.08] }}
                          transition={{ duration: 1.1, delay: 0.55, times: [0, 0.3, 0.7, 1] }}
                        />
                        <motion.div
                          className="pointer-events-none absolute grid place-items-center rounded-[22px] border border-white/35 bg-[linear-gradient(160deg,#5ee28f_0%,#28b862_55%,#179c4d_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_0_36px_-4px_rgba(74,222,128,0.65)]"
                          style={{ left: CX - 43, top: CY - 43, width: 86, height: 86 }}
                          initial={{ opacity: 0, scale: 0.35, filter: 'blur(6px)' }}
                          animate={{ opacity: 1, scale: [0.35, 1.08, 1], filter: 'blur(0px)' }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.55, ease, delay: 0.35 }}
                        >
                          <motion.span
                            className="absolute h-[6px] w-[6px] rounded-full bg-white"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.4] }}
                            transition={{ duration: 0.45, delay: 0.6 }}
                          />
                          <svg viewBox="0 0 24 24" className="h-9 w-9">
                            <motion.path
                              d="M5 12.5l4.2 4.2L19 7"
                              fill="none"
                              stroke="#fff"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ duration: 0.4, ease, delay: 0.95 }}
                            />
                          </svg>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* primary button */}
                <VerifyButton phase={phase} full={full} onClick={() => full && phase === 'input' && verify(digits.join(''))} />

                {/* footer */}
                <div className="mt-[13px] h-5 text-[13.5px] leading-5">
                  <AnimatePresence mode="wait" initial={false}>
                    {phase === 'error' ? (
                      <motion.p
                        key="err"
                        role="alert"
                        className="flex items-center gap-1.5 font-medium text-[#fca5a5]"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        <CircleAlert className="h-4 w-4" /> That code doesn't match. Try again.
                      </motion.p>
                    ) : (
                      <motion.p
                        key="resend"
                        className="flex items-center gap-1.5 text-white/50"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        Didn't get a code?
                        {seconds > 0 ? (
                          <span className="ml-1 flex items-center gap-1.5 font-medium text-white/85">
                            <CountdownRing progress={seconds / RESEND_SECONDS} />
                            Resend in 0:{String(seconds).padStart(2, '0')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSeconds(RESEND_SECONDS)}
                            className="ml-1 flex items-center gap-1.5 font-medium text-white/90 underline-offset-4 transition hover:text-white hover:underline"
                          >
                            <RotateCw className="h-3.5 w-3.5" /> Resend code
                          </button>
                        )}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ---------- screen 2 : verified ---------- */}
          <AnimatePresence>
            {phase === 'success' && (
              <motion.div
                key="success"
                className="absolute inset-0 flex flex-col items-center px-5 pt-[137px] sm:px-8"
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, filter: 'blur(10px)' }}
                variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
              >
                <motion.h2 variants={fadeUp} className="text-[24px] font-semibold leading-[30px] tracking-[-0.01em]">
                  You're verified
                </motion.h2>
                <motion.p variants={fadeUp} className="mt-1.5 max-w-[300px] text-center text-[14px] leading-[20px] text-white/70">
                  Your email is confirmed and this browser is now trusted. Welcome back.
                </motion.p>
                <div className="mt-[21px] flex w-full flex-col gap-2.5">
                  <StatusRow icon={<Mail className="h-[17px] w-[17px]" />} title="Email confirmed" sub={EMAIL_MASKED} delay={0.45} />
                  <StatusRow
                    icon={<ShieldCheck className="h-[17px] w-[17px]" />}
                    title="Device trusted"
                    sub={`Verified at ${verifiedAt} · for 30 days`}
                    delay={0.6}
                  />
                </div>
                <motion.button
                  variants={fadeUp}
                  type="button"
                  onClick={replay}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-[17px] flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#f7f2ef] text-[15px] font-semibold text-[#2b2320] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]"
                >
                  Continue <ArrowRight className="h-[17px] w-[17px]" />
                </motion.button>
                <motion.button
                  variants={fadeUp}
                  type="button"
                  onClick={replay}
                  className="mt-[14px] flex items-center gap-1.5 text-[14px] font-medium text-white/75 transition hover:text-white"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Replay demo
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* demo dock */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.35 }}
          className="dock relative mt-3.5 flex h-[44px] items-center gap-1.5 rounded-full pl-4 pr-1.5 text-[13px]"
        >
          <Sparkles className="h-3.5 w-3.5 text-white/75" />
          <span className="text-white/75">Demo code</span>
          <span className="ml-1.5 mr-1.5 font-semibold tracking-[0.18em] text-white">{CODE}</span>
          <DockButton onClick={() => typeCode(WRONG)} disabled={phase !== 'input'}>
            Try wrong
          </DockButton>
          <DockButton onClick={() => typeCode(CODE)} disabled={phase !== 'input'}>
            Autofill
          </DockButton>
        </motion.div>
      </main>
    </MotionConfig>
  )
}

const fadeUp = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease } },
}

function VerifyButton({ phase, full, onClick }: { phase: Phase; full: boolean; onClick: () => void }) {
  const state =
    phase === 'verifying'
      ? 'verifying'
      : phase === 'connecting' || phase === 'merging'
        ? 'verified'
        : phase === 'error'
          ? 'error'
          : full
            ? 'ready'
            : 'idle'
  const bg = {
    idle: 'rgba(255,255,255,0.12)',
    ready: '#f7f2ef',
    verifying: '#f7f2ef',
    verified: '#2fbf63',
    error: 'rgba(239,68,68,0.22)',
  }[state]
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={state !== 'ready'}
      aria-live="polite"
      className="relative mt-[21px] h-[46px] w-full shrink-0 overflow-hidden rounded-xl border text-[15px] font-semibold"
      initial={false}
      animate={{
        backgroundColor: bg,
        borderColor: state === 'idle' ? 'rgba(255,255,255,0.14)' : state === 'error' ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.3)',
        color: state === 'idle' ? 'rgba(255,255,255,0.45)' : state === 'ready' || state === 'verifying' ? '#3a2f2a' : '#ffffff',
        boxShadow:
          state === 'verified'
            ? '0 10px 28px -10px rgba(34,197,94,0.75), inset 0 1px 0 rgba(255,255,255,0.35)'
            : state === 'ready' || state === 'verifying'
              ? '0 10px 26px -14px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.8)'
              : 'inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
      transition={{ duration: 0.3 }}
    >
      {state === 'verified' && (
        <span className="absolute inset-0 bg-[linear-gradient(90deg,#55e38a_0%,#2fbf63_55%,#1fa653_100%)]" />
      )}
      {(state === 'ready' || state === 'verifying') && (
        <span className="shimmer absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(190,170,160,0.35),transparent)]" />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state === 'ready' || state === 'idle' ? 'verify' : state}
          className="relative flex items-center justify-center gap-2"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {state === 'verifying' && (
            <>
              <motion.svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                <circle cx="10" cy="10" r="7.5" fill="none" stroke="rgba(58,47,42,0.2)" strokeWidth="2" />
                <circle cx="10" cy="10" r="7.5" fill="none" stroke="#3a2f2a" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 60" />
              </motion.svg>
              Verifying…
            </>
          )}
          {state === 'verified' && (
            <>
              <Check className="h-4 w-4" strokeWidth={3} /> Verified
            </>
          )}
          {state === 'error' && 'Incorrect code'}
          {(state === 'idle' || state === 'ready') && 'Verify code'}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

function CountdownRing({ progress }: { progress: number }) {
  const r = 6
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 16 16" className="h-[15px] w-[15px] -rotate-90">
      <circle cx="8" cy="8" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
      <motion.circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        animate={{ strokeDashoffset: c * (1 - progress) }}
        transition={{ duration: 1, ease: 'linear' }}
      />
    </svg>
  )
}

function StatusRow({ icon, title, sub, delay }: { icon: React.ReactNode; title: string; sub: string; delay: number }) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex h-[55px] items-center gap-2.5 sm:gap-3 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border border-white/12 bg-white/10 text-white/90">
        {icon}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[14px] font-semibold text-white">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] sm:text-[12.5px] text-white/55">{sub}</span>
      </span>
      <motion.span
        className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full bg-[linear-gradient(160deg,#5ee28f,#1fa653)] shadow-[0_0_12px_-2px_rgba(74,222,128,0.7)]"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18, delay }}
      >
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </motion.span>
    </motion.div>
  )
}

function DockButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className="h-8 rounded-full border border-white/10 bg-white/10 px-3.5 font-medium text-white/85 transition-colors hover:bg-[#f7f2ef] hover:text-[#2b2320] disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  )
}
