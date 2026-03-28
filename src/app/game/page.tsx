'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface Level {
  name: string
  subtitle: string
  pitchSpeedMin: number   // mph
  pitchSpeedMax: number
  pitchTypes: PitchType[]
  fenceDistance: number    // feet
  requiredHR: number
  totalABs: number
  strikeZoneSize: number  // multiplier (1 = standard)
  bgColor: string
  accentColor: string
}

type PitchType = 'fastball' | 'changeup' | 'slider' | 'curveball' | 'cutter'

interface PitchConfig {
  name: string
  speedMult: number
  horizMovement: number  // pixels of late break
  vertMovement: number
  color: string
}

type GameScreen =
  | 'MENU'
  | 'LEVEL_INTRO'
  | 'AT_BAT'
  | 'PITCHING'
  | 'SWING_RESULT'
  | 'LEVEL_COMPLETE'
  | 'LEVEL_FAILED'
  | 'CAREER_COMPLETE'

interface AtBatResult {
  type: 'HR' | 'TRIPLE' | 'DOUBLE' | 'SINGLE' | 'FLY_OUT' | 'GROUND_OUT' | 'LINE_OUT' | 'STRIKE' | 'BALL' | 'FOUL'
  exitVelo?: number
  launchAngle?: number
  distance?: number
  description: string
}

interface CareerStats {
  totalHR: number
  totalHits: number
  totalABs: number
  totalStrikes: number
  longestHR: number
  maxExitVelo: number
  levelsCompleted: number
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const PITCH_CONFIGS: Record<PitchType, PitchConfig> = {
  fastball:  { name: 'Fastball',  speedMult: 1.0,  horizMovement: 0,   vertMovement: -2,  color: '#ef4444' },
  changeup:  { name: 'Changeup',  speedMult: 0.82, horizMovement: 3,   vertMovement: 8,   color: '#22c55e' },
  slider:    { name: 'Slider',    speedMult: 0.88, horizMovement: 14,  vertMovement: 3,   color: '#3b82f6' },
  curveball: { name: 'Curveball', speedMult: 0.78, horizMovement: -4,  vertMovement: 18,  color: '#a855f7' },
  cutter:    { name: 'Cutter',    speedMult: 0.94, horizMovement: -8,  vertMovement: 2,   color: '#f97316' },
}

const LEVELS: Level[] = [
  {
    name: 'LITTLE LEAGUE',
    subtitle: 'Where legends begin',
    pitchSpeedMin: 45,
    pitchSpeedMax: 55,
    pitchTypes: ['fastball'],
    fenceDistance: 200,
    requiredHR: 2,
    totalABs: 10,
    strikeZoneSize: 1.3,
    bgColor: '#1a5e1a',
    accentColor: '#4ade80',
  },
  {
    name: 'HIGH SCHOOL',
    subtitle: 'Varsity tryouts',
    pitchSpeedMin: 62,
    pitchSpeedMax: 74,
    pitchTypes: ['fastball', 'changeup'],
    fenceDistance: 310,
    requiredHR: 3,
    totalABs: 12,
    strikeZoneSize: 1.15,
    bgColor: '#1e3a5f',
    accentColor: '#60a5fa',
  },
  {
    name: 'COLLEGE',
    subtitle: 'NCAA regionals',
    pitchSpeedMin: 78,
    pitchSpeedMax: 88,
    pitchTypes: ['fastball', 'changeup', 'slider'],
    fenceDistance: 360,
    requiredHR: 3,
    totalABs: 12,
    strikeZoneSize: 1.0,
    bgColor: '#3b1764',
    accentColor: '#c084fc',
  },
  {
    name: 'THE SHOW',
    subtitle: 'Welcome to the bigs',
    pitchSpeedMin: 90,
    pitchSpeedMax: 101,
    pitchTypes: ['fastball', 'changeup', 'slider', 'curveball', 'cutter'],
    fenceDistance: 400,
    requiredHR: 4,
    totalABs: 15,
    strikeZoneSize: 0.9,
    bgColor: '#1a0a0a',
    accentColor: '#f59e0b',
  },
]

// Canvas dimensions
const CW = 800
const CH = 560

// Strike zone geometry (in canvas coords)
const SZ_BASE_W = 140
const SZ_BASE_H = 170
const SZ_CENTER_X = CW / 2
const SZ_CENTER_Y = 370

// Pitch animation
const PITCHER_Y = 120
const PLATE_Y = SZ_CENTER_Y

// Result labels
const RESULT_LABELS: Record<AtBatResult['type'], { text: string; color: string }> = {
  HR:         { text: '💣 HOME RUN!',    color: '#f59e0b' },
  TRIPLE:     { text: '🔥 TRIPLE!',      color: '#a855f7' },
  DOUBLE:     { text: '✨ DOUBLE!',      color: '#3b82f6' },
  SINGLE:     { text: '👏 SINGLE!',      color: '#22c55e' },
  FLY_OUT:    { text: 'Fly Out',         color: '#ef4444' },
  GROUND_OUT: { text: 'Ground Out',      color: '#ef4444' },
  LINE_OUT:   { text: 'Line Out',        color: '#ef4444' },
  STRIKE:     { text: 'STRIKE!',         color: '#ef4444' },
  BALL:       { text: 'Ball',            color: '#94a3b8' },
  FOUL:       { text: 'Foul Ball',       color: '#fbbf24' },
}

/* ═══════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1))
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function easeInQuad(t: number): number {
  return t * t
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Game state ──
  const [screen, setScreen] = useState<GameScreen>('MENU')
  const [levelIdx, setLevelIdx] = useState(0)
  const [abNumber, setAbNumber] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [balls, setBalls] = useState(0)
  const [levelHRs, setLevelHRs] = useState(0)
  const [levelHits, setLevelHits] = useState(0)
  const [lastResult, setLastResult] = useState<AtBatResult | null>(null)
  const [resultTimer, setResultTimer] = useState(0)
  const [showPitchType, setShowPitchType] = useState(false)
  const [careerStats, setCareerStats] = useState<CareerStats>({
    totalHR: 0, totalHits: 0, totalABs: 0, totalStrikes: 0,
    longestHR: 0, maxExitVelo: 0, levelsCompleted: 0,
  })
  const [highScores, setHighScores] = useState<number[]>([])

  // ── Refs for game loop ──
  const mouseRef = useRef({ x: CW / 2, y: SZ_CENTER_Y })
  const pitchRef = useRef({
    active: false,
    type: 'fastball' as PitchType,
    startX: CW / 2,
    startY: PITCHER_Y,
    targetX: CW / 2,
    targetY: PLATE_Y,
    currentX: CW / 2,
    currentY: PITCHER_Y,
    progress: 0,
    speed: 85,
    thrown: false,
    arrivalTime: 0,
    throwTime: 0,
    horizBreak: 0,
    vertBreak: 0,
  })
  const swingRef = useRef({
    swung: false,
    swingTime: 0,
    swingX: CW / 2,
    swingY: SZ_CENTER_Y,
  })
  const animRef = useRef(0)
  const screenRef = useRef(screen)
  const levelRef = useRef(levelIdx)
  const strikesRef = useRef(strikes)
  const ballsRef = useRef(balls)
  const resultTimerRef = useRef(0)
  const pitchDelayRef = useRef(0)
  const waitingForPitchRef = useRef(false)

  // Sync refs
  useEffect(() => { screenRef.current = screen }, [screen])
  useEffect(() => { levelRef.current = levelIdx }, [levelIdx])
  useEffect(() => { strikesRef.current = strikes }, [strikes])
  useEffect(() => { ballsRef.current = balls }, [balls])

  // Load high scores from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dingers-game-highscores')
      if (saved) setHighScores(JSON.parse(saved))
    } catch {}
  }, [])

  const saveHighScore = useCallback((hrs: number) => {
    setHighScores(prev => {
      const next = [...prev, hrs].sort((a, b) => b - a).slice(0, 5)
      try { localStorage.setItem('dingers-game-highscores', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const level = LEVELS[levelIdx]

  /* ── Strike zone dimensions scaled by level ── */
  const szW = SZ_BASE_W * (level?.strikeZoneSize ?? 1)
  const szH = SZ_BASE_H * (level?.strikeZoneSize ?? 1)
  const szLeft = SZ_CENTER_X - szW / 2
  const szRight = SZ_CENTER_X + szW / 2
  const szTop = SZ_CENTER_Y - szH / 2
  const szBottom = SZ_CENTER_Y + szH / 2

  /* ═════════════════════════════════════════════
     PITCH LOGIC
     ═════════════════════════════════════════════ */

  const throwPitch = useCallback(() => {
    if (!level) return
    const type = pickRandom(level.pitchTypes)
    const config = PITCH_CONFIGS[type]
    const speed = rand(level.pitchSpeedMin, level.pitchSpeedMax) * config.speedMult

    // Target location — sometimes in the zone, sometimes just outside
    const inZone = Math.random() < 0.65
    let targetX: number, targetY: number
    if (inZone) {
      targetX = rand(szLeft + 8, szRight - 8)
      targetY = rand(szTop + 8, szBottom - 8)
    } else {
      // Just outside
      const side = randInt(0, 3)
      if (side === 0) { targetX = rand(szLeft - 40, szLeft - 5); targetY = rand(szTop, szBottom) }
      else if (side === 1) { targetX = rand(szRight + 5, szRight + 40); targetY = rand(szTop, szBottom) }
      else if (side === 2) { targetX = rand(szLeft, szRight); targetY = rand(szTop - 40, szTop - 5) }
      else { targetX = rand(szLeft, szRight); targetY = rand(szBottom + 5, szBottom + 40) }
    }

    // Flight time based on speed (slower = longer)
    const flightMs = lerp(850, 450, (speed - 40) / 65)

    const breakScale = level.strikeZoneSize > 1 ? 0.6 : 1.0 // less break at lower levels
    pitchRef.current = {
      active: true,
      type,
      startX: CW / 2 + rand(-15, 15),
      startY: PITCHER_Y,
      targetX,
      targetY,
      currentX: CW / 2,
      currentY: PITCHER_Y,
      progress: 0,
      speed,
      thrown: true,
      throwTime: performance.now(),
      arrivalTime: flightMs,
      horizBreak: config.horizMovement * breakScale,
      vertBreak: config.vertMovement * breakScale,
    }

    swingRef.current = { swung: false, swingTime: 0, swingX: CW / 2, swingY: SZ_CENTER_Y }
    setShowPitchType(false)
  }, [level, szLeft, szRight, szTop, szBottom])

  /* ═════════════════════════════════════════════
     RESULT CALCULATION
     ═════════════════════════════════════════════ */

  const calculateResult = useCallback((
    swingX: number, swingY: number, swingTime: number,
    pitchEndX: number, pitchEndY: number, pitchArrivalTime: number,
    pitchThrowTime: number, pitchType: PitchType
  ): AtBatResult => {
    if (!level) return { type: 'STRIKE', description: '' }

    // Timing: how close the swing was to when ball crosses plate
    const pitchArrival = pitchThrowTime + pitchArrivalTime
    const timingDiff = Math.abs(swingTime - pitchArrival)

    // Position accuracy: distance from bat to where ball ends up
    const posDistX = Math.abs(swingX - pitchEndX)
    const posDistY = Math.abs(swingY - pitchEndY)
    const posDist = Math.sqrt(posDistX * posDistX + posDistY * posDistY)

    // Timing score (0 to 1, 1 = perfect)
    let timingScore: number
    if (timingDiff < 30) timingScore = 1.0
    else if (timingDiff < 60) timingScore = 0.9
    else if (timingDiff < 100) timingScore = 0.75
    else if (timingDiff < 160) timingScore = 0.5
    else if (timingDiff < 250) timingScore = 0.25
    else timingScore = 0.05

    // Position score (0 to 1, 1 = dead center)
    const maxDist = 90
    const posScore = Math.max(0, 1 - posDist / maxDist)

    // Overall contact quality
    const contact = timingScore * 0.55 + posScore * 0.45

    // Complete whiff
    if (contact < 0.12 || posDist > 80) {
      // Check if it was in the zone
      const inZone = pitchEndX >= szLeft && pitchEndX <= szRight &&
                     pitchEndY >= szTop && pitchEndY <= szBottom
      if (inZone || swingRef.current.swung) {
        return { type: 'STRIKE', description: 'Swung and missed!' }
      }
      return { type: 'BALL', description: 'Ball' }
    }

    // Foul ball chance on poor contact
    if (contact < 0.25 && Math.random() < 0.6) {
      return { type: 'FOUL', description: 'Foul ball' }
    }

    // Exit velocity: 50-115 mph based on contact
    const baseEV = lerp(55, 112, Math.pow(contact, 0.8))
    const exitVelo = baseEV + rand(-5, 5)

    // Launch angle: based on vertical position difference
    // Swinging under the ball = higher angle, above = grounder
    const verticalDiff = (swingY - pitchEndY) / szH // negative = bat above ball
    const baseLaunchAngle = lerp(-15, 50, clamp(0.5 - verticalDiff * 1.5, 0, 1))
    // Add randomness based on contact quality — worse contact = more randomness
    const angleJitter = (1 - contact) * 25
    const launchAngle = baseLaunchAngle + rand(-angleJitter, angleJitter)

    // Distance calculation (simplified physics)
    const radAngle = (launchAngle * Math.PI) / 180
    const v0 = exitVelo * 1.467 // mph to ft/s
    const hangTime = (2 * v0 * Math.sin(radAngle)) / 32.2
    let distance = Math.max(0, v0 * Math.cos(radAngle) * Math.max(0, hangTime) * 0.7)

    // Contact quality multiplier on distance
    distance *= lerp(0.4, 1.1, contact)

    // Ground balls
    if (launchAngle < 5) {
      distance = Math.min(distance, rand(80, 200))
      if (contact > 0.5 && Math.random() < 0.3) {
        return { type: 'SINGLE', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Ground ball single! ${Math.round(exitVelo)} mph` }
      }
      return { type: 'GROUND_OUT', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Grounded out. ${Math.round(exitVelo)} mph, ${Math.round(launchAngle)}°` }
    }

    // Pop flies
    if (launchAngle > 55) {
      return { type: 'FLY_OUT', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(Math.min(distance, 180)), description: `Popped up. ${Math.round(launchAngle)}° launch angle` }
    }

    // Check for home run
    if (distance >= level.fenceDistance) {
      return { type: 'HR', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `💣 GONE! ${Math.round(distance)} ft, ${Math.round(exitVelo)} mph EV` }
    }

    // Other outcomes based on distance
    if (distance > level.fenceDistance * 0.85 && launchAngle > 15) {
      if (Math.random() < 0.4) {
        return { type: 'FLY_OUT', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Warning track fly out! ${Math.round(distance)} ft` }
      }
      return { type: 'TRIPLE', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Triple off the wall! ${Math.round(distance)} ft` }
    }

    if (distance > level.fenceDistance * 0.55) {
      if (launchAngle > 25 && Math.random() < 0.35) {
        return { type: 'FLY_OUT', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Caught at the track. ${Math.round(distance)} ft` }
      }
      return { type: 'DOUBLE', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Double to the gap! ${Math.round(distance)} ft` }
    }

    if (contact > 0.4) {
      if (launchAngle > 20 && Math.random() < 0.4) {
        return { type: 'FLY_OUT', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Fly out. ${Math.round(distance)} ft` }
      }
      return { type: 'SINGLE', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Base hit! ${Math.round(exitVelo)} mph` }
    }

    if (Math.random() < 0.5) {
      return { type: 'LINE_OUT', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Lined out. Good contact but right at 'em.` }
    }

    return { type: 'FLY_OUT', exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), distance: Math.round(distance), description: `Fly out. ${Math.round(distance)} ft` }
  }, [level, szLeft, szRight, szTop, szBottom, szH])

  /* ═════════════════════════════════════════════
     PROCESS AT-BAT RESULT
     ═════════════════════════════════════════════ */

  const processResult = useCallback((result: AtBatResult) => {
    setLastResult(result)
    setShowPitchType(true)
    setResultTimer(0)
    resultTimerRef.current = performance.now()

    const isHit = ['HR', 'TRIPLE', 'DOUBLE', 'SINGLE'].includes(result.type)
    const isABEnd = isHit || ['FLY_OUT', 'GROUND_OUT', 'LINE_OUT'].includes(result.type)
    const isStrike = result.type === 'STRIKE' || result.type === 'FOUL'

    if (result.type === 'HR') {
      setLevelHRs(h => h + 1)
      setLevelHits(h => h + 1)
      setCareerStats(s => ({
        ...s,
        totalHR: s.totalHR + 1,
        totalHits: s.totalHits + 1,
        longestHR: Math.max(s.longestHR, result.distance ?? 0),
        maxExitVelo: Math.max(s.maxExitVelo, result.exitVelo ?? 0),
      }))
    } else if (isHit) {
      setLevelHits(h => h + 1)
      setCareerStats(s => ({
        ...s,
        totalHits: s.totalHits + 1,
        maxExitVelo: Math.max(s.maxExitVelo, result.exitVelo ?? 0),
      }))
    }

    if (isStrike) {
      const newStrikes = strikesRef.current + 1
      setStrikes(newStrikes)
      if (newStrikes >= 3) {
        // Strikeout — counts as an AB
        setTimeout(() => {
          setStrikes(0)
          setBalls(0)
          const newAB = abNumber + 1
          setAbNumber(newAB)
          setCareerStats(s => ({ ...s, totalABs: s.totalABs + 1, totalStrikes: s.totalStrikes + 1 }))
          checkLevelEnd(newAB)
        }, 1200)
        return
      }
    } else if (result.type === 'BALL') {
      const newBalls = ballsRef.current + 1
      setBalls(newBalls)
      if (newBalls >= 4) {
        // Walk — doesn't count as AB, just reset
        setTimeout(() => {
          setStrikes(0)
          setBalls(0)
          setScreen('AT_BAT')
          waitingForPitchRef.current = true
          pitchDelayRef.current = performance.now() + rand(800, 1500)
        }, 1000)
        return
      }
    }

    if (isABEnd) {
      setTimeout(() => {
        setStrikes(0)
        setBalls(0)
        const newAB = abNumber + 1
        setAbNumber(newAB)
        setCareerStats(s => ({ ...s, totalABs: s.totalABs + 1 }))
        checkLevelEnd(newAB)
      }, result.type === 'HR' ? 2200 : 1400)
      return
    }

    // Foul with < 2 strikes or ball — keep going
    setTimeout(() => {
      setScreen('AT_BAT')
      waitingForPitchRef.current = true
      pitchDelayRef.current = performance.now() + rand(600, 1200)
    }, 900)
  }, [abNumber, strikesRef, ballsRef])

  const checkLevelEnd = useCallback((newAB: number) => {
    if (!level) return
    setLevelHRs(currentHR => {
      if (newAB >= level.totalABs) {
        if (currentHR >= level.requiredHR) {
          setTimeout(() => {
            setCareerStats(s => ({ ...s, levelsCompleted: s.levelsCompleted + 1 }))
            if (levelIdx >= LEVELS.length - 1) {
              saveHighScore(currentHR)
              setScreen('CAREER_COMPLETE')
            } else {
              setScreen('LEVEL_COMPLETE')
            }
          }, 300)
        } else {
          setTimeout(() => {
            saveHighScore(currentHR)
            setScreen('LEVEL_FAILED')
          }, 300)
        }
      } else {
        setTimeout(() => {
          setScreen('AT_BAT')
          waitingForPitchRef.current = true
          pitchDelayRef.current = performance.now() + rand(800, 1500)
        }, 300)
      }
      return currentHR
    })
  }, [level, levelIdx, saveHighScore])

  /* ═════════════════════════════════════════════
     CANVAS RENDERING
     ═════════════════════════════════════════════ */

  const drawGame = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const currentScreen = screenRef.current
    const lv = LEVELS[levelRef.current]
    if (!lv) return

    const szW_l = SZ_BASE_W * lv.strikeZoneSize
    const szH_l = SZ_BASE_H * lv.strikeZoneSize
    const szL = SZ_CENTER_X - szW_l / 2
    const szR = SZ_CENTER_X + szW_l / 2
    const szT = SZ_CENTER_Y - szH_l / 2
    const szB = SZ_CENTER_Y + szH_l / 2

    // ── Background ──
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 280)
    skyGrad.addColorStop(0, '#0a0a18')
    skyGrad.addColorStop(1, '#141428')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, CW, 280)

    // Stadium lights (glow dots)
    const lights = [[120, 30], [280, 20], [520, 20], [680, 30]]
    for (const [lx, ly] of lights) {
      const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 50)
      glow.addColorStop(0, 'rgba(255,255,220,0.5)')
      glow.addColorStop(0.5, 'rgba(255,255,200,0.1)')
      glow.addColorStop(1, 'rgba(255,255,200,0)')
      ctx.fillStyle = glow
      ctx.fillRect(lx - 50, ly - 50, 100, 100)
      ctx.fillStyle = '#fffde0'
      ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill()
    }

    // Outfield wall
    ctx.fillStyle = '#1a3a1a'
    ctx.fillRect(0, 200, CW, 80)
    // Wall top
    ctx.fillStyle = '#2d5a2d'
    ctx.fillRect(0, 200, CW, 4)

    // Field
    const fieldGrad = ctx.createLinearGradient(0, 280, 0, CH)
    fieldGrad.addColorStop(0, '#1a5c1a')
    fieldGrad.addColorStop(0.3, '#1f6b1f')
    fieldGrad.addColorStop(1, '#174a17')
    ctx.fillStyle = fieldGrad
    ctx.fillRect(0, 280, CW, CH - 280)

    // Mound
    ctx.fillStyle = '#8b7355'
    ctx.beginPath()
    ctx.ellipse(CW / 2, PITCHER_Y + 15, 30, 10, 0, 0, Math.PI * 2)
    ctx.fill()

    // Dirt around plate
    ctx.fillStyle = '#8b7355'
    ctx.beginPath()
    ctx.ellipse(CW / 2, SZ_CENTER_Y + 60, 80, 25, 0, 0, Math.PI * 2)
    ctx.fill()

    // Home plate
    ctx.fillStyle = '#e8e8e8'
    ctx.beginPath()
    ctx.moveTo(CW / 2, SZ_CENTER_Y + 70)
    ctx.lineTo(CW / 2 - 10, SZ_CENTER_Y + 60)
    ctx.lineTo(CW / 2 - 10, SZ_CENTER_Y + 50)
    ctx.lineTo(CW / 2 + 10, SZ_CENTER_Y + 50)
    ctx.lineTo(CW / 2 + 10, SZ_CENTER_Y + 60)
    ctx.closePath()
    ctx.fill()

    // ── Pitcher figure (simple) ──
    if (currentScreen === 'AT_BAT' || currentScreen === 'PITCHING' || currentScreen === 'SWING_RESULT') {
      const px = CW / 2
      const py = PITCHER_Y
      // Body
      ctx.fillStyle = '#ddd'
      ctx.beginPath(); ctx.arc(px, py - 20, 8, 0, Math.PI * 2); ctx.fill() // head
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(px, py - 12); ctx.lineTo(px, py + 10); ctx.stroke() // torso
      ctx.beginPath(); ctx.moveTo(px, py + 10); ctx.lineTo(px - 8, py + 25); ctx.stroke() // left leg
      ctx.beginPath(); ctx.moveTo(px, py + 10); ctx.lineTo(px + 8, py + 25); ctx.stroke() // right leg
      // Arms
      const isWindup = currentScreen === 'AT_BAT' && waitingForPitchRef.current
      if (isWindup) {
        ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px + 12, py - 15); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px - 10, py); ctx.stroke()
      } else {
        ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px + 12, py + 2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px - 12, py + 2); ctx.stroke()
      }
    }

    // ── Strike zone ──
    if (currentScreen === 'AT_BAT' || currentScreen === 'PITCHING' || currentScreen === 'SWING_RESULT') {
      // Zone outline
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.strokeRect(szL, szT, szW_l, szH_l)
      ctx.setLineDash([])

      // Grid lines (3x3 zone)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      for (let i = 1; i < 3; i++) {
        const gx = szL + (szW_l / 3) * i
        ctx.beginPath(); ctx.moveTo(gx, szT); ctx.lineTo(gx, szB); ctx.stroke()
        const gy = szT + (szH_l / 3) * i
        ctx.beginPath(); ctx.moveTo(szL, gy); ctx.lineTo(szR, gy); ctx.stroke()
      }
    }

    // ── Ball ──
    const p = pitchRef.current
    if (p.active && (currentScreen === 'PITCHING' || currentScreen === 'SWING_RESULT')) {
      const elapsed = time - p.throwTime
      const t = clamp(elapsed / p.arrivalTime, 0, 1)
      const eased = easeInQuad(t)

      // Base position (linear interpolation)
      let bx = lerp(p.startX, p.targetX, eased)
      let by = lerp(p.startY, p.targetY, eased)

      // Add break (lateral and vertical movement in last 30% of flight)
      const breakT = clamp((t - 0.7) / 0.3, 0, 1)
      const breakEase = easeOutCubic(breakT)
      bx += p.horizBreak * breakEase
      by += p.vertBreak * breakEase

      p.currentX = bx
      p.currentY = by
      p.progress = t

      // Ball size grows as it approaches (perspective)
      const ballSize = lerp(4, 14, eased)

      // Ball shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(bx + 2, by + ballSize + 2, ballSize * 0.8, ballSize * 0.3, 0, 0, Math.PI * 2)
      ctx.fill()

      // Ball
      const ballGrad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, ballSize)
      ballGrad.addColorStop(0, '#ffffff')
      ballGrad.addColorStop(0.7, '#e8e8e8')
      ballGrad.addColorStop(1, '#cccccc')
      ctx.fillStyle = ballGrad
      ctx.beginPath()
      ctx.arc(bx, by, ballSize, 0, Math.PI * 2)
      ctx.fill()

      // Seams
      if (ballSize > 8) {
        ctx.strokeStyle = '#cc3333'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(bx - 2, by, ballSize * 0.6, -0.5, 0.5)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(bx + 2, by, ballSize * 0.6, 2.6, 3.6)
        ctx.stroke()
      }

      // Trail
      if (t > 0.1 && t < 1) {
        const trailAlpha = 0.15
        for (let i = 1; i <= 3; i++) {
          const tt = clamp((elapsed - i * 30) / p.arrivalTime, 0, 1)
          const te = easeInQuad(tt)
          let tx = lerp(p.startX, p.targetX, te)
          let ty = lerp(p.startY, p.targetY, te)
          const bt = clamp((tt - 0.7) / 0.3, 0, 1)
          tx += p.horizBreak * easeOutCubic(bt)
          ty += p.vertBreak * easeOutCubic(bt)
          const ts = lerp(4, 14, te)
          ctx.fillStyle = `rgba(255,255,255,${trailAlpha / i})`
          ctx.beginPath()
          ctx.arc(tx, ty, ts * 0.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Handle pitch arriving at plate
      if (t >= 1 && !swingRef.current.swung) {
        // Ball passed — check if it's a strike or ball
        p.active = false
        const inZone = p.targetX >= szL && p.targetX <= szR &&
                       p.targetY >= szT && p.targetY <= szB
        const result: AtBatResult = inZone
          ? { type: 'STRIKE', description: 'Called strike!' }
          : { type: 'BALL', description: 'Ball' }
        setScreen('SWING_RESULT')
        processResult(result)
      }
    }

    // ── Bat cursor / crosshair ──
    if ((currentScreen === 'AT_BAT' || currentScreen === 'PITCHING') && !swingRef.current.swung) {
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      // Outer ring
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(mx, my, 20, 0, Math.PI * 2)
      ctx.stroke()

      // Crosshair lines
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(mx - 28, my); ctx.lineTo(mx - 10, my); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx + 10, my); ctx.lineTo(mx + 28, my); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx, my - 28); ctx.lineTo(mx, my - 10); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx, my + 10); ctx.lineTo(mx, my + 28); ctx.stroke()

      // Center dot
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.arc(mx, my, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── Swing animation ──
    if (swingRef.current.swung && currentScreen === 'SWING_RESULT') {
      const sx = swingRef.current.swingX
      const sy = swingRef.current.swingY
      const elapsed = time - swingRef.current.swingTime
      const swingAnim = clamp(elapsed / 150, 0, 1)

      // Bat swing arc
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate((-1.2 + swingAnim * 2.4))
      ctx.strokeStyle = '#8B4513'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(35, -5)
      ctx.stroke()
      // Barrel
      ctx.strokeStyle = '#A0522D'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.moveTo(30, -4)
      ctx.lineTo(50, -8)
      ctx.stroke()
      ctx.restore()

      // Impact flash on contact
      if (elapsed < 100 && lastResult && ['HR', 'TRIPLE', 'DOUBLE', 'SINGLE', 'FLY_OUT', 'GROUND_OUT', 'LINE_OUT', 'FOUL'].includes(lastResult.type)) {
        const flashAlpha = 1 - elapsed / 100
        ctx.fillStyle = `rgba(245, 158, 11, ${flashAlpha * 0.6})`
        ctx.beginPath()
        ctx.arc(sx, sy, 30 + elapsed * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // ── HR ball flight animation ──
    if (currentScreen === 'SWING_RESULT' && lastResult?.type === 'HR') {
      const elapsed = time - resultTimerRef.current
      const t = clamp(elapsed / 1800, 0, 1)
      const eased = easeOutCubic(t)

      // Ball flies up and out
      const hrBallX = lerp(swingRef.current.swingX, CW / 2 + rand(-50, 50), eased)
      const hrBallY = lerp(swingRef.current.swingY, -20, eased)
      const hrBallSize = lerp(12, 5, eased)

      if (t < 1) {
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(hrBallX, hrBallY, hrBallSize, 0, Math.PI * 2)
        ctx.fill()

        // Sparks
        for (let i = 0; i < 5; i++) {
          const sparkAngle = rand(0, Math.PI * 2)
          const sparkDist = rand(5, 20) * t
          const sparkX = hrBallX + Math.cos(sparkAngle) * sparkDist
          const sparkY = hrBallY + Math.sin(sparkAngle) * sparkDist
          ctx.fillStyle = `rgba(245, 158, 11, ${1 - t})`
          ctx.beginPath()
          ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }, [processResult, lastResult])

  /* ═════════════════════════════════════════════
     GAME LOOP
     ═════════════════════════════════════════════ */

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const loop = (time: number) => {
      if (!running) return

      // Auto-throw pitch after delay
      if (waitingForPitchRef.current && time > pitchDelayRef.current && screenRef.current === 'AT_BAT') {
        waitingForPitchRef.current = false
        setScreen('PITCHING')
        throwPitch()
      }

      // Clear and draw
      ctx.clearRect(0, 0, CW, CH)
      drawGame(ctx, time)

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
    }
  }, [drawGame, throwPitch])

  /* ═════════════════════════════════════════════
     INPUT HANDLERS
     ═════════════════════════════════════════════ */

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CW / rect.width
    const scaleY = CH / rect.height
    mouseRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const handleClick = useCallback(() => {
    const currentScreen = screenRef.current
    if (currentScreen !== 'PITCHING' || swingRef.current.swung) return
    if (!pitchRef.current.active) return

    const now = performance.now()
    swingRef.current = {
      swung: true,
      swingTime: now,
      swingX: mouseRef.current.x,
      swingY: mouseRef.current.y,
    }

    const p = pitchRef.current
    // Calculate where the ball is at the time of swing
    const elapsed = now - p.throwTime
    const t = clamp(elapsed / p.arrivalTime, 0, 1)
    const eased = easeInQuad(t)
    let pitchX = lerp(p.startX, p.targetX, eased)
    let pitchY = lerp(p.startY, p.targetY, eased)
    const breakT = clamp((t - 0.7) / 0.3, 0, 1)
    pitchX += p.horizBreak * easeOutCubic(breakT)
    pitchY += p.vertBreak * easeOutCubic(breakT)

    p.active = false

    const result = calculateResult(
      mouseRef.current.x, mouseRef.current.y, now,
      pitchX, pitchY, p.arrivalTime,
      p.throwTime, p.type
    )

    resultTimerRef.current = now
    setScreen('SWING_RESULT')
    processResult(result)
  }, [calculateResult, processResult])

  /* ═════════════════════════════════════════════
     SCREEN TRANSITIONS
     ═════════════════════════════════════════════ */

  const startCareer = useCallback(() => {
    setLevelIdx(0)
    setAbNumber(0)
    setStrikes(0)
    setBalls(0)
    setLevelHRs(0)
    setLevelHits(0)
    setLastResult(null)
    setCareerStats({
      totalHR: 0, totalHits: 0, totalABs: 0, totalStrikes: 0,
      longestHR: 0, maxExitVelo: 0, levelsCompleted: 0,
    })
    setScreen('LEVEL_INTRO')
  }, [])

  const startLevel = useCallback(() => {
    setAbNumber(0)
    setStrikes(0)
    setBalls(0)
    setLevelHRs(0)
    setLevelHits(0)
    setLastResult(null)
    setScreen('AT_BAT')
    waitingForPitchRef.current = true
    pitchDelayRef.current = performance.now() + 1200
  }, [])

  const nextLevel = useCallback(() => {
    setLevelIdx(i => i + 1)
    setScreen('LEVEL_INTRO')
  }, [])

  /* ═════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════ */

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e1e2e] bg-[#0a0a0f]/90 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">⚾</span>
            <span style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xl tracking-wider text-[#f59e0b]">
              DINGERS ONLY
            </span>
          </Link>
          <span style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-lg tracking-wider text-white/60">
            BATTING CAGE
          </span>
        </div>
      </header>

      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[800px]">
          {/* Canvas */}
          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            className="w-full rounded-xl border border-[#1e1e2e] shadow-2xl"
            style={{ aspectRatio: `${CW}/${CH}`, cursor: (screen === 'AT_BAT' || screen === 'PITCHING') ? 'none' : 'default' }}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
          />

          {/* ── HUD Overlay ── */}
          {(screen === 'AT_BAT' || screen === 'PITCHING' || screen === 'SWING_RESULT') && level && (
            <div className="absolute top-0 left-0 right-0 pointer-events-none p-3 flex justify-between items-start">
              {/* Level + Score */}
              <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 border border-white/10">
                <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-[#f59e0b]">
                  {level.name}
                </div>
                <div className="flex items-baseline gap-3 mt-0.5">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-lg text-white font-bold">
                    {levelHRs} HR
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/40">
                    need {level.requiredHR}
                  </span>
                </div>
              </div>

              {/* Count + AB */}
              <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 border border-white/10 text-right">
                <div className="flex gap-2 items-center justify-end">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/40">COUNT</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-lg text-white font-bold">
                    {balls}-{strikes}
                  </span>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xs text-white/40 mt-0.5">
                  AB {Math.min(abNumber + 1, level.totalABs)}/{level.totalABs}
                </div>
              </div>
            </div>
          )}

          {/* ── Result Flash ── */}
          {screen === 'SWING_RESULT' && lastResult && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center animate-bounce">
                <div
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    color: RESULT_LABELS[lastResult.type]?.color ?? '#fff',
                    textShadow: '0 0 30px rgba(0,0,0,0.8)',
                  }}
                  className="text-5xl tracking-wider"
                >
                  {RESULT_LABELS[lastResult.type]?.text}
                </div>
                {lastResult.exitVelo && (
                  <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-sm text-white/70 mt-1">
                    {lastResult.exitVelo} mph · {lastResult.launchAngle}° · {lastResult.distance} ft
                  </div>
                )}
                {showPitchType && pitchRef.current.type && (
                  <div style={{ fontFamily: 'DM Sans, sans-serif' }} className="text-xs text-white/40 mt-1">
                    {PITCH_CONFIGS[pitchRef.current.type].name} — {Math.round(pitchRef.current.speed)} mph
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Menu Screen ── */}
          {screen === 'MENU' && (
            <div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-6xl mb-4">⚾</div>
                <h1 style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-5xl tracking-wider text-[#f59e0b] mb-2">
                  BATTING CAGE
                </h1>
                <p style={{ fontFamily: 'DM Sans, sans-serif' }} className="text-white/50 mb-8 max-w-md mx-auto">
                  Work your way from Little League to The Show. Hit dingers, climb levels, become a legend.
                </p>

                <button
                  onClick={startCareer}
                  className="px-8 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg font-bold tracking-wide"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  START CAREER
                </button>

                <div className="mt-6 text-xs text-white/30" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  Move mouse to aim · Click to swing · Timing is everything
                </div>

                {highScores.length > 0 && (
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-sm text-white/40 tracking-widest mb-2">
                      HIGH SCORES
                    </div>
                    <div className="flex justify-center gap-4">
                      {highScores.map((s, i) => (
                        <span key={i} style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-sm text-[#f59e0b]">
                          {s} HR
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Level Intro ── */}
          {screen === 'LEVEL_INTRO' && level && (
            <div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-sm tracking-[0.3em] text-white/30 mb-2">
                  LEVEL {levelIdx + 1} OF {LEVELS.length}
                </div>
                <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', color: level.accentColor }} className="text-5xl tracking-wider mb-1">
                  {level.name}
                </h2>
                <p style={{ fontFamily: 'DM Sans, sans-serif' }} className="text-white/50 mb-8">
                  {level.subtitle}
                </p>

                <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-8">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">GOAL</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xl text-white font-bold">{level.requiredHR} HR</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">AT-BATS</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xl text-white font-bold">{level.totalABs}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">SPEED</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xl text-white font-bold">{level.pitchSpeedMin}-{level.pitchSpeedMax}</div>
                  </div>
                </div>

                <div className="mb-8">
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/30 mb-2">PITCHES YOU&apos;LL SEE</div>
                  <div className="flex justify-center gap-2">
                    {level.pitchTypes.map(pt => (
                      <span key={pt}
                        style={{ fontFamily: 'JetBrains Mono, monospace', borderColor: PITCH_CONFIGS[pt].color }}
                        className="text-xs px-2 py-1 rounded border text-white/70"
                      >
                        {PITCH_CONFIGS[pt].name}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startLevel}
                  className="px-8 py-3 rounded-lg transition-colors text-lg font-bold tracking-wide text-black"
                  style={{ fontFamily: 'Bebas Neue, sans-serif', backgroundColor: level.accentColor }}
                >
                  STEP UP TO THE PLATE
                </button>
              </div>
            </div>
          )}

          {/* ── Level Complete ── */}
          {screen === 'LEVEL_COMPLETE' && level && (
            <div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-5xl mb-3">🎉</div>
                <h2 style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-4xl tracking-wider text-[#4ade80] mb-1">
                  LEVEL CLEARED!
                </h2>
                <p style={{ fontFamily: 'DM Sans, sans-serif' }} className="text-white/50 mb-6">
                  You crushed {level.name}
                </p>

                <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">HOME RUNS</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-2xl text-[#f59e0b] font-bold">{levelHRs}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">TOTAL HITS</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-2xl text-white font-bold">{levelHits}</div>
                  </div>
                </div>

                <button
                  onClick={nextLevel}
                  className="px-8 py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-lg transition-colors text-lg font-bold tracking-wide"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  NEXT LEVEL →
                </button>
              </div>
            </div>
          )}

          {/* ── Level Failed ── */}
          {screen === 'LEVEL_FAILED' && level && (
            <div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-5xl mb-3">😤</div>
                <h2 style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-4xl tracking-wider text-[#ef4444] mb-1">
                  SENT DOWN
                </h2>
                <p style={{ fontFamily: 'DM Sans, sans-serif' }} className="text-white/50 mb-2">
                  Needed {level.requiredHR} HR but only hit {levelHRs}
                </p>

                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6 mt-4">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">CAREER HR</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xl text-[#f59e0b] font-bold">{careerStats.totalHR}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">LONGEST HR</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xl text-white font-bold">{careerStats.longestHR} ft</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">MAX EV</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-xl text-white font-bold">{careerStats.maxExitVelo} mph</div>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={startLevel}
                    className="px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg font-bold tracking-wide"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    TRY AGAIN
                  </button>
                  <button
                    onClick={() => setScreen('MENU')}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-lg font-bold tracking-wide"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    MAIN MENU
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Career Complete ── */}
          {screen === 'CAREER_COMPLETE' && (
            <div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-6xl mb-3">🏆</div>
                <h2 style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-5xl tracking-wider text-[#f59e0b] mb-1">
                  HALL OF FAME!
                </h2>
                <p style={{ fontFamily: 'DM Sans, sans-serif' }} className="text-white/50 mb-6">
                  You conquered every level. You&apos;re a dinger machine.
                </p>

                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-6">
                  <div className="bg-white/5 rounded-lg p-3 border border-[#f59e0b]/30">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-[#f59e0b]">CAREER HR</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-3xl text-[#f59e0b] font-bold">{careerStats.totalHR}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">LONGEST DINGER</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-3xl text-white font-bold">{careerStats.longestHR} ft</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">MAX EXIT VELO</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-2xl text-white font-bold">{careerStats.maxExitVelo} mph</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif' }} className="text-xs tracking-widest text-white/40">TOTAL HITS</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }} className="text-2xl text-white font-bold">{careerStats.totalHits}</div>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={startCareer}
                    className="px-8 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg font-bold tracking-wide"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    NEW CAREER
                  </button>
                  <button
                    onClick={() => setScreen('MENU')}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-lg font-bold tracking-wide"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    MAIN MENU
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] px-4 py-3 text-center">
        <span style={{ fontFamily: 'DM Sans, sans-serif' }} className="text-xs text-white/30">
          ⚾ Dingers Only Batting Cage — <Link href="/" className="text-[#f59e0b]/60 hover:text-[#f59e0b] transition-colors">Back to League</Link>
        </span>
      </footer>
    </div>
  )
}
