'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */

type PitchType = 'fastball' | 'changeup' | 'slider' | 'curveball' | 'cutter'

type GameScreen =
  | 'MENU'
  | 'CREATE_PLAYER'
  | 'LEVEL_INTRO'
  | 'AT_BAT'
  | 'PITCHING'
  | 'SWING_RESULT'
  | 'LEVEL_COMPLETE'
  | 'LEVEL_FAILED'
  | 'CAREER_COMPLETE'

interface Level {
  name: string
  subtitle: string
  pitchSpeedMin: number
  pitchSpeedMax: number
  pitchTypes: PitchType[]
  fenceDistance: number
  requiredHR: number
  totalABs: number
  strikeZoneSize: number
}

interface PitchConfig {
  name: string
  speedMult: number
  horizMovement: number
  vertMovement: number
  color: string
}

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

interface PlayerProfile {
  name: string
  teamName: string
  primaryColor: string
  secondaryColor: string
}

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const CW = 800
const CH = 560

const PITCH_CONFIGS: Record<PitchType, PitchConfig> = {
  fastball:  { name: 'Fastball',  speedMult: 1.0,  horizMovement: 0,   vertMovement: -2,  color: '#ef4444' },
  changeup:  { name: 'Changeup',  speedMult: 0.82, horizMovement: 3,   vertMovement: 8,   color: '#22c55e' },
  slider:    { name: 'Slider',    speedMult: 0.88, horizMovement: 14,  vertMovement: 3,   color: '#3b82f6' },
  curveball: { name: 'Curveball', speedMult: 0.78, horizMovement: -4,  vertMovement: 18,  color: '#a855f7' },
  cutter:    { name: 'Cutter',    speedMult: 0.94, horizMovement: -8,  vertMovement: 2,   color: '#f97316' },
}

const LEVELS: Level[] = [
  { name: 'LITTLE LEAGUE', subtitle: 'Where legends begin', pitchSpeedMin: 45, pitchSpeedMax: 55, pitchTypes: ['fastball'], fenceDistance: 200, requiredHR: 2, totalABs: 10, strikeZoneSize: 1.3 },
  { name: 'HIGH SCHOOL', subtitle: 'Varsity tryouts', pitchSpeedMin: 62, pitchSpeedMax: 74, pitchTypes: ['fastball', 'changeup'], fenceDistance: 310, requiredHR: 3, totalABs: 12, strikeZoneSize: 1.15 },
  { name: 'COLLEGE', subtitle: 'NCAA regionals', pitchSpeedMin: 78, pitchSpeedMax: 88, pitchTypes: ['fastball', 'changeup', 'slider'], fenceDistance: 360, requiredHR: 3, totalABs: 12, strikeZoneSize: 1.0 },
  { name: 'THE SHOW', subtitle: 'Welcome to the bigs', pitchSpeedMin: 90, pitchSpeedMax: 101, pitchTypes: ['fastball', 'changeup', 'slider', 'curveball', 'cutter'], fenceDistance: 400, requiredHR: 4, totalABs: 15, strikeZoneSize: 0.9 },
]

// Perspective geometry
const VP_X = 400     // vanishing point X
const VP_Y = 90      // vanishing point Y
const PLATE_Y = 490  // home plate screen Y
const MOUND_Y = 265  // pitcher mound screen Y
const FENCE_Y = 175  // outfield fence Y

// Strike zone (screen coords — scaled per level)
const SZ_BASE_W = 130
const SZ_BASE_H = 110
const SZ_CENTER_X = CW / 2
const SZ_CENTER_Y = 395

// Batter position
const BATTER_X = CW / 2
const BATTER_Y = 475

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f1f5f9',
]

const RESULT_LABELS: Record<AtBatResult['type'], { text: string; color: string }> = {
  HR:         { text: 'HOME RUN!',  color: '#f59e0b' },
  TRIPLE:     { text: 'TRIPLE!',    color: '#a855f7' },
  DOUBLE:     { text: 'DOUBLE!',    color: '#3b82f6' },
  SINGLE:     { text: 'SINGLE!',    color: '#22c55e' },
  FLY_OUT:    { text: 'Fly Out',    color: '#ef4444' },
  GROUND_OUT: { text: 'Ground Out', color: '#ef4444' },
  LINE_OUT:   { text: 'Line Out',   color: '#ef4444' },
  STRIKE:     { text: 'STRIKE!',    color: '#ef4444' },
  BALL:       { text: 'Ball',       color: '#94a3b8' },
  FOUL:       { text: 'Foul Ball',  color: '#fbbf24' },
}

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function rand(a: number, b: number) { return Math.random() * (b - a) + a }
function randInt(a: number, b: number) { return Math.floor(rand(a, b + 1)) }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function easeIn(t: number) { return t * t }
function easeOut(t: number) { return 1 - (1 - t) * (1 - t) * (1 - t) }
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, ((n >> 16) & 0xff) - amt)
  const g = Math.max(0, ((n >> 8) & 0xff) - amt)
  const b = Math.max(0, (n & 0xff) - amt)
  return `rgb(${r},${g},${b})`
}

/* ═══════════════════════════════════════════════════
   DRAWING: PERSPECTIVE FIELD & BACKGROUNDS
   ═══════════════════════════════════════════════════ */

function drawPerspectiveLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
}

// Perspective helper: given a "depth" (0=plate, 1=fence), returns scale and y
function depthToScreen(depth: number): { y: number; scale: number } {
  const y = lerp(PLATE_Y, FENCE_Y, depth)
  const scale = lerp(1.0, 0.25, depth)
  return { y, scale }
}

function drawSkyLittleLeague(ctx: CanvasRenderingContext2D) {
  // Bright blue sky
  const sky = ctx.createLinearGradient(0, 0, 0, 260)
  sky.addColorStop(0, '#4da6ff')
  sky.addColorStop(0.6, '#87ceeb')
  sky.addColorStop(1, '#b8e4f9')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, CW, 260)
  // Sun
  ctx.fillStyle = '#fff5c0'
  ctx.beginPath(); ctx.arc(650, 60, 35, 0, Math.PI * 2); ctx.fill()
  const sunGlow = ctx.createRadialGradient(650, 60, 30, 650, 60, 80)
  sunGlow.addColorStop(0, 'rgba(255,245,190,0.4)')
  sunGlow.addColorStop(1, 'rgba(255,245,190,0)')
  ctx.fillStyle = sunGlow
  ctx.fillRect(570, 0, 160, 140)
  // Clouds
  const drawCloud = (cx: number, cy: number, s: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(cx, cy, 18 * s, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx - 15 * s, cy + 4, 13 * s, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 16 * s, cy + 3, 15 * s, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + 7 * s, cy - 8 * s, 12 * s, 0, Math.PI * 2); ctx.fill()
  }
  drawCloud(160, 50, 1.1)
  drawCloud(450, 75, 0.8)
  drawCloud(300, 35, 0.6)
  // Trees behind fence
  const drawTree = (tx: number, ty: number, s: number) => {
    ctx.fillStyle = '#3d2b1f'
    ctx.fillRect(tx - 3 * s, ty, 6 * s, 20 * s)
    ctx.fillStyle = '#2d8a4e'
    ctx.beginPath(); ctx.arc(tx, ty - 5 * s, 18 * s, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#25734a'
    ctx.beginPath(); ctx.arc(tx - 6 * s, ty + 2 * s, 12 * s, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(tx + 8 * s, ty - 2 * s, 14 * s, 0, Math.PI * 2); ctx.fill()
  }
  drawTree(80, 135, 1.0)
  drawTree(180, 130, 1.2)
  drawTree(620, 128, 1.1)
  drawTree(720, 132, 0.9)
  drawTree(350, 125, 0.7)
  drawTree(500, 127, 0.8)
}

function drawSkyHighSchool(ctx: CanvasRenderingContext2D) {
  // Golden afternoon sky
  const sky = ctx.createLinearGradient(0, 0, 0, 260)
  sky.addColorStop(0, '#5b8cc9')
  sky.addColorStop(0.5, '#8ab4d6')
  sky.addColorStop(0.85, '#e8c87a')
  sky.addColorStop(1, '#d4a84b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, CW, 260)
  // Bleachers (simple aluminum stands)
  for (let i = 0; i < 3; i++) {
    const bx = 50 + i * 250
    const bw = 180
    ctx.fillStyle = '#9ca3af'
    ctx.fillRect(bx, 110 + i * 5, bw, 45)
    // Rows
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = r % 2 === 0 ? '#b0b7c0' : '#8d949d'
      ctx.fillRect(bx, 110 + i * 5 + r * 11, bw, 10)
    }
    // Tiny crowd dots
    for (let c = 0; c < 15; c++) {
      const cx = bx + 8 + c * 11
      const cy = 112 + i * 5 + (c % 4) * 11
      ctx.fillStyle = pick(['#ef4444', '#3b82f6', '#f59e0b', '#ffffff', '#22c55e', '#d4d4d4'])
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
    }
  }
  // Scoreboard
  ctx.fillStyle = '#1a2a1a'
  ctx.fillRect(340, 80, 120, 50)
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 2
  ctx.strokeRect(340, 80, 120, 50)
  ctx.fillStyle = '#22c55e'
  ctx.font = 'bold 11px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('HOME  AWAY', 400, 100)
  ctx.fillStyle = '#f59e0b'
  ctx.font = 'bold 16px monospace'
  ctx.fillText('0  -  0', 400, 120)
}

function drawSkyCollege(ctx: CanvasRenderingContext2D) {
  // Dusk purple/orange sky
  const sky = ctx.createLinearGradient(0, 0, 0, 260)
  sky.addColorStop(0, '#1a103a')
  sky.addColorStop(0.3, '#3b1a6e')
  sky.addColorStop(0.6, '#7a3b8a')
  sky.addColorStop(0.85, '#d4764a')
  sky.addColorStop(1, '#e8a44a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, CW, 260)
  // Stars (few since it's dusk)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  const stars = [[100, 20], [250, 40], [500, 15], [700, 35], [150, 55], [600, 50]]
  for (const [sx, sy] of stars) { ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI * 2); ctx.fill() }
  // Stadium lights on poles
  const drawLight = (lx: number) => {
    ctx.fillStyle = '#444'
    ctx.fillRect(lx - 3, 20, 6, 140)
    // Light bank
    ctx.fillStyle = '#666'
    ctx.fillRect(lx - 18, 15, 36, 14)
    // Glow
    const glow = ctx.createRadialGradient(lx, 22, 5, lx, 22, 80)
    glow.addColorStop(0, 'rgba(255,255,200,0.4)')
    glow.addColorStop(1, 'rgba(255,255,200,0)')
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.arc(lx, 22, 80, 0, Math.PI * 2); ctx.fill()
    // Bulbs
    for (let b = -2; b <= 2; b++) {
      ctx.fillStyle = '#fffde0'
      ctx.beginPath(); ctx.arc(lx + b * 6, 22, 3, 0, Math.PI * 2); ctx.fill()
    }
  }
  drawLight(100); drawLight(700)
  // Curved stands
  ctx.fillStyle = '#2a2040'
  ctx.beginPath()
  ctx.moveTo(0, 165)
  ctx.quadraticCurveTo(400, 110, 800, 165)
  ctx.lineTo(800, 200)
  ctx.quadraticCurveTo(400, 155, 0, 200)
  ctx.closePath()
  ctx.fill()
  // Crowd in stands
  for (let c = 0; c < 60; c++) {
    const cx = 30 + c * 12.5
    const baseY = 170 - Math.sin((cx / 800) * Math.PI) * 40
    ctx.fillStyle = pick(['#ef4444', '#3b82f6', '#f59e0b', '#fff', '#22c55e', '#a855f7', '#ddd', '#ec4899'])
    ctx.beginPath(); ctx.arc(cx, baseY + rand(-3, 3), 2.5, 0, Math.PI * 2); ctx.fill()
  }
}

function drawSkyTheShow(ctx: CanvasRenderingContext2D, time: number) {
  // Dark night sky
  const sky = ctx.createLinearGradient(0, 0, 0, 260)
  sky.addColorStop(0, '#05050f')
  sky.addColorStop(0.5, '#0a0a20')
  sky.addColorStop(1, '#121230')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, CW, 260)
  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  const starPositions = [
    [50, 15], [120, 40], [200, 10], [280, 50], [360, 20], [440, 45],
    [520, 8], [580, 38], [650, 18], [720, 42], [90, 60], [350, 55],
    [500, 60], [670, 55], [160, 30], [750, 25],
  ]
  for (const [sx, sy] of starPositions) {
    const twinkle = 0.5 + 0.5 * Math.sin(time / 500 + sx)
    ctx.globalAlpha = twinkle
    ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
  // Massive stadium lights
  const drawBigLight = (lx: number) => {
    ctx.fillStyle = '#333'
    ctx.fillRect(lx - 4, 0, 8, 100)
    // Light bank (wider)
    ctx.fillStyle = '#555'
    ctx.fillRect(lx - 28, 0, 56, 20)
    // Bright glow
    const glow = ctx.createRadialGradient(lx, 10, 8, lx, 10, 120)
    glow.addColorStop(0, 'rgba(255,255,230,0.45)')
    glow.addColorStop(0.5, 'rgba(255,255,200,0.12)')
    glow.addColorStop(1, 'rgba(255,255,200,0)')
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.arc(lx, 10, 120, 0, Math.PI * 2); ctx.fill()
    for (let b = -3; b <= 3; b++) {
      ctx.fillStyle = '#fffde8'
      ctx.beginPath(); ctx.arc(lx + b * 7, 10, 3.5, 0, Math.PI * 2); ctx.fill()
    }
  }
  drawBigLight(70); drawBigLight(250); drawBigLight(550); drawBigLight(730)
  // Two-tier stands
  // Upper deck
  ctx.fillStyle = '#151530'
  ctx.beginPath()
  ctx.moveTo(0, 80)
  ctx.quadraticCurveTo(400, 40, 800, 80)
  ctx.lineTo(800, 130)
  ctx.quadraticCurveTo(400, 90, 0, 130)
  ctx.closePath(); ctx.fill()
  // Lower deck
  ctx.fillStyle = '#1a1a40'
  ctx.beginPath()
  ctx.moveTo(0, 130)
  ctx.quadraticCurveTo(400, 100, 800, 130)
  ctx.lineTo(800, 185)
  ctx.quadraticCurveTo(400, 155, 0, 185)
  ctx.closePath(); ctx.fill()
  // Animated crowd (two tiers)
  for (let t = 0; t < 2; t++) {
    const baseYStart = t === 0 ? 85 : 140
    const count = t === 0 ? 55 : 65
    for (let c = 0; c < count; c++) {
      const cx = 15 + c * (770 / count)
      const curveOffset = Math.sin((cx / 800) * Math.PI) * (t === 0 ? 30 : 20)
      const bounce = Math.sin(time / 300 + c * 0.7) * 1.5
      const cy = baseYStart - curveOffset + bounce
      ctx.fillStyle = pick(['#ef4444', '#3b82f6', '#f59e0b', '#fff', '#22c55e', '#a855f7', '#ec4899', '#fbbf24', '#ddd'])
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill()
    }
  }
}

function drawField(ctx: CanvasRenderingContext2D, levelIdx: number) {
  // Outfield grass
  const grassGrad = ctx.createLinearGradient(0, FENCE_Y, 0, PLATE_Y + 40)
  if (levelIdx === 0) {
    grassGrad.addColorStop(0, '#2d7a3d')
    grassGrad.addColorStop(0.4, '#35883d')
    grassGrad.addColorStop(1, '#2d6e35')
  } else if (levelIdx === 1) {
    grassGrad.addColorStop(0, '#256e2e')
    grassGrad.addColorStop(0.5, '#2d7e34')
    grassGrad.addColorStop(1, '#1f5e28')
  } else if (levelIdx === 2) {
    grassGrad.addColorStop(0, '#1a5a24')
    grassGrad.addColorStop(0.5, '#22682c')
    grassGrad.addColorStop(1, '#164e1e')
  } else {
    grassGrad.addColorStop(0, '#1a5520')
    grassGrad.addColorStop(0.5, '#1f6028')
    grassGrad.addColorStop(1, '#143e18')
  }

  // Draw field as perspective trapezoid
  ctx.fillStyle = grassGrad
  ctx.beginPath()
  ctx.moveTo(0, FENCE_Y)
  ctx.lineTo(CW, FENCE_Y)
  ctx.lineTo(CW, CH)
  ctx.lineTo(0, CH)
  ctx.closePath()
  ctx.fill()

  // Mowing stripes (The Show and College)
  if (levelIdx >= 2) {
    ctx.save()
    for (let i = 0; i < 14; i++) {
      const stripeY = FENCE_Y + i * 25
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)'
        ctx.fillRect(0, stripeY, CW, 25)
      }
    }
    ctx.restore()
  }

  // Outfield wall
  if (levelIdx === 0) {
    // Chain-link fence
    ctx.strokeStyle = '#888'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, FENCE_Y)
    ctx.lineTo(CW, FENCE_Y)
    ctx.stroke()
    // Fence posts
    for (let p = 50; p < CW; p += 80) {
      ctx.fillStyle = '#777'
      ctx.fillRect(p - 2, FENCE_Y - 18, 4, 20)
    }
    // Chain-link pattern
    ctx.strokeStyle = 'rgba(150,150,150,0.3)'
    ctx.lineWidth = 0.5
    for (let p = 0; p < CW; p += 8) {
      ctx.beginPath(); ctx.moveTo(p, FENCE_Y - 16); ctx.lineTo(p + 4, FENCE_Y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(p + 4, FENCE_Y - 16); ctx.lineTo(p, FENCE_Y); ctx.stroke()
    }
  } else if (levelIdx === 1) {
    // Wooden outfield fence
    ctx.fillStyle = '#5a3d2b'
    ctx.fillRect(0, FENCE_Y - 12, CW, 14)
    ctx.fillStyle = '#4a3020'
    for (let p = 0; p < CW; p += 40) {
      ctx.fillRect(p, FENCE_Y - 14, 2, 16)
    }
  } else if (levelIdx === 2) {
    // Padded wall
    ctx.fillStyle = '#1a3a6a'
    ctx.fillRect(0, FENCE_Y - 16, CW, 18)
    ctx.fillStyle = '#254d8a'
    ctx.fillRect(0, FENCE_Y - 16, CW, 3)
  } else {
    // Pro padded wall with distance markers
    ctx.fillStyle = '#0a2040'
    ctx.fillRect(0, FENCE_Y - 20, CW, 22)
    ctx.fillStyle = '#0d2a55'
    ctx.fillRect(0, FENCE_Y - 20, CW, 4)
    // Distance markers
    ctx.fillStyle = '#f59e0b'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('330', 180, FENCE_Y - 6)
    ctx.fillText('370', 290, FENCE_Y - 6)
    ctx.fillText('400', 400, FENCE_Y - 6)
    ctx.fillText('370', 510, FENCE_Y - 6)
    ctx.fillText('330', 620, FENCE_Y - 6)
  }

  // Foul lines (perspective converging)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 2
  // Left line
  drawPerspectiveLine(ctx, VP_X - 2, FENCE_Y, 170, PLATE_Y + 30)
  // Right line
  drawPerspectiveLine(ctx, VP_X + 2, FENCE_Y, CW - 170, PLATE_Y + 30)

  // Infield dirt
  ctx.fillStyle = levelIdx === 0 ? '#a08660' : '#8b7355'
  ctx.beginPath()
  ctx.moveTo(CW / 2, 310)  // second base area
  ctx.quadraticCurveTo(CW / 2 + 120, 380, CW / 2 + 100, PLATE_Y - 10)
  ctx.lineTo(CW / 2 - 100, PLATE_Y - 10)
  ctx.quadraticCurveTo(CW / 2 - 120, 380, CW / 2, 310)
  ctx.closePath()
  ctx.fill()

  // Infield grass (inside diamond)
  if (levelIdx >= 1) {
    ctx.fillStyle = levelIdx >= 3 ? '#1a5a22' : '#206a2c'
    ctx.beginPath()
    ctx.moveTo(CW / 2, 330)
    ctx.quadraticCurveTo(CW / 2 + 70, 370, CW / 2 + 55, 410)
    ctx.lineTo(CW / 2 - 55, 410)
    ctx.quadraticCurveTo(CW / 2 - 70, 370, CW / 2, 330)
    ctx.closePath()
    ctx.fill()
  }

  // Pitcher's mound
  ctx.fillStyle = '#9a8060'
  ctx.beginPath()
  ctx.ellipse(CW / 2, MOUND_Y + 5, 28, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // Rubber
  ctx.fillStyle = '#ddd'
  ctx.fillRect(CW / 2 - 8, MOUND_Y, 16, 3)

  // Home plate area dirt
  ctx.fillStyle = '#9a8060'
  ctx.beginPath()
  ctx.ellipse(CW / 2, PLATE_Y + 5, 50, 16, 0, 0, Math.PI * 2)
  ctx.fill()

  // Home plate
  ctx.fillStyle = '#e8e8e8'
  ctx.beginPath()
  ctx.moveTo(CW / 2, PLATE_Y + 12)
  ctx.lineTo(CW / 2 - 8, PLATE_Y + 5)
  ctx.lineTo(CW / 2 - 8, PLATE_Y - 2)
  ctx.lineTo(CW / 2 + 8, PLATE_Y - 2)
  ctx.lineTo(CW / 2 + 8, PLATE_Y + 5)
  ctx.closePath()
  ctx.fill()

  // Batter's boxes
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(CW / 2 - 40, PLATE_Y - 25, 25, 50)
  ctx.strokeRect(CW / 2 + 15, PLATE_Y - 25, 25, 50)
}

/* ═══════════════════════════════════════════════════
   DRAWING: CHARACTERS
   ═══════════════════════════════════════════════════ */

function drawPitcher(ctx: CanvasRenderingContext2D, phase: 'idle' | 'windup' | 'thrown', time: number) {
  const px = CW / 2
  const py = MOUND_Y
  const s = 1.6 // scale — makes pitcher prominent

  ctx.save()
  ctx.translate(px, py)

  // Legs
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 4 * s
  ctx.lineCap = 'round'
  if (phase === 'windup') {
    // Left leg up
    ctx.beginPath(); ctx.moveTo(-6 * s, 12 * s); ctx.lineTo(-10 * s, 24 * s); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(6 * s, 12 * s); ctx.lineTo(4 * s, -2 * s); ctx.stroke()
  } else {
    ctx.beginPath(); ctx.moveTo(-6 * s, 12 * s); ctx.lineTo(-8 * s, 24 * s); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(6 * s, 12 * s); ctx.lineTo(8 * s, 24 * s); ctx.stroke()
  }

  // Torso (jersey)
  ctx.fillStyle = '#ccc'
  ctx.beginPath()
  ctx.moveTo(-10 * s, -4 * s)
  ctx.lineTo(10 * s, -4 * s)
  ctx.lineTo(8 * s, 14 * s)
  ctx.lineTo(-8 * s, 14 * s)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  ctx.stroke()

  // Arms
  ctx.strokeStyle = '#dab894'
  ctx.lineWidth = 3.5 * s
  ctx.lineCap = 'round'
  if (phase === 'windup') {
    // Glove hand out front
    ctx.beginPath(); ctx.moveTo(-9 * s, 0); ctx.lineTo(-18 * s, 6 * s); ctx.stroke()
    // Throwing arm back
    ctx.beginPath(); ctx.moveTo(9 * s, 0); ctx.lineTo(16 * s, -12 * s); ctx.stroke()
    // Ball in hand
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(16 * s, -12 * s, 3 * s, 0, Math.PI * 2); ctx.fill()
  } else if (phase === 'thrown') {
    // Follow through
    ctx.beginPath(); ctx.moveTo(-9 * s, 0); ctx.lineTo(-14 * s, 8 * s); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(9 * s, 0); ctx.lineTo(14 * s, 10 * s); ctx.stroke()
  } else {
    ctx.beginPath(); ctx.moveTo(-9 * s, 0); ctx.lineTo(-15 * s, 8 * s); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(9 * s, 0); ctx.lineTo(15 * s, 8 * s); ctx.stroke()
  }

  // Head
  ctx.fillStyle = '#dab894'
  ctx.beginPath(); ctx.arc(0, -11 * s, 8 * s, 0, Math.PI * 2); ctx.fill()
  // Cap
  ctx.fillStyle = '#333'
  ctx.beginPath()
  ctx.ellipse(0, -15 * s, 10 * s, 5 * s, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(-10 * s, -16 * s, 20 * s, 3 * s)
  // Cap brim
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.ellipse(0, -14 * s, 11 * s, 3 * s, 0, 0, Math.PI)
  ctx.fill()
  // Eyes (facing camera)
  ctx.fillStyle = '#333'
  ctx.beginPath(); ctx.arc(-3 * s, -10 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(3 * s, -10 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill()

  ctx.restore()
}

function drawBatter(ctx: CanvasRenderingContext2D, primary: string, secondary: string, swinging: boolean, swingProgress: number) {
  const bx = BATTER_X - 25  // slightly left of center (right-handed batter)
  const by = BATTER_Y

  ctx.save()
  ctx.translate(bx, by)

  // Scale — batter is big and prominent
  const s = 2.2

  // Legs
  ctx.fillStyle = '#ddd'
  ctx.fillRect(-7 * s, 10 * s, 6 * s, 20 * s)
  ctx.fillRect(2 * s, 10 * s, 6 * s, 20 * s)

  // Torso (jersey — primary color)
  ctx.fillStyle = primary
  ctx.beginPath()
  ctx.moveTo(-12 * s, -8 * s)
  ctx.lineTo(12 * s, -8 * s)
  ctx.lineTo(10 * s, 12 * s)
  ctx.lineTo(-10 * s, 12 * s)
  ctx.closePath()
  ctx.fill()
  // Jersey number / stripe (secondary)
  ctx.fillStyle = secondary
  ctx.fillRect(-5 * s, -4 * s, 10 * s, 2 * s)

  // Shoulders
  ctx.fillStyle = primary
  ctx.beginPath()
  ctx.ellipse(0, -7 * s, 14 * s, 5 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  // Helmet (seen from behind)
  ctx.fillStyle = primary
  ctx.beginPath()
  ctx.arc(0, -16 * s, 9 * s, 0, Math.PI * 2)
  ctx.fill()
  // Helmet shine
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath()
  ctx.arc(-2 * s, -19 * s, 4 * s, 0, Math.PI * 2)
  ctx.fill()

  // Arms + bat
  ctx.save()
  // Right arm holding bat
  const armBaseX = 10 * s
  const armBaseY = -4 * s

  if (swinging) {
    // Swing animation — bat sweeps from back to front
    const angle = lerp(-1.8, 1.5, easeOut(clamp(swingProgress, 0, 1)))
    ctx.translate(armBaseX, armBaseY)
    ctx.rotate(angle)
    // Upper arm
    ctx.strokeStyle = '#dab894'
    ctx.lineWidth = 4 * s
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10 * s, -2 * s); ctx.stroke()
    // Bat
    ctx.fillStyle = '#8B6914'
    ctx.beginPath()
    ctx.moveTo(8 * s, -2 * s)
    ctx.lineTo(30 * s, -5 * s)
    ctx.lineTo(32 * s, -3 * s)
    ctx.lineTo(10 * s, 0)
    ctx.closePath()
    ctx.fill()
    // Bat barrel
    ctx.fillStyle = '#A07D1A'
    ctx.fillRect(24 * s, -6 * s, 10 * s, 5 * s)
  } else {
    // Ready stance — bat behind shoulder
    ctx.translate(armBaseX, armBaseY)
    ctx.rotate(-1.5)
    ctx.strokeStyle = '#dab894'
    ctx.lineWidth = 4 * s
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8 * s, -2 * s); ctx.stroke()
    // Bat upright
    ctx.fillStyle = '#8B6914'
    ctx.beginPath()
    ctx.moveTo(6 * s, -2 * s)
    ctx.lineTo(12 * s, -28 * s)
    ctx.lineTo(15 * s, -28 * s)
    ctx.lineTo(9 * s, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#A07D1A'
    ctx.fillRect(10 * s, -30 * s, 7 * s, 8 * s)
  }
  ctx.restore()

  // Left arm (front arm, just visible)
  ctx.strokeStyle = '#dab894'
  ctx.lineWidth = 3.5 * s
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-10 * s, -3 * s); ctx.lineTo(-6 * s, 4 * s); ctx.stroke()

  ctx.restore()
}

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ── State ──
  const [screen, setScreen] = useState<GameScreen>('MENU')
  const [levelIdx, setLevelIdx] = useState(0)
  const [abNumber, setAbNumber] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [balls, setBalls] = useState(0)
  const [levelHRs, setLevelHRs] = useState(0)
  const [levelHits, setLevelHits] = useState(0)
  const [lastResult, setLastResult] = useState<AtBatResult | null>(null)
  const [showPitchType, setShowPitchType] = useState(false)
  const [careerStats, setCareerStats] = useState<CareerStats>({
    totalHR: 0, totalHits: 0, totalABs: 0, totalStrikes: 0,
    longestHR: 0, maxExitVelo: 0, levelsCompleted: 0,
  })
  const [highScores, setHighScores] = useState<number[]>([])
  const [player, setPlayer] = useState<PlayerProfile>({
    name: '', teamName: '', primaryColor: '#ef4444', secondaryColor: '#f1f5f9',
  })
  const [createName, setCreateName] = useState('')
  const [createTeam, setCreateTeam] = useState('')
  const [createPrimary, setCreatePrimary] = useState('#ef4444')
  const [createSecondary, setCreateSecondary] = useState('#f1f5f9')

  // ── Refs ──
  const mouseRef = useRef({ x: SZ_CENTER_X, y: SZ_CENTER_Y })
  const pitchRef = useRef({
    active: false, type: 'fastball' as PitchType,
    startX: CW / 2, startY: MOUND_Y - 10,
    targetX: CW / 2, targetY: SZ_CENTER_Y,
    currentX: CW / 2, currentY: MOUND_Y,
    progress: 0, speed: 85, thrown: false,
    arrivalTime: 600, throwTime: 0,
    horizBreak: 0, vertBreak: 0,
  })
  const swingRef = useRef({ swung: false, swingTime: 0, swingX: CW / 2, swingY: SZ_CENTER_Y })
  const animRef = useRef(0)
  const screenRef = useRef(screen)
  const levelRef = useRef(levelIdx)
  const strikesRef = useRef(strikes)
  const ballsRef = useRef(balls)
  const resultTimerRef = useRef(0)
  const pitchDelayRef = useRef(0)
  const waitingRef = useRef(false)
  const pitcherPhaseRef = useRef<'idle' | 'windup' | 'thrown'>('idle')
  const windupStartRef = useRef(0)

  // Sync refs
  useEffect(() => { screenRef.current = screen }, [screen])
  useEffect(() => { levelRef.current = levelIdx }, [levelIdx])
  useEffect(() => { strikesRef.current = strikes }, [strikes])
  useEffect(() => { ballsRef.current = balls }, [balls])

  // Load high scores
  useEffect(() => {
    try {
      const s = localStorage.getItem('dingers-game-hs')
      if (s) setHighScores(JSON.parse(s))
    } catch { /* empty */ }
  }, [])

  const saveHS = useCallback((hrs: number) => {
    setHighScores(prev => {
      const next = [...prev, hrs].sort((a, b) => b - a).slice(0, 5)
      try { localStorage.setItem('dingers-game-hs', JSON.stringify(next)) } catch { /* empty */ }
      return next
    })
  }, [])

  const level = LEVELS[levelIdx]
  const szW = SZ_BASE_W * (level?.strikeZoneSize ?? 1)
  const szH = SZ_BASE_H * (level?.strikeZoneSize ?? 1)
  const szL = SZ_CENTER_X - szW / 2
  const szR = SZ_CENTER_X + szW / 2
  const szT = SZ_CENTER_Y - szH / 2
  const szB = SZ_CENTER_Y + szH / 2

  /* ═════════════════════════════════════
     PITCH LOGIC
     ═════════════════════════════════════ */

  const throwPitch = useCallback(() => {
    if (!level) return
    const type = pick(level.pitchTypes)
    const config = PITCH_CONFIGS[type]
    const speed = rand(level.pitchSpeedMin, level.pitchSpeedMax) * config.speedMult

    const inZone = Math.random() < 0.65
    let targetX: number, targetY: number
    if (inZone) {
      targetX = rand(szL + 8, szR - 8)
      targetY = rand(szT + 8, szB - 8)
    } else {
      const side = randInt(0, 3)
      if (side === 0) { targetX = rand(szL - 35, szL - 5); targetY = rand(szT, szB) }
      else if (side === 1) { targetX = rand(szR + 5, szR + 35); targetY = rand(szT, szB) }
      else if (side === 2) { targetX = rand(szL, szR); targetY = rand(szT - 35, szT - 5) }
      else { targetX = rand(szL, szR); targetY = rand(szB + 5, szB + 35) }
    }

    const flightMs = lerp(800, 420, (speed - 40) / 65)
    const breakScale = level.strikeZoneSize > 1 ? 0.6 : 1.0

    // Start windup animation
    pitcherPhaseRef.current = 'windup'
    windupStartRef.current = performance.now()

    // Delay actual throw by 400ms for windup
    setTimeout(() => {
      pitcherPhaseRef.current = 'thrown'
      pitchRef.current = {
        active: true, type,
        startX: CW / 2 + rand(-8, 8), startY: MOUND_Y - 10,
        targetX, targetY,
        currentX: CW / 2, currentY: MOUND_Y,
        progress: 0, speed, thrown: true,
        throwTime: performance.now(), arrivalTime: flightMs,
        horizBreak: config.horizMovement * breakScale,
        vertBreak: config.vertMovement * breakScale,
      }
      swingRef.current = { swung: false, swingTime: 0, swingX: CW / 2, swingY: SZ_CENTER_Y }
      setShowPitchType(false)
    }, 400)
  }, [level, szL, szR, szT, szB])

  /* ═════════════════════════════════════
     RESULT CALCULATION
     ═════════════════════════════════════ */

  const calculateResult = useCallback((
    swX: number, swY: number, swTime: number,
    pEndX: number, pEndY: number, pArrTime: number,
    pThrowTime: number, pType: PitchType
  ): AtBatResult => {
    if (!level) return { type: 'STRIKE', description: '' }

    const pitchArrival = pThrowTime + pArrTime
    const timingDiff = Math.abs(swTime - pitchArrival)
    const posDistX = Math.abs(swX - pEndX)
    const posDistY = Math.abs(swY - pEndY)
    const posDist = Math.sqrt(posDistX * posDistX + posDistY * posDistY)

    let timingScore: number
    if (timingDiff < 30) timingScore = 1.0
    else if (timingDiff < 60) timingScore = 0.9
    else if (timingDiff < 100) timingScore = 0.75
    else if (timingDiff < 160) timingScore = 0.5
    else if (timingDiff < 250) timingScore = 0.25
    else timingScore = 0.05

    const posScore = Math.max(0, 1 - posDist / 90)
    const contact = timingScore * 0.55 + posScore * 0.45

    if (contact < 0.12 || posDist > 80) {
      const inZ = pEndX >= szL && pEndX <= szR && pEndY >= szT && pEndY <= szB
      if (inZ || swingRef.current.swung) return { type: 'STRIKE', description: 'Swung and missed!' }
      return { type: 'BALL', description: 'Ball' }
    }

    if (contact < 0.25 && Math.random() < 0.6) return { type: 'FOUL', description: 'Foul ball' }

    const baseEV = lerp(55, 112, Math.pow(contact, 0.8))
    const exitVelo = baseEV + rand(-5, 5)
    const vertDiff = (swY - pEndY) / szH
    const baseLaunch = lerp(-15, 50, clamp(0.5 - vertDiff * 1.5, 0, 1))
    const jitter = (1 - contact) * 25
    const launchAngle = baseLaunch + rand(-jitter, jitter)

    const rad = (launchAngle * Math.PI) / 180
    const v0 = exitVelo * 1.467
    const hang = (2 * v0 * Math.sin(rad)) / 32.2
    let dist = Math.max(0, v0 * Math.cos(rad) * Math.max(0, hang) * 0.7)
    dist *= lerp(0.4, 1.1, contact)

    const ev = Math.round(exitVelo)
    const la = Math.round(launchAngle)
    const d = Math.round(dist)

    if (launchAngle < 5) {
      dist = Math.min(dist, rand(80, 200))
      if (contact > 0.5 && Math.random() < 0.3)
        return { type: 'SINGLE', exitVelo: ev, launchAngle: la, distance: Math.round(dist), description: `Ground ball single! ${ev} mph` }
      return { type: 'GROUND_OUT', exitVelo: ev, launchAngle: la, distance: Math.round(dist), description: `Grounded out. ${ev} mph` }
    }
    if (launchAngle > 55) return { type: 'FLY_OUT', exitVelo: ev, launchAngle: la, distance: Math.round(Math.min(dist, 180)), description: `Popped up.` }

    if (dist >= level.fenceDistance)
      return { type: 'HR', exitVelo: ev, launchAngle: la, distance: d, description: `GONE! ${d} ft, ${ev} mph EV` }

    if (dist > level.fenceDistance * 0.85 && launchAngle > 15) {
      if (Math.random() < 0.4) return { type: 'FLY_OUT', exitVelo: ev, launchAngle: la, distance: d, description: `Warning track! ${d} ft` }
      return { type: 'TRIPLE', exitVelo: ev, launchAngle: la, distance: d, description: `Triple off the wall! ${d} ft` }
    }
    if (dist > level.fenceDistance * 0.55) {
      if (launchAngle > 25 && Math.random() < 0.35) return { type: 'FLY_OUT', exitVelo: ev, launchAngle: la, distance: d, description: `Caught at the track.` }
      return { type: 'DOUBLE', exitVelo: ev, launchAngle: la, distance: d, description: `Double to the gap! ${d} ft` }
    }
    if (contact > 0.4) {
      if (launchAngle > 20 && Math.random() < 0.4) return { type: 'FLY_OUT', exitVelo: ev, launchAngle: la, distance: d, description: `Fly out. ${d} ft` }
      return { type: 'SINGLE', exitVelo: ev, launchAngle: la, distance: d, description: `Base hit! ${ev} mph` }
    }
    if (Math.random() < 0.5) return { type: 'LINE_OUT', exitVelo: ev, launchAngle: la, distance: d, description: 'Lined out.' }
    return { type: 'FLY_OUT', exitVelo: ev, launchAngle: la, distance: d, description: `Fly out. ${d} ft` }
  }, [level, szL, szR, szT, szB, szH])

  /* ═════════════════════════════════════
     PROCESS RESULT + AB TRACKING
     ═════════════════════════════════════ */

  const checkLevelEnd = useCallback((newAB: number, currentHR: number) => {
    if (!level) return
    if (newAB >= level.totalABs) {
      if (currentHR >= level.requiredHR) {
        setTimeout(() => {
          setCareerStats(s => ({ ...s, levelsCompleted: s.levelsCompleted + 1 }))
          if (levelIdx >= LEVELS.length - 1) {
            saveHS(currentHR)
            setScreen('CAREER_COMPLETE')
          } else {
            setScreen('LEVEL_COMPLETE')
          }
        }, 300)
      } else {
        setTimeout(() => { saveHS(currentHR); setScreen('LEVEL_FAILED') }, 300)
      }
    } else {
      setTimeout(() => {
        pitcherPhaseRef.current = 'idle'
        setScreen('AT_BAT')
        waitingRef.current = true
        pitchDelayRef.current = performance.now() + rand(800, 1500)
      }, 300)
    }
  }, [level, levelIdx, saveHS])

  const processResult = useCallback((result: AtBatResult) => {
    setLastResult(result)
    setShowPitchType(true)
    resultTimerRef.current = performance.now()

    const isHit = ['HR', 'TRIPLE', 'DOUBLE', 'SINGLE'].includes(result.type)
    const isABEnd = isHit || ['FLY_OUT', 'GROUND_OUT', 'LINE_OUT'].includes(result.type)
    const isStrike = result.type === 'STRIKE' || result.type === 'FOUL'

    if (result.type === 'HR') {
      setLevelHRs(h => h + 1)
      setLevelHits(h => h + 1)
      setCareerStats(s => ({
        ...s, totalHR: s.totalHR + 1, totalHits: s.totalHits + 1,
        longestHR: Math.max(s.longestHR, result.distance ?? 0),
        maxExitVelo: Math.max(s.maxExitVelo, result.exitVelo ?? 0),
      }))
    } else if (isHit) {
      setLevelHits(h => h + 1)
      setCareerStats(s => ({
        ...s, totalHits: s.totalHits + 1,
        maxExitVelo: Math.max(s.maxExitVelo, result.exitVelo ?? 0),
      }))
    }

    if (isStrike) {
      const newK = strikesRef.current + 1
      setStrikes(newK)
      if (newK >= 3) {
        setTimeout(() => {
          setStrikes(0); setBalls(0)
          const newAB = abNumber + 1
          setAbNumber(newAB)
          setCareerStats(s => ({ ...s, totalABs: s.totalABs + 1, totalStrikes: s.totalStrikes + 1 }))
          setLevelHRs(cur => { checkLevelEnd(newAB, cur); return cur })
        }, 1200)
        return
      }
    } else if (result.type === 'BALL') {
      const newB = ballsRef.current + 1
      setBalls(newB)
      if (newB >= 4) {
        setTimeout(() => {
          setStrikes(0); setBalls(0); pitcherPhaseRef.current = 'idle'
          setScreen('AT_BAT')
          waitingRef.current = true
          pitchDelayRef.current = performance.now() + rand(800, 1500)
        }, 1000)
        return
      }
    }

    if (isABEnd) {
      setTimeout(() => {
        setStrikes(0); setBalls(0)
        const newAB = abNumber + 1
        setAbNumber(newAB)
        setCareerStats(s => ({ ...s, totalABs: s.totalABs + 1 }))
        setLevelHRs(cur => { checkLevelEnd(newAB, cur); return cur })
      }, result.type === 'HR' ? 2200 : 1400)
      return
    }

    setTimeout(() => {
      pitcherPhaseRef.current = 'idle'
      setScreen('AT_BAT')
      waitingRef.current = true
      pitchDelayRef.current = performance.now() + rand(600, 1200)
    }, 900)
  }, [abNumber, checkLevelEnd])

  /* ═════════════════════════════════════
     CANVAS DRAW
     ═════════════════════════════════════ */

  const drawGame = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const cs = screenRef.current
    const li = levelRef.current
    const lv = LEVELS[li]
    if (!lv) return

    const szW_l = SZ_BASE_W * lv.strikeZoneSize
    const szH_l = SZ_BASE_H * lv.strikeZoneSize
    const szL_l = SZ_CENTER_X - szW_l / 2
    const szR_l = SZ_CENTER_X + szW_l / 2
    const szT_l = SZ_CENTER_Y - szH_l / 2
    const szB_l = SZ_CENTER_Y + szH_l / 2

    ctx.clearRect(0, 0, CW, CH)

    // ── Sky + scenery ──
    if (li === 0) drawSkyLittleLeague(ctx)
    else if (li === 1) drawSkyHighSchool(ctx)
    else if (li === 2) drawSkyCollege(ctx)
    else drawSkyTheShow(ctx, time)

    // ── Field ──
    drawField(ctx, li)

    // ── Catcher (behind batter, just visible as a crouching shape) ──
    ctx.fillStyle = '#555'
    ctx.beginPath()
    ctx.ellipse(CW / 2 + 2, PLATE_Y + 5, 14, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#777'
    ctx.beginPath(); ctx.arc(CW / 2 + 2, PLATE_Y - 5, 7, 0, Math.PI * 2); ctx.fill()
    // Catcher mitt
    ctx.fillStyle = '#8B4513'
    ctx.beginPath(); ctx.arc(CW / 2 + 15, PLATE_Y - 2, 7, 0, Math.PI * 2); ctx.fill()

    // ── Pitcher ──
    const inPlay = cs === 'AT_BAT' || cs === 'PITCHING' || cs === 'SWING_RESULT'
    if (inPlay) {
      drawPitcher(ctx, pitcherPhaseRef.current, time)
    }

    // ── Strike zone ──
    if (inPlay) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.strokeRect(szL_l, szT_l, szW_l, szH_l)
      ctx.setLineDash([])
      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      for (let i = 1; i < 3; i++) {
        const gx = szL_l + (szW_l / 3) * i
        drawPerspectiveLine(ctx, gx, szT_l, gx, szB_l)
        const gy = szT_l + (szH_l / 3) * i
        drawPerspectiveLine(ctx, szL_l, gy, szR_l, gy)
      }
    }

    // ── Ball ──
    const p = pitchRef.current
    if (p.active && (cs === 'PITCHING' || cs === 'SWING_RESULT')) {
      const elapsed = time - p.throwTime
      const t = clamp(elapsed / p.arrivalTime, 0, 1)
      const e = easeIn(t)

      let bx = lerp(p.startX, p.targetX, e)
      let by = lerp(p.startY, p.targetY, e)
      const bt = clamp((t - 0.7) / 0.3, 0, 1)
      const be = easeOut(bt)
      bx += p.horizBreak * be
      by += p.vertBreak * be

      p.currentX = bx; p.currentY = by; p.progress = t

      // Ball grows as it approaches (perspective)
      const ballR = lerp(3, 13, e)

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.ellipse(bx + 2, by + ballR + 1, ballR * 0.7, ballR * 0.25, 0, 0, Math.PI * 2)
      ctx.fill()

      // Ball
      const bg = ctx.createRadialGradient(bx - 1, by - 1, 1, bx, by, ballR)
      bg.addColorStop(0, '#ffffff')
      bg.addColorStop(0.6, '#f0f0f0')
      bg.addColorStop(1, '#cccccc')
      ctx.fillStyle = bg
      ctx.beginPath(); ctx.arc(bx, by, ballR, 0, Math.PI * 2); ctx.fill()

      // Seams
      if (ballR > 6) {
        ctx.strokeStyle = '#cc3333'
        ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.arc(bx - 1.5, by, ballR * 0.55, -0.5, 0.5); ctx.stroke()
        ctx.beginPath(); ctx.arc(bx + 1.5, by, ballR * 0.55, 2.6, 3.6); ctx.stroke()
      }

      // Trail
      if (t > 0.1 && t < 1) {
        for (let i = 1; i <= 4; i++) {
          const tt = clamp((elapsed - i * 25) / p.arrivalTime, 0, 1)
          const te = easeIn(tt)
          let tx = lerp(p.startX, p.targetX, te)
          let ty = lerp(p.startY, p.targetY, te)
          const tbt = clamp((tt - 0.7) / 0.3, 0, 1)
          tx += p.horizBreak * easeOut(tbt)
          ty += p.vertBreak * easeOut(tbt)
          ctx.fillStyle = `rgba(255,255,255,${0.12 / i})`
          ctx.beginPath(); ctx.arc(tx, ty, lerp(3, 13, te) * 0.5, 0, Math.PI * 2); ctx.fill()
        }
      }

      // Pitch arrived without swing
      if (t >= 1 && !swingRef.current.swung) {
        p.active = false
        const inZ = p.targetX >= szL_l && p.targetX <= szR_l && p.targetY >= szT_l && p.targetY <= szB_l
        setScreen('SWING_RESULT')
        processResult(inZ ? { type: 'STRIKE', description: 'Called strike!' } : { type: 'BALL', description: 'Ball' })
      }
    }

    // ── Batter ──
    if (inPlay) {
      const swung = swingRef.current.swung
      const swingProg = swung ? clamp((time - swingRef.current.swingTime) / 180, 0, 1) : 0
      drawBatter(ctx, player.primaryColor, player.secondaryColor, swung, swingProg)
    }

    // ── Crosshair ──
    if ((cs === 'AT_BAT' || cs === 'PITCHING') && !swingRef.current.swung) {
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const col = player.primaryColor || '#f59e0b'
      ctx.strokeStyle = col
      ctx.lineWidth = 2.5
      ctx.globalAlpha = 0.8
      ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2); ctx.stroke()
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(mx - 26, my); ctx.lineTo(mx - 10, my); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx + 10, my); ctx.lineTo(mx + 26, my); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx, my - 26); ctx.lineTo(mx, my - 10); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx, my + 10); ctx.lineTo(mx, my + 26); ctx.stroke()
      ctx.fillStyle = col
      ctx.beginPath(); ctx.arc(mx, my, 2.5, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    }

    // ── Impact flash on contact ──
    if (swingRef.current.swung && cs === 'SWING_RESULT' && lastResult) {
      const el = time - swingRef.current.swingTime
      if (el < 120 && ['HR', 'TRIPLE', 'DOUBLE', 'SINGLE', 'FLY_OUT', 'GROUND_OUT', 'LINE_OUT', 'FOUL'].includes(lastResult.type)) {
        const fa = 1 - el / 120
        ctx.fillStyle = `rgba(245,158,11,${fa * 0.5})`
        ctx.beginPath()
        ctx.arc(swingRef.current.swingX, swingRef.current.swingY, 25 + el * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // ── HR ball flight ──
    if (cs === 'SWING_RESULT' && lastResult?.type === 'HR') {
      const el = time - resultTimerRef.current
      const ft = clamp(el / 1800, 0, 1)
      const fe = easeOut(ft)

      // Ball flies toward outfield (gets smaller — moving away)
      const hbx = lerp(swingRef.current.swingX, CW / 2, fe)
      const hby = lerp(swingRef.current.swingY, FENCE_Y - 60, fe)
      const hbs = lerp(12, 3, fe)

      if (ft < 1) {
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(hbx, hby, hbs, 0, Math.PI * 2); ctx.fill()
        // Sparks
        for (let i = 0; i < 6; i++) {
          const sa = rand(0, Math.PI * 2)
          const sd = rand(3, 18) * ft
          ctx.fillStyle = `rgba(245,158,11,${(1 - ft) * 0.8})`
          ctx.beginPath()
          ctx.arc(hbx + Math.cos(sa) * sd, hby + Math.sin(sa) * sd, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // HR celebration flash
      if (el > 300 && el < 800) {
        const pulse = Math.sin((el - 300) / 80) * 0.15
        ctx.fillStyle = `rgba(245,158,11,${pulse})`
        ctx.fillRect(0, 0, CW, CH)
      }
    }
  }, [processResult, lastResult, player])

  /* ═════════════════════════════════════
     GAME LOOP
     ═════════════════════════════════════ */

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let running = true

    const loop = (time: number) => {
      if (!running) return
      // Auto-throw after delay
      if (waitingRef.current && time > pitchDelayRef.current && screenRef.current === 'AT_BAT') {
        waitingRef.current = false
        setScreen('PITCHING')
        throwPitch()
      }
      ctx.clearRect(0, 0, CW, CH)
      drawGame(ctx, time)
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [drawGame, throwPitch])

  /* ═════════════════════════════════════
     INPUT HANDLERS
     ═════════════════════════════════════ */

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current = {
      x: (e.clientX - rect.left) * (CW / rect.width),
      y: (e.clientY - rect.top) * (CH / rect.height),
    }
  }, [])

  const handleClick = useCallback(() => {
    if (screenRef.current !== 'PITCHING' || swingRef.current.swung || !pitchRef.current.active) return
    const now = performance.now()
    swingRef.current = { swung: true, swingTime: now, swingX: mouseRef.current.x, swingY: mouseRef.current.y }

    const p = pitchRef.current
    const elapsed = now - p.throwTime
    const t = clamp(elapsed / p.arrivalTime, 0, 1)
    const e = easeIn(t)
    let px = lerp(p.startX, p.targetX, e)
    let py = lerp(p.startY, p.targetY, e)
    const bt = clamp((t - 0.7) / 0.3, 0, 1)
    px += p.horizBreak * easeOut(bt)
    py += p.vertBreak * easeOut(bt)

    p.active = false
    const result = calculateResult(mouseRef.current.x, mouseRef.current.y, now, px, py, p.arrivalTime, p.throwTime, p.type)
    resultTimerRef.current = now
    setScreen('SWING_RESULT')
    processResult(result)
  }, [calculateResult, processResult])

  /* ═════════════════════════════════════
     SCREEN TRANSITIONS
     ═════════════════════════════════════ */

  const confirmPlayer = useCallback(() => {
    setPlayer({
      name: createName || 'Slugger',
      teamName: createTeam || 'Dingers',
      primaryColor: createPrimary,
      secondaryColor: createSecondary,
    })
    setLevelIdx(0); setAbNumber(0); setStrikes(0); setBalls(0)
    setLevelHRs(0); setLevelHits(0); setLastResult(null)
    setCareerStats({ totalHR: 0, totalHits: 0, totalABs: 0, totalStrikes: 0, longestHR: 0, maxExitVelo: 0, levelsCompleted: 0 })
    setScreen('LEVEL_INTRO')
  }, [createName, createTeam, createPrimary, createSecondary])

  const startLevel = useCallback(() => {
    setAbNumber(0); setStrikes(0); setBalls(0)
    setLevelHRs(0); setLevelHits(0); setLastResult(null)
    pitcherPhaseRef.current = 'idle'
    setScreen('AT_BAT')
    waitingRef.current = true
    pitchDelayRef.current = performance.now() + 1200
  }, [])

  const nextLevel = useCallback(() => {
    setLevelIdx(i => i + 1)
    setScreen('LEVEL_INTRO')
  }, [])

  /* ═════════════════════════════════════
     RENDER
     ═════════════════════════════════════ */

  const fontD = { fontFamily: "'Bebas Neue', sans-serif" }
  const fontB = { fontFamily: "'DM Sans', sans-serif" }
  const fontM = { fontFamily: "'JetBrains Mono', monospace" }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e1e2a] bg-[#0a0a0f]/90 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">⚾</span>
            <span style={fontD} className="text-xl tracking-wider text-[#f59e0b]">DINGERS ONLY</span>
          </Link>
          <span style={fontD} className="text-lg tracking-wider text-white/60">BATTING CAGE</span>
        </div>
      </header>

      {/* Game */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[800px]">
          <canvas
            ref={canvasRef} width={CW} height={CH}
            className="w-full rounded-xl border border-[#1e1e2a] shadow-2xl"
            style={{ aspectRatio: `${CW}/${CH}`, cursor: (screen === 'AT_BAT' || screen === 'PITCHING') ? 'none' : 'default' }}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
          />

          {/* ── HUD ── */}
          {(screen === 'AT_BAT' || screen === 'PITCHING' || screen === 'SWING_RESULT') && level && (
            <div className="absolute top-0 left-0 right-0 pointer-events-none p-3 flex justify-between items-start">
              <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 border border-white/10">
                <div style={fontD} className="text-[10px] tracking-[0.2em] text-[#f59e0b]">{level.name}</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span style={fontM} className="text-lg text-white font-bold">{levelHRs} HR</span>
                  <span style={fontM} className="text-[10px] text-white/40">/ {level.requiredHR}</span>
                </div>
                <div style={fontB} className="text-[10px] text-white/30 mt-0.5">{player.name} — {player.teamName}</div>
              </div>
              <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 border border-white/10 text-right">
                <div className="flex gap-2 items-center justify-end">
                  <span style={fontM} className="text-[10px] text-white/40">COUNT</span>
                  <span style={fontM} className="text-lg text-white font-bold">{balls}-{strikes}</span>
                </div>
                <div style={fontM} className="text-[10px] text-white/40 mt-0.5">
                  AB {Math.min(abNumber + 1, level.totalABs)}/{level.totalABs}
                </div>
              </div>
            </div>
          )}

          {/* ── Result flash ── */}
          {screen === 'SWING_RESULT' && lastResult && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div style={{ ...fontD, color: RESULT_LABELS[lastResult.type]?.color, textShadow: '0 2px 20px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.5)' }}
                  className={`text-5xl tracking-wider ${lastResult.type === 'HR' ? 'animate-bounce' : ''}`}>
                  {lastResult.type === 'HR' ? '💣 ' : ''}{RESULT_LABELS[lastResult.type]?.text}
                </div>
                {lastResult.exitVelo != null && (
                  <div style={fontM} className="text-sm text-white/80 mt-2 drop-shadow-lg">
                    {lastResult.exitVelo} mph &middot; {lastResult.launchAngle}&deg; &middot; {lastResult.distance} ft
                  </div>
                )}
                {showPitchType && (
                  <div style={fontB} className="text-xs text-white/40 mt-1">
                    {PITCH_CONFIGS[pitchRef.current.type].name} — {Math.round(pitchRef.current.speed)} mph
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MENU ── */}
          {screen === 'MENU' && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-7xl mb-3">⚾</div>
                <h1 style={fontD} className="text-6xl tracking-wider text-[#f59e0b] mb-2">BATTING CAGE</h1>
                <p style={fontB} className="text-white/50 mb-8 max-w-md mx-auto">
                  Work your way from Little League to The Show. Hit dingers, climb levels, become a legend.
                </p>
                <button onClick={() => setScreen('CREATE_PLAYER')}
                  style={fontD} className="px-10 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-xl tracking-wide">
                  NEW CAREER
                </button>
                <div style={fontB} className="mt-5 text-xs text-white/25">
                  Move mouse to aim &middot; Click to swing &middot; Timing is everything
                </div>
                {highScores.length > 0 && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div style={fontD} className="text-xs text-white/30 tracking-[0.25em] mb-2">HIGH SCORES</div>
                    <div className="flex justify-center gap-4">
                      {highScores.map((s, i) => (
                        <span key={i} style={fontM} className="text-sm text-[#f59e0b]">{s} HR</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CREATE PLAYER ── */}
          {screen === 'CREATE_PLAYER' && (
            <div className="absolute inset-0 bg-[#0a0a0f]/94 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8 w-full max-w-md">
                <h2 style={fontD} className="text-3xl tracking-wider text-[#f59e0b] mb-6">CREATE YOUR PLAYER</h2>

                <div className="space-y-4 text-left">
                  <div>
                    <label style={fontD} className="text-xs tracking-[0.2em] text-white/50 block mb-1">PLAYER NAME</label>
                    <input type="text" value={createName} onChange={e => setCreateName(e.target.value)}
                      placeholder="Slugger" maxLength={20}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]/50 transition-colors"
                      style={fontB} />
                  </div>
                  <div>
                    <label style={fontD} className="text-xs tracking-[0.2em] text-white/50 block mb-1">TEAM NAME</label>
                    <input type="text" value={createTeam} onChange={e => setCreateTeam(e.target.value)}
                      placeholder="Dingers" maxLength={20}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]/50 transition-colors"
                      style={fontB} />
                  </div>
                  <div>
                    <label style={fontD} className="text-xs tracking-[0.2em] text-white/50 block mb-2">PRIMARY COLOR</label>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button key={'p' + c} onClick={() => setCreatePrimary(c)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${createPrimary === c ? 'border-white scale-125' : 'border-transparent opacity-70 hover:opacity-100'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={fontD} className="text-xs tracking-[0.2em] text-white/50 block mb-2">SECONDARY COLOR</label>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button key={'s' + c} onClick={() => setCreateSecondary(c)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${createSecondary === c ? 'border-white scale-125' : 'border-transparent opacity-70 hover:opacity-100'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-5 flex items-center justify-center gap-3">
                  <div className="w-10 h-14 rounded-md border border-white/10 relative overflow-hidden"
                    style={{ backgroundColor: createPrimary }}>
                    <div className="absolute bottom-0 left-0 right-0 h-2" style={{ backgroundColor: createSecondary }} />
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#dab894]" />
                  </div>
                  <div className="text-left">
                    <div style={fontD} className="text-lg text-white tracking-wide">{createName || 'Slugger'}</div>
                    <div style={fontB} className="text-xs text-white/40">{createTeam || 'Dingers'}</div>
                  </div>
                </div>

                <button onClick={confirmPlayer}
                  style={fontD} className="mt-6 px-10 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">
                  START CAREER
                </button>
              </div>
            </div>
          )}

          {/* ── LEVEL INTRO ── */}
          {screen === 'LEVEL_INTRO' && level && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div style={fontD} className="text-sm tracking-[0.3em] text-white/25 mb-2">LEVEL {levelIdx + 1} OF {LEVELS.length}</div>
                <h2 style={fontD} className="text-5xl tracking-wider text-[#f59e0b] mb-1">{level.name}</h2>
                <p style={fontB} className="text-white/50 mb-7">{level.subtitle}</p>

                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6">
                  {[
                    ['GOAL', `${level.requiredHR} HR`],
                    ['AT-BATS', `${level.totalABs}`],
                    ['SPEED', `${level.pitchSpeedMin}-${level.pitchSpeedMax}`],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <div style={fontD} className="text-[10px] tracking-widest text-white/40">{label}</div>
                      <div style={fontM} className="text-xl text-white font-bold">{val}</div>
                    </div>
                  ))}
                </div>

                <div className="mb-7">
                  <div style={fontD} className="text-[10px] tracking-widest text-white/25 mb-2">PITCHES</div>
                  <div className="flex justify-center gap-2">
                    {level.pitchTypes.map(pt => (
                      <span key={pt} style={{ ...fontM, borderColor: PITCH_CONFIGS[pt].color }}
                        className="text-xs px-2 py-1 rounded border text-white/70">{PITCH_CONFIGS[pt].name}</span>
                    ))}
                  </div>
                </div>

                <button onClick={startLevel}
                  style={fontD} className="px-10 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">
                  STEP UP TO THE PLATE
                </button>
              </div>
            </div>
          )}

          {/* ── LEVEL COMPLETE ── */}
          {screen === 'LEVEL_COMPLETE' && level && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-5xl mb-3">🎉</div>
                <h2 style={fontD} className="text-4xl tracking-wider text-[#4ade80] mb-1">LEVEL CLEARED!</h2>
                <p style={fontB} className="text-white/50 mb-6">You crushed {level.name}</p>
                <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={fontD} className="text-[10px] tracking-widest text-white/40">HOME RUNS</div>
                    <div style={fontM} className="text-2xl text-[#f59e0b] font-bold">{levelHRs}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div style={fontD} className="text-[10px] tracking-widest text-white/40">HITS</div>
                    <div style={fontM} className="text-2xl text-white font-bold">{levelHits}</div>
                  </div>
                </div>
                <button onClick={nextLevel}
                  style={fontD} className="px-10 py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-lg transition-colors text-lg tracking-wide">
                  NEXT LEVEL →
                </button>
              </div>
            </div>
          )}

          {/* ── LEVEL FAILED ── */}
          {screen === 'LEVEL_FAILED' && level && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-5xl mb-3">😤</div>
                <h2 style={fontD} className="text-4xl tracking-wider text-[#ef4444] mb-1">SENT DOWN</h2>
                <p style={fontB} className="text-white/50 mb-6">Needed {level.requiredHR} HR, only hit {levelHRs}</p>
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6">
                  {[
                    ['CAREER HR', careerStats.totalHR],
                    ['LONGEST', `${careerStats.longestHR} ft`],
                    ['MAX EV', `${careerStats.maxExitVelo} mph`],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <div style={fontD} className="text-[10px] tracking-widest text-white/40">{label}</div>
                      <div style={fontM} className="text-lg text-white font-bold">{val}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={startLevel}
                    style={fontD} className="px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">
                    TRY AGAIN
                  </button>
                  <button onClick={() => setScreen('MENU')}
                    style={fontD} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-lg tracking-wide">
                    MAIN MENU
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── CAREER COMPLETE ── */}
          {screen === 'CAREER_COMPLETE' && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-6xl mb-3">🏆</div>
                <h2 style={fontD} className="text-5xl tracking-wider text-[#f59e0b] mb-1">HALL OF FAME!</h2>
                <p style={fontB} className="text-white/50 mb-6">{player.name} is a dinger machine.</p>
                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-6">
                  {[
                    ['CAREER HR', careerStats.totalHR, true],
                    ['LONGEST', `${careerStats.longestHR} ft`, false],
                    ['MAX EV', `${careerStats.maxExitVelo} mph`, false],
                    ['TOTAL HITS', careerStats.totalHits, false],
                  ].map(([label, val, accent]) => (
                    <div key={String(label)} className={`bg-white/5 rounded-lg p-3 border ${accent ? 'border-[#f59e0b]/30' : 'border-white/10'}`}>
                      <div style={fontD} className={`text-[10px] tracking-widest ${accent ? 'text-[#f59e0b]' : 'text-white/40'}`}>{String(label)}</div>
                      <div style={fontM} className={`text-2xl font-bold ${accent ? 'text-[#f59e0b]' : 'text-white'}`}>{String(val)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setScreen('CREATE_PLAYER')}
                    style={fontD} className="px-8 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">
                    NEW CAREER
                  </button>
                  <button onClick={() => setScreen('MENU')}
                    style={fontD} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-lg tracking-wide">
                    MAIN MENU
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2a] px-4 py-3 text-center">
        <span style={fontB} className="text-xs text-white/30">
          ⚾ Dingers Only Batting Cage — <Link href="/" className="text-[#f59e0b]/60 hover:text-[#f59e0b] transition-colors">Back to League</Link>
        </span>
      </footer>
    </div>
  )
}
