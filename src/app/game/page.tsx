'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

/* ═══════ TYPES ═══════ */

type PT = 'fastball' | 'changeup' | 'slider' | 'curveball' | 'cutter'
type Screen = 'MENU' | 'CREATE' | 'INTRO' | 'AT_BAT' | 'PITCHING' | 'RESULT' | 'LEVEL_WIN' | 'LEVEL_FAIL' | 'CAREER_WIN'

interface Lv { name: string; sub: string; spdMin: number; spdMax: number; types: PT[]; fence: number; reqHR: number; abs: number; szMul: number }
interface PC { name: string; sMul: number; hM: number; vM: number; color: string }
interface Res { type: 'HR'|'TRIPLE'|'DOUBLE'|'SINGLE'|'FLY_OUT'|'GROUND_OUT'|'LINE_OUT'|'STRIKE'|'BALL'|'FOUL'; ev?: number; la?: number; dist?: number; desc: string }
interface Stats { hr: number; hits: number; ab: number; ks: number; longHR: number; maxEV: number; lvls: number }
interface Player { name: string; team: string; pri: string; sec: string }

/* ═══════ CONSTANTS ═══════ */

const CW = 800, CH = 560
const FY = 180, MY = 280, PY = 470
const SZX = 400, SZY = 385, SZBW = 120, SZBH = 100

const PCS: Record<PT, PC> = {
  fastball:  { name: 'Fastball',  sMul: 1.0,  hM: 0,   vM: -2,  color: '#ef4444' },
  changeup:  { name: 'Changeup',  sMul: 0.82, hM: 3,   vM: 8,   color: '#22c55e' },
  slider:    { name: 'Slider',    sMul: 0.88, hM: 14,  vM: 3,   color: '#3b82f6' },
  curveball: { name: 'Curveball', sMul: 0.78, hM: -4,  vM: 18,  color: '#a855f7' },
  cutter:    { name: 'Cutter',    sMul: 0.94, hM: -8,  vM: 2,   color: '#f97316' },
}

// HARDER challenges: more HRs needed, fewer ABs
const LVS: Lv[] = [
  { name: 'LITTLE LEAGUE', sub: 'Where legends begin', spdMin: 45, spdMax: 55, types: ['fastball'], fence: 200, reqHR: 3, abs: 10, szMul: 1.3 },
  { name: 'HIGH SCHOOL', sub: 'Varsity tryouts', spdMin: 62, spdMax: 74, types: ['fastball', 'changeup'], fence: 310, reqHR: 4, abs: 12, szMul: 1.15 },
  { name: 'COLLEGE', sub: 'NCAA regionals', spdMin: 78, spdMax: 88, types: ['fastball', 'changeup', 'slider'], fence: 360, reqHR: 4, abs: 10, szMul: 1.0 },
  { name: 'THE SHOW', sub: 'Welcome to the bigs', spdMin: 90, spdMax: 101, types: ['fastball', 'changeup', 'slider', 'curveball', 'cutter'], fence: 400, reqHR: 5, abs: 14, szMul: 0.9 },
]

const COLS = ['#dc2626','#ea580c','#d97706','#16a34a','#0d9488','#2563eb','#4f46e5','#9333ea','#db2777','#e2e8f0']

const RS: Record<string, { t: string; c: string }> = {
  HR:{t:'HOME RUN!',c:'#f59e0b'}, TRIPLE:{t:'TRIPLE!',c:'#a855f7'}, DOUBLE:{t:'DOUBLE!',c:'#3b82f6'},
  SINGLE:{t:'SINGLE!',c:'#22c55e'}, FLY_OUT:{t:'Fly Out',c:'#ef4444'}, GROUND_OUT:{t:'Ground Out',c:'#ef4444'},
  LINE_OUT:{t:'Line Out',c:'#ef4444'}, STRIKE:{t:'STRIKE!',c:'#ef4444'}, BALL:{t:'Ball',c:'#94a3b8'}, FOUL:{t:'Foul Ball',c:'#fbbf24'},
}

/* ═══════ HELPERS ═══════ */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const rand = (a: number, b: number) => Math.random() * (b - a) + a
const randI = (a: number, b: number) => Math.floor(rand(a, b + 1))
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const easeIn = (t: number) => t * t
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t)
const easeIO = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/* ═══════ DRAWING: BUBBLY INFOGRAPHIC CHARACTERS ═══════ */

function drawBubblePitcher(ctx: CanvasRenderingContext2D, phase: string) {
  ctx.save()
  ctx.translate(400, MY - 5)
  const s = 1.6

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath(); ctx.ellipse(0, 30 * s, 18 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill()

  // Body — big rounded pill shape (gray jersey)
  ctx.fillStyle = '#c0c0c8'
  ctx.beginPath()
  ctx.ellipse(0, 8 * s, 14 * s, 18 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  // Body highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath(); ctx.ellipse(-4 * s, 2 * s, 6 * s, 10 * s, -0.2, 0, Math.PI * 2); ctx.fill()

  // Stubby legs
  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath(); ctx.ellipse(-5 * s, 26 * s, 5 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(5 * s, 26 * s, 5 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill()
  // Shoes
  ctx.fillStyle = '#333'
  ctx.beginPath(); ctx.ellipse(-5 * s, 30 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(5 * s, 30 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill()

  // Arms — round stumpy arms
  ctx.fillStyle = '#dab894'
  if (phase === 'windup') {
    // Glove arm out
    ctx.beginPath(); ctx.ellipse(-16 * s, 4 * s, 6 * s, 5 * s, -0.3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#5a3010'
    ctx.beginPath(); ctx.ellipse(-20 * s, 6 * s, 5 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill()
    // Throwing arm up with ball
    ctx.fillStyle = '#dab894'
    ctx.beginPath(); ctx.ellipse(14 * s, -10 * s, 6 * s, 5 * s, 0.5, 0, Math.PI * 2); ctx.fill()
    // Baseball
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(18 * s, -14 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#cc3333'; ctx.lineWidth = 0.6 * s
    ctx.beginPath(); ctx.arc(17 * s, -14 * s, 2 * s, -0.5, 0.5); ctx.stroke()
  } else if (phase === 'thrown') {
    ctx.beginPath(); ctx.ellipse(-14 * s, 10 * s, 6 * s, 5 * s, 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#5a3010'
    ctx.beginPath(); ctx.ellipse(-17 * s, 13 * s, 5 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#dab894'
    ctx.beginPath(); ctx.ellipse(14 * s, 12 * s, 6 * s, 5 * s, -0.3, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.beginPath(); ctx.ellipse(-14 * s, 8 * s, 5 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#5a3010'
    ctx.beginPath(); ctx.ellipse(-17 * s, 10 * s, 5 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#dab894'
    ctx.beginPath(); ctx.ellipse(14 * s, 8 * s, 5 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill()
  }

  // BIG round head
  ctx.fillStyle = '#dab894'
  ctx.beginPath(); ctx.arc(0, -14 * s, 12 * s, 0, Math.PI * 2); ctx.fill()
  // Head highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.arc(-3 * s, -18 * s, 5 * s, 0, Math.PI * 2); ctx.fill()
  // Cap — rounded
  ctx.fillStyle = '#2a2a3a'
  ctx.beginPath(); ctx.arc(0, -18 * s, 11 * s, Math.PI, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(0, -18 * s, 13 * s, 4 * s, 0, 0, Math.PI); ctx.fill()
  // Eyes — big round cartoon eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.ellipse(-4 * s, -14 * s, 3 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(4 * s, -14 * s, 3 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#222'
  ctx.beginPath(); ctx.arc(-3.5 * s, -13.5 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(4.5 * s, -13.5 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill()
  // Eye shine
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(-4 * s, -14.5 * s, 0.7 * s, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(4 * s, -14.5 * s, 0.7 * s, 0, Math.PI * 2); ctx.fill()
  // Smile
  ctx.strokeStyle = '#8a6040'; ctx.lineWidth = 1 * s; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(0, -10 * s, 4 * s, 0.2, Math.PI - 0.2); ctx.stroke()

  ctx.restore()
}

function drawBubbleBatter(ctx: CanvasRenderingContext2D, pri: string, sec: string, sw: boolean, sp: number) {
  ctx.save()
  ctx.translate(370, PY)
  const s = 2.0

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath(); ctx.ellipse(2 * s, 22 * s, 16 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill()

  // Stubby legs
  ctx.fillStyle = '#e0e0e0'
  ctx.beginPath(); ctx.ellipse(-4 * s, 18 * s, 5 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(6 * s, 18 * s, 5 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill()
  // Shoes
  ctx.fillStyle = '#333'
  ctx.beginPath(); ctx.ellipse(-4 * s, 22 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(6 * s, 22 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill()

  // Body — big rounded pill (jersey color)
  ctx.fillStyle = pri
  ctx.beginPath(); ctx.ellipse(1 * s, 5 * s, 14 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill()
  // Body highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath(); ctx.ellipse(-3 * s, 0, 6 * s, 10 * s, -0.15, 0, Math.PI * 2); ctx.fill()
  // Stripe
  ctx.fillStyle = sec
  ctx.beginPath(); ctx.ellipse(1 * s, 4 * s, 12 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill()
  // Number on back
  ctx.strokeStyle = sec; ctx.lineWidth = 1.5; ctx.font = `bold ${8 * s}px Arial`; ctx.textAlign = 'center'
  ctx.strokeText('7', 1 * s, 10 * s)

  // Bat arm + bat
  ctx.save()
  const ax = 12 * s, ay = 0
  if (sw) {
    const angle = lerp(-1.4, 2.0, easeIO(clamp(sp, 0, 1)))
    ctx.translate(ax, ay); ctx.rotate(angle)
    // Round arm
    ctx.fillStyle = '#dab894'
    ctx.beginPath(); ctx.ellipse(6 * s, 0, 6 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill()
    // Batting glove
    ctx.fillStyle = sec
    ctx.beginPath(); ctx.ellipse(11 * s, 0, 4 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill()
    // Bat — smooth tapered
    ctx.fillStyle = '#A07020'
    ctx.beginPath()
    ctx.moveTo(10 * s, -2.5 * s); ctx.lineTo(30 * s, -3.5 * s)
    ctx.quadraticCurveTo(35 * s, -2.5 * s, 35 * s, 0)
    ctx.quadraticCurveTo(35 * s, 2.5 * s, 30 * s, 2 * s)
    ctx.lineTo(10 * s, 2.5 * s); ctx.closePath(); ctx.fill()
    // Barrel
    ctx.fillStyle = '#C09030'
    ctx.beginPath()
    ctx.moveTo(27 * s, -4 * s)
    ctx.quadraticCurveTo(37 * s, -4 * s, 37 * s, 0)
    ctx.quadraticCurveTo(37 * s, 4 * s, 27 * s, 3 * s)
    ctx.closePath(); ctx.fill()
    // Knob
    ctx.fillStyle = '#806018'; ctx.beginPath(); ctx.arc(10 * s, 0, 3 * s, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.translate(ax, ay); ctx.rotate(-1.3)
    ctx.fillStyle = '#dab894'
    ctx.beginPath(); ctx.ellipse(5 * s, 0, 5 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = sec
    ctx.beginPath(); ctx.ellipse(9 * s, -1 * s, 3.5 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill()
    // Bat upright
    ctx.fillStyle = '#A07020'
    ctx.beginPath(); ctx.moveTo(7 * s, -1 * s); ctx.lineTo(10 * s, -24 * s); ctx.lineTo(13 * s, -24 * s); ctx.lineTo(10 * s, 1 * s); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#C09030'
    ctx.beginPath()
    ctx.moveTo(9 * s, -22 * s); ctx.quadraticCurveTo(8 * s, -30 * s, 11.5 * s, -30 * s)
    ctx.quadraticCurveTo(15 * s, -30 * s, 14 * s, -22 * s); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#806018'; ctx.beginPath(); ctx.arc(8.5 * s, 0, 2.5 * s, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()

  // Front arm
  ctx.fillStyle = '#dab894'
  ctx.beginPath(); ctx.ellipse(-10 * s, 4 * s, 5 * s, 4.5 * s, -0.2, 0, Math.PI * 2); ctx.fill()

  // BIG round helmet/head (from behind)
  ctx.fillStyle = pri
  ctx.beginPath(); ctx.arc(1 * s, -16 * s, 12 * s, 0, Math.PI * 2); ctx.fill()
  // Helmet shine
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath(); ctx.arc(-2 * s, -21 * s, 5 * s, 0, Math.PI * 2); ctx.fill()
  // Ear flap
  ctx.fillStyle = pri
  ctx.beginPath(); ctx.ellipse(10 * s, -11 * s, 4 * s, 6 * s, 0.2, 0, Math.PI * 2); ctx.fill()
  // Neck
  ctx.fillStyle = '#dab894'
  ctx.beginPath(); ctx.ellipse(1 * s, -6 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill()

  ctx.restore()
}

function drawBubbleCatcher(ctx: CanvasRenderingContext2D) {
  ctx.save(); ctx.translate(408, PY + 8)
  const s = 1.2
  // Body blob
  ctx.fillStyle = '#555'
  ctx.beginPath(); ctx.ellipse(0, 2 * s, 12 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill()
  // Head
  ctx.fillStyle = '#444'
  ctx.beginPath(); ctx.arc(0, -8 * s, 8 * s, 0, Math.PI * 2); ctx.fill()
  // Mask
  ctx.strokeStyle = '#777'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(-4 * s, -10 * s); ctx.lineTo(-4 * s, -4 * s); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(4 * s, -10 * s); ctx.lineTo(4 * s, -4 * s); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-6 * s, -7 * s); ctx.lineTo(6 * s, -7 * s); ctx.stroke()
  // Big mitt
  ctx.fillStyle = '#8B5020'
  ctx.beginPath(); ctx.ellipse(12 * s, -3 * s, 7 * s, 6 * s, 0.2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#A06830'
  ctx.beginPath(); ctx.ellipse(12 * s, -3 * s, 5 * s, 4 * s, 0.2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/* ═══════ DRAWING: BACKGROUNDS ═══════ */

function drawSky0(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, FY + 10)
  g.addColorStop(0, '#3b8de0'); g.addColorStop(0.55, '#6db8f0'); g.addColorStop(1, '#a8daf5')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, FY + 10)
  // Sun
  const sg = ctx.createRadialGradient(680, 50, 10, 680, 50, 90)
  sg.addColorStop(0, 'rgba(255,248,200,1)'); sg.addColorStop(0.3, 'rgba(255,240,150,0.6)')
  sg.addColorStop(0.6, 'rgba(255,220,100,0.15)'); sg.addColorStop(1, 'rgba(255,220,100,0)')
  ctx.fillStyle = sg; ctx.fillRect(590, 0, 180, 140)
  ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.arc(680, 50, 28, 0, Math.PI * 2); ctx.fill()
  // Clouds
  const cloud = (cx: number, cy: number, sc: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    for (const [dx, dy, r] of [[-14,4,11],[0,-3,16],[14,2,13],[7,-9,10],[-8,-7,9]]) {
      ctx.beginPath(); ctx.arc(cx + dx * sc, cy + dy * sc, r * sc, 0, Math.PI * 2); ctx.fill()
    }
  }
  cloud(140, 55, 1.1); cloud(380, 40, 0.7); cloud(530, 70, 0.9)
  // Trees
  ctx.fillStyle = '#1a6030'
  for (let x = 20; x < CW; x += 45) { ctx.beginPath(); ctx.arc(x + rand(-5, 5), FY - 16, 20, 0, Math.PI * 2); ctx.fill() }
  const tree = (tx: number, sc: number) => {
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(tx - 3 * sc, FY - 10 * sc, 6 * sc, 14 * sc)
    ctx.fillStyle = '#2a8840'; ctx.beginPath(); ctx.arc(tx, FY - 18 * sc, 16 * sc, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#238838'
    ctx.beginPath(); ctx.arc(tx - 8 * sc, FY - 10 * sc, 12 * sc, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(tx + 9 * sc, FY - 12 * sc, 13 * sc, 0, Math.PI * 2); ctx.fill()
  }
  tree(70, 1.1); tree(200, 1.3); tree(340, 0.9); tree(470, 1.0); tree(600, 1.2); tree(730, 1.0)
}

function drawSky1(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, FY + 10)
  g.addColorStop(0, '#4a7ab8'); g.addColorStop(0.4, '#78a8d0'); g.addColorStop(0.75, '#d8b868'); g.addColorStop(1, '#c89838')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, FY + 10)
  for (let i = 0; i < 3; i++) {
    const bx = 40 + i * 270, bw = 200, bh = 40, by = FY - bh - 5
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(bx, by, bw, bh)
    for (let r = 0; r < 4; r++) { ctx.fillStyle = r % 2 === 0 ? '#a5a5a5' : '#929292'; ctx.fillRect(bx, by + r * 10, bw, 9) }
    for (let c = 0; c < 18; c++) {
      const cx = bx + 6 + c * 11, cy = by + 3 + (c % 4) * 10
      ctx.fillStyle = pick(['#dab894', '#c49570', '#8d6040']); ctx.beginPath(); ctx.arc(cx, cy - 2, 3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = pick(['#dc2626', '#2563eb', '#f59e0b', '#fff', '#16a34a', '#666']); ctx.fillRect(cx - 2.5, cy + 1, 5, 4)
    }
  }
}

function drawSky2(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, FY + 10)
  g.addColorStop(0, '#0e0828'); g.addColorStop(0.3, '#2a1458'); g.addColorStop(0.5, '#6a2a78'); g.addColorStop(0.8, '#c06040'); g.addColorStop(1, '#d89040')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, FY + 10)
  ctx.fillStyle = '#1a1235'; ctx.beginPath()
  ctx.moveTo(-20, FY + 5); ctx.quadraticCurveTo(400, FY - 55, 820, FY + 5)
  ctx.lineTo(820, FY - 20); ctx.quadraticCurveTo(400, FY - 80, -20, FY - 20); ctx.closePath(); ctx.fill()
  for (let c = 0; c < 65; c++) {
    const cx = 10 + c * 12.2
    ctx.fillStyle = pick(['#dc2626', '#2563eb', '#f59e0b', '#fff', '#16a34a', '#9333ea', '#ddd'])
    ctx.beginPath(); ctx.arc(cx, FY - 30 - Math.sin((cx / CW) * Math.PI) * 35 + rand(-2, 2), 2.5, 0, Math.PI * 2); ctx.fill()
  }
  const light = (lx: number) => {
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(lx - 3, 15, 6, FY - 30)
    ctx.fillStyle = '#4a4a5a'; ctx.fillRect(lx - 22, 10, 44, 12)
    for (let b = -2; b <= 2; b++) { ctx.fillStyle = '#fffde0'; ctx.beginPath(); ctx.arc(lx + b * 8, 16, 3.5, 0, Math.PI * 2); ctx.fill() }
    const gl = ctx.createRadialGradient(lx, 16, 5, lx, 16, 100)
    gl.addColorStop(0, 'rgba(255,255,200,0.3)'); gl.addColorStop(1, 'rgba(255,255,200,0)')
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, 16, 100, 0, Math.PI * 2); ctx.fill()
  }
  light(90); light(710)
}

function drawSky3(ctx: CanvasRenderingContext2D, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, FY + 10)
  g.addColorStop(0, '#020210'); g.addColorStop(0.5, '#08082a'); g.addColorStop(1, '#0a0a30')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, FY + 10)
  const stars = [[40,12],[100,30],[170,8],[230,45],[300,15],[370,38],[440,10],[510,42],[570,20],[640,8],[700,35],[760,15]]
  for (const [sx, sy] of stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.sin(t / 600 + sx * 0.1); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI * 2); ctx.fill() }
  ctx.globalAlpha = 1
  ctx.fillStyle = '#0c0c28'; ctx.beginPath(); ctx.moveTo(-20, FY - 15); ctx.quadraticCurveTo(400, FY - 75, 820, FY - 15); ctx.lineTo(820, FY - 50); ctx.quadraticCurveTo(400, FY - 110, -20, FY - 50); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#101038'; ctx.beginPath(); ctx.moveTo(-20, FY + 5); ctx.quadraticCurveTo(400, FY - 40, 820, FY + 5); ctx.lineTo(820, FY - 15); ctx.quadraticCurveTo(400, FY - 60, -20, FY - 15); ctx.closePath(); ctx.fill()
  for (let tier = 0; tier < 2; tier++) {
    const count = tier === 0 ? 55 : 70, base = tier === 0 ? FY - 65 : FY - 30, curve = tier === 0 ? 32 : 22
    for (let c = 0; c < count; c++) {
      const cx = 10 + c * (780 / count), bounce = Math.sin(t / 250 + c * 0.8 + tier * 2) * 1.8
      ctx.fillStyle = pick(['#dc2626', '#2563eb', '#f59e0b', '#fff', '#16a34a', '#9333ea', '#fbbf24', '#ccc'])
      ctx.beginPath(); ctx.arc(cx, base - Math.sin((cx / CW) * Math.PI) * curve + bounce, 2.5, 0, Math.PI * 2); ctx.fill()
    }
  }
  const bl = (lx: number) => {
    ctx.fillStyle = '#282838'; ctx.fillRect(lx - 4, 0, 8, FY - 60)
    ctx.fillStyle = '#383848'; ctx.fillRect(lx - 30, 0, 60, 16)
    for (let b = -3; b <= 3; b++) { ctx.fillStyle = '#fffde0'; ctx.beginPath(); ctx.arc(lx + b * 7.5, 8, 3.5, 0, Math.PI * 2); ctx.fill() }
    const gl = ctx.createRadialGradient(lx, 8, 8, lx, 8, 140)
    gl.addColorStop(0, 'rgba(255,255,230,0.35)'); gl.addColorStop(0.4, 'rgba(255,255,210,0.08)'); gl.addColorStop(1, 'rgba(255,255,200,0)')
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, 8, 140, 0, Math.PI * 2); ctx.fill()
  }
  bl(60); bl(240); bl(560); bl(740)
}

/* ═══════ DRAWING: FIELD ═══════ */

function drawField(ctx: CanvasRenderingContext2D, li: number) {
  const greens = [['#2d8040','#35903a','#2a7035'],['#25702c','#2e8032','#1d5e24'],['#1c5c24','#246a2c','#16501c'],['#1a5820','#206228','#143e18']][li]
  const gg = ctx.createLinearGradient(0, FY, 0, CH)
  gg.addColorStop(0, greens[0]); gg.addColorStop(0.5, greens[1]); gg.addColorStop(1, greens[2])
  ctx.fillStyle = gg; ctx.fillRect(0, FY, CW, CH - FY)
  if (li >= 2) for (let i = 0; i < 16; i++) { if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.018)'; ctx.fillRect(0, FY + i * 24, CW, 24) } }

  // Wall
  if (li === 0) { ctx.fillStyle = '#6a6a6a'; ctx.fillRect(0, FY - 2, CW, 5); for (let p = 40; p < CW; p += 65) { ctx.fillStyle = '#909090'; ctx.beginPath(); ctx.arc(p, FY - 18, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#808080'; ctx.fillRect(p - 1.5, FY - 18, 3, 20) } }
  else if (li === 1) { ctx.fillStyle = '#5c3820'; ctx.fillRect(0, FY - 10, CW, 13) }
  else if (li === 2) { ctx.fillStyle = '#1a3868'; ctx.fillRect(0, FY - 14, CW, 17) }
  else { ctx.fillStyle = '#081830'; ctx.fillRect(0, FY - 18, CW, 21); ctx.fillStyle = '#e8b820'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('330', 160, FY - 4); ctx.fillText('400', 400, FY - 4); ctx.fillText('330', 640, FY - 4) }

  // Foul lines
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(400, FY + 5); ctx.lineTo(120, CH + 20); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(400, FY + 5); ctx.lineTo(680, CH + 20); ctx.stroke()

  // Infield dirt
  const dg = ctx.createRadialGradient(400, 390, 30, 400, 390, 160)
  dg.addColorStop(0, li === 0 ? '#b8986a' : '#9a8058'); dg.addColorStop(1, li === 0 ? '#907848' : '#786040')
  ctx.fillStyle = dg; ctx.beginPath()
  ctx.moveTo(400, 310); ctx.bezierCurveTo(490, 340, 520, 400, 490, 460)
  ctx.quadraticCurveTo(400, 500, 310, 460); ctx.bezierCurveTo(280, 400, 310, 340, 400, 310)
  ctx.closePath(); ctx.fill()
  if (li >= 1) { ctx.fillStyle = li >= 3 ? '#1a5822' : '#22682c'; ctx.beginPath(); ctx.moveTo(400, 340); ctx.bezierCurveTo(450, 355, 460, 390, 440, 420); ctx.quadraticCurveTo(400, 438, 360, 420); ctx.bezierCurveTo(340, 390, 350, 355, 400, 340); ctx.closePath(); ctx.fill() }

  // Mound
  const mg = ctx.createRadialGradient(400, MY + 5, 5, 400, MY + 5, 30)
  mg.addColorStop(0, '#b09068'); mg.addColorStop(1, '#907850')
  ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(400, MY + 5, 30, 12, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#d8d8d8'; ctx.fillRect(393, MY - 1, 14, 3)

  // Home plate area
  const pg = ctx.createRadialGradient(400, PY + 2, 5, 400, PY + 2, 55)
  pg.addColorStop(0, '#b09068'); pg.addColorStop(1, '#907850')
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(400, PY + 2, 55, 18, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#e0e0e0'; ctx.beginPath(); ctx.moveTo(400, PY + 8); ctx.lineTo(393, PY + 2); ctx.lineTo(393, PY - 4); ctx.lineTo(407, PY - 4); ctx.lineTo(407, PY + 2); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.strokeRect(355, PY - 20, 25, 42); ctx.strokeRect(420, PY - 20, 25, 42)
}

/* ═══════ COMPONENT ═══════ */

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [screen, setScreen] = useState<Screen>('MENU')
  const [li, setLi] = useState(0)
  const [abN, setAbN] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [balls2, setBalls2] = useState(0)
  const [lvHR, setLvHR] = useState(0)
  const [lvHits, setLvHits] = useState(0)
  const [lastR, setLastR] = useState<Res | null>(null)
  const [showPT, setShowPT] = useState(false)
  const [career, setCareer] = useState<Stats>({ hr: 0, hits: 0, ab: 0, ks: 0, longHR: 0, maxEV: 0, lvls: 0 })
  const [hs, setHs] = useState<number[]>([])
  const [pl, setPl] = useState<Player>({ name: '', team: '', pri: '#dc2626', sec: '#e2e8f0' })
  const [cN, setCN] = useState(''); const [cT, setCT] = useState('')
  const [cP, setCP] = useState('#dc2626'); const [cS, setCS] = useState('#e2e8f0')

  const mouse = useRef({ x: SZX, y: SZY })
  const pitch = useRef({ active: false, type: 'fastball' as PT, sx: 400, sy: MY - 20, tx: 400, ty: SZY, cx: 400, cy: MY, prog: 0, spd: 85, arr: 600, tt: 0, hB: 0, vB: 0 })
  const sw = useRef({ swung: false, t: 0, x: 400, y: SZY })
  const anim = useRef(0)
  const scrR = useRef(screen); const liR = useRef(li)
  const kR = useRef(strikes); const bR = useRef(balls2)
  const lvHRR = useRef(lvHR)
  const resT = useRef(0); const pDelay = useRef(0)
  const waitR = useRef(false); const pPhase = useRef<'idle' | 'windup' | 'thrown'>('idle')
  const hrP = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number }>>([])

  useEffect(() => { scrR.current = screen }, [screen])
  useEffect(() => { liR.current = li }, [li])
  useEffect(() => { kR.current = strikes }, [strikes])
  useEffect(() => { bR.current = balls2 }, [balls2])
  useEffect(() => { lvHRR.current = lvHR }, [lvHR])
  useEffect(() => { try { const s = localStorage.getItem('dg-hs3'); if (s) setHs(JSON.parse(s)) } catch { /* */ } }, [])

  const saveHS = useCallback((hrs: number) => { setHs(p => { const n = [...p, hrs].sort((a, b) => b - a).slice(0, 5); try { localStorage.setItem('dg-hs3', JSON.stringify(n)) } catch { /* */ }; return n }) }, [])

  const lv = LVS[li]
  const szW = SZBW * (lv?.szMul ?? 1), szH = SZBH * (lv?.szMul ?? 1)
  const szL = SZX - szW / 2, szR = SZX + szW / 2, szT = SZY - szH / 2, szB = SZY + szH / 2

  /* ── PITCH ── */
  const throwP = useCallback(() => {
    if (!lv) return
    const type = pick(lv.types), cfg = PCS[type]
    const spd = rand(lv.spdMin, lv.spdMax) * cfg.sMul
    const inZ = Math.random() < 0.6 // slightly fewer strikes = harder
    let tx: number, ty: number
    if (inZ) { tx = rand(szL + 8, szR - 8); ty = rand(szT + 8, szB - 8) }
    else { const side = randI(0, 3); if (side === 0) { tx = rand(szL - 30, szL - 5); ty = rand(szT, szB) } else if (side === 1) { tx = rand(szR + 5, szR + 30); ty = rand(szT, szB) } else if (side === 2) { tx = rand(szL, szR); ty = rand(szT - 30, szT - 5) } else { tx = rand(szL, szR); ty = rand(szB + 5, szB + 30) } }
    // SLOWER pitch flight
    const flight = lerp(1100, 580, (spd - 40) / 65)
    const brk = lv.szMul > 1 ? 0.5 : 1.0
    pPhase.current = 'windup'
    setTimeout(() => {
      pPhase.current = 'thrown'
      pitch.current = { active: true, type, sx: 400 + rand(-6, 6), sy: MY - 20, tx, ty, cx: 400, cy: MY, prog: 0, spd, arr: flight, tt: performance.now(), hB: cfg.hM * brk, vB: cfg.vM * brk }
      sw.current = { swung: false, t: 0, x: 400, y: SZY }
      setShowPT(false)
    }, 500) // longer windup
  }, [lv, szL, szR, szT, szB])

  /* ── RESULT CALC ── */
  const calcR = useCallback((sx2: number, sy2: number, st: number, px: number, py: number, at: number, tt: number): Res => {
    if (!lv) return { type: 'STRIKE', desc: '' }
    const tD = Math.abs(st - (tt + at)), pD = Math.sqrt((sx2 - px) ** 2 + (sy2 - py) ** 2)
    let tS: number; if (tD < 35) tS = 1; else if (tD < 70) tS = 0.88; else if (tD < 120) tS = 0.7; else if (tD < 190) tS = 0.45; else if (tD < 280) tS = 0.2; else tS = 0.05
    const pS = Math.max(0, 1 - pD / 80), contact = tS * 0.55 + pS * 0.45
    if (contact < 0.12 || pD > 70) { const inZ2 = px >= szL && px <= szR && py >= szT && py <= szB; return (inZ2 || sw.current.swung) ? { type: 'STRIKE', desc: 'Whiff!' } : { type: 'BALL', desc: 'Ball' } }
    if (contact < 0.25 && Math.random() < 0.6) return { type: 'FOUL', desc: 'Foul ball' }
    const ev = lerp(55, 112, Math.pow(contact, 0.8)) + rand(-5, 5), vD = (sy2 - py) / szH
    const la = lerp(-15, 50, clamp(0.5 - vD * 1.5, 0, 1)) + rand(-(1 - contact) * 25, (1 - contact) * 25)
    const rad = (la * Math.PI) / 180, v0 = ev * 1.467, hang = (2 * v0 * Math.sin(rad)) / 32.2
    let dist = Math.max(0, v0 * Math.cos(rad) * Math.max(0, hang) * 0.7) * lerp(0.4, 1.1, contact)
    const e = Math.round(ev), l = Math.round(la), d = Math.round(dist)
    if (la < 5) { dist = Math.min(dist, rand(80, 200)); return contact > 0.5 && Math.random() < 0.3 ? { type: 'SINGLE', ev: e, la: l, dist: Math.round(dist), desc: `Ground single! ${e} mph` } : { type: 'GROUND_OUT', ev: e, la: l, dist: Math.round(dist), desc: 'Grounded out' } }
    if (la > 55) return { type: 'FLY_OUT', ev: e, la: l, dist: Math.round(Math.min(dist, 180)), desc: 'Popped up' }
    if (dist >= lv.fence) return { type: 'HR', ev: e, la: l, dist: d, desc: `GONE! ${d} ft` }
    if (dist > lv.fence * 0.85 && la > 15) return Math.random() < 0.4 ? { type: 'FLY_OUT', ev: e, la: l, dist: d, desc: 'Warning track!' } : { type: 'TRIPLE', ev: e, la: l, dist: d, desc: `Triple! ${d} ft` }
    if (dist > lv.fence * 0.55) return la > 25 && Math.random() < 0.35 ? { type: 'FLY_OUT', ev: e, la: l, dist: d, desc: 'Caught' } : { type: 'DOUBLE', ev: e, la: l, dist: d, desc: `Double! ${d} ft` }
    if (contact > 0.4) return la > 20 && Math.random() < 0.4 ? { type: 'FLY_OUT', ev: e, la: l, dist: d, desc: 'Fly out' } : { type: 'SINGLE', ev: e, la: l, dist: d, desc: `Base hit! ${e} mph` }
    return Math.random() < 0.5 ? { type: 'LINE_OUT', ev: e, la: l, dist: d, desc: 'Lined out' } : { type: 'FLY_OUT', ev: e, la: l, dist: d, desc: 'Fly out' }
  }, [lv, szL, szR, szT, szB, szH])

  /* ── CHECK END — now with EARLY completion ── */
  const checkEnd = useCallback((nAB: number, curHR: number) => {
    if (!lv) return
    // WIN: hit enough HRs (can happen BEFORE using all ABs)
    if (curHR >= lv.reqHR) {
      setTimeout(() => {
        setCareer(s => ({ ...s, lvls: s.lvls + 1 }))
        if (li >= LVS.length - 1) { saveHS(curHR); setScreen('CAREER_WIN') }
        else setScreen('LEVEL_WIN')
      }, 400)
      return
    }
    // FAIL: used all ABs without enough HRs
    if (nAB >= lv.abs) {
      setTimeout(() => { saveHS(curHR); setScreen('LEVEL_FAIL') }, 400)
      return
    }
    // Continue
    setTimeout(() => { pPhase.current = 'idle'; setScreen('AT_BAT'); waitR.current = true; pDelay.current = performance.now() + rand(900, 1600) }, 400)
  }, [lv, li, saveHS])

  /* ── PROCESS RESULT ── */
  const processR = useCallback((r: Res) => {
    setLastR(r); setShowPT(true); resT.current = performance.now()
    const isHit = ['HR', 'TRIPLE', 'DOUBLE', 'SINGLE'].includes(r.type)
    const isEnd = isHit || ['FLY_OUT', 'GROUND_OUT', 'LINE_OUT'].includes(r.type)
    const isK = r.type === 'STRIKE' || r.type === 'FOUL'

    let newHR = lvHRR.current
    if (r.type === 'HR') {
      newHR = lvHRR.current + 1
      setLvHR(newHR); setLvHits(h => h + 1)
      setCareer(s => ({ ...s, hr: s.hr + 1, hits: s.hits + 1, longHR: Math.max(s.longHR, r.dist ?? 0), maxEV: Math.max(s.maxEV, r.ev ?? 0) }))
      hrP.current = Array.from({ length: 20 }, () => ({ x: sw.current.x, y: sw.current.y, vx: rand(-4, 4), vy: rand(-6, -1), life: rand(0.6, 1) }))
    } else if (isHit) {
      setLvHits(h => h + 1); setCareer(s => ({ ...s, hits: s.hits + 1, maxEV: Math.max(s.maxEV, r.ev ?? 0) }))
    }

    if (isK) {
      const nk = kR.current + 1; setStrikes(nk)
      if (nk >= 3) {
        // SLOWER result display
        setTimeout(() => {
          setStrikes(0); setBalls2(0)
          const n = abN + 1; setAbN(n)
          setCareer(s => ({ ...s, ab: s.ab + 1, ks: s.ks + 1 }))
          checkEnd(n, newHR)
        }, 1500)
        return
      }
    } else if (r.type === 'BALL') {
      const nb = bR.current + 1; setBalls2(nb)
      if (nb >= 4) {
        setTimeout(() => { setStrikes(0); setBalls2(0); pPhase.current = 'idle'; setScreen('AT_BAT'); waitR.current = true; pDelay.current = performance.now() + rand(900, 1600) }, 1200)
        return
      }
    }

    if (isEnd) {
      // SLOWER transitions
      setTimeout(() => {
        setStrikes(0); setBalls2(0)
        const n = abN + 1; setAbN(n)
        setCareer(s => ({ ...s, ab: s.ab + 1 }))
        checkEnd(n, newHR)
      }, r.type === 'HR' ? 2800 : 1800)
      return
    }

    setTimeout(() => { pPhase.current = 'idle'; setScreen('AT_BAT'); waitR.current = true; pDelay.current = performance.now() + rand(700, 1300) }, 1100)
  }, [abN, checkEnd])

  /* ── CANVAS DRAW ── */
  const draw = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const cs = scrR.current, l = liR.current, lv2 = LVS[l]
    if (!lv2) return
    const szWl = SZBW * lv2.szMul, szHl = SZBH * lv2.szMul
    const szLl = SZX - szWl / 2, szRl = SZX + szWl / 2, szTl = SZY - szHl / 2, szBl = SZY + szHl / 2
    ctx.clearRect(0, 0, CW, CH)
    if (l === 0) drawSky0(ctx); else if (l === 1) drawSky1(ctx); else if (l === 2) drawSky2(ctx); else drawSky3(ctx, t)
    drawField(ctx, l)
    const inP = cs === 'AT_BAT' || cs === 'PITCHING' || cs === 'RESULT'
    if (inP) drawBubbleCatcher(ctx)
    if (inP) drawBubblePitcher(ctx, pPhase.current)

    // Strike zone
    if (inP) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(szLl, szTl, szWl, szHl); ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(szLl + (szWl / 3) * i, szTl); ctx.lineTo(szLl + (szWl / 3) * i, szBl); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(szLl, szTl + (szHl / 3) * i); ctx.lineTo(szRl, szTl + (szHl / 3) * i); ctx.stroke()
      }
    }

    // Ball — SLOWER flight
    const p = pitch.current
    if (p.active && (cs === 'PITCHING' || cs === 'RESULT')) {
      const el = t - p.tt, prog = clamp(el / p.arr, 0, 1), e2 = easeIn(prog)
      let bx = lerp(p.sx, p.tx, e2), by = lerp(p.sy, p.ty, e2)
      const bt = clamp((prog - 0.65) / 0.35, 0, 1), be = easeOut(bt)
      bx += p.hB * be; by += p.vB * be; p.cx = bx; p.cy = by; p.prog = prog
      const br = lerp(3, 12, e2)

      // Trail
      if (prog > 0.05) for (let i = 1; i <= 5; i++) {
        const tp = clamp((el - i * 25) / p.arr, 0, 1), te = easeIn(tp)
        let tx2 = lerp(p.sx, p.tx, te), ty2 = lerp(p.sy, p.ty, te)
        const tbt = clamp((tp - 0.65) / 0.35, 0, 1); tx2 += p.hB * easeOut(tbt); ty2 += p.vB * easeOut(tbt)
        ctx.fillStyle = `rgba(255,255,255,${0.1 / i})`; ctx.beginPath(); ctx.arc(tx2, ty2, lerp(3, 12, te) * 0.4, 0, Math.PI * 2); ctx.fill()
      }
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(bx + 1, by + br + 1, br * 0.7, br * 0.2, 0, 0, Math.PI * 2); ctx.fill()
      // Ball
      const bg = ctx.createRadialGradient(bx - br * 0.2, by - br * 0.2, br * 0.1, bx, by, br)
      bg.addColorStop(0, '#fff'); bg.addColorStop(0.6, '#f0f0f0'); bg.addColorStop(1, '#c8c8c8')
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill()
      if (br > 5) { ctx.strokeStyle = '#cc3333'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(bx - 1, by, br * 0.5, -0.5, 0.5); ctx.stroke(); ctx.beginPath(); ctx.arc(bx + 1, by, br * 0.5, 2.6, 3.6); ctx.stroke() }

      if (prog >= 1 && !sw.current.swung) {
        p.active = false; const inZ = p.tx >= szLl && p.tx <= szRl && p.ty >= szTl && p.ty <= szBl
        setScreen('RESULT'); processR(inZ ? { type: 'STRIKE', desc: 'Called strike!' } : { type: 'BALL', desc: 'Ball' })
      }
    }

    // Batter — SLOWER swing (300ms)
    if (inP) { const sw2 = sw.current.swung; drawBubbleBatter(ctx, pl.pri, pl.sec, sw2, sw2 ? clamp((t - sw.current.t) / 300, 0, 1) : 0) }

    // Crosshair
    if ((cs === 'AT_BAT' || cs === 'PITCHING') && !sw.current.swung) {
      const mx = mouse.current.x, my = mouse.current.y, col = pl.pri || '#f59e0b'
      ctx.globalAlpha = 0.75; ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(mx, my, 16, 0, Math.PI * 2); ctx.stroke()
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(mx - 22, my); ctx.lineTo(mx - 8, my); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx + 8, my); ctx.lineTo(mx + 22, my); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx, my - 22); ctx.lineTo(mx, my - 8); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx, my + 8); ctx.lineTo(mx, my + 22); ctx.stroke()
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, 2.5, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    }

    // Contact flash
    if (sw.current.swung && cs === 'RESULT' && lastR) {
      const el = t - sw.current.t
      if (el < 200 && ['HR', 'TRIPLE', 'DOUBLE', 'SINGLE', 'FLY_OUT', 'GROUND_OUT', 'LINE_OUT', 'FOUL'].includes(lastR.type)) {
        ctx.fillStyle = `rgba(255,220,100,${(1 - el / 200) * 0.5})`; ctx.beginPath(); ctx.arc(sw.current.x, sw.current.y, 20 + el * 0.5, 0, Math.PI * 2); ctx.fill()
      }
    }

    // HR animation — SLOWER
    if (cs === 'RESULT' && lastR?.type === 'HR') {
      const el = t - resT.current, ft = clamp(el / 2200, 0, 1), fe = easeOut(ft)
      const hx = lerp(sw.current.x, 400, fe), hy = lerp(sw.current.y, FY - 80, fe), hss = lerp(11, 2, fe)
      if (ft < 1) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, hss, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(245,158,11,${(1 - ft) * 0.8})`
        for (let i = 0; i < 4; i++) { const sa = rand(0, Math.PI * 2), sd = rand(2, 14) * ft; ctx.beginPath(); ctx.arc(hx + Math.cos(sa) * sd, hy + Math.sin(sa) * sd, 1.5, 0, Math.PI * 2); ctx.fill() }
      }
      for (const pa of hrP.current) { pa.x += pa.vx; pa.y += pa.vy; pa.vy += 0.06; pa.life -= 0.006; if (pa.life > 0) { ctx.globalAlpha = pa.life; ctx.fillStyle = pick(['#f59e0b', '#fbbf24', '#fff', '#ef4444']); ctx.beginPath(); ctx.arc(pa.x, pa.y, 2, 0, Math.PI * 2); ctx.fill() } }
      ctx.globalAlpha = 1
      if (el > 300 && el < 900) { const pulse = Math.sin((el - 300) / 80) * 0.1; if (pulse > 0) { ctx.fillStyle = `rgba(245,158,11,${pulse})`; ctx.fillRect(0, 0, CW, CH) } }
    }
  }, [processR, lastR, pl])

  /* ── LOOP ── */
  useEffect(() => {
    const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return
    let run = true
    const loop = (t: number) => { if (!run) return; if (waitR.current && t > pDelay.current && scrR.current === 'AT_BAT') { waitR.current = false; setScreen('PITCHING'); throwP() }; draw(ctx, t); anim.current = requestAnimationFrame(loop) }
    anim.current = requestAnimationFrame(loop)
    return () => { run = false; cancelAnimationFrame(anim.current) }
  }, [draw, throwP])

  /* ── INPUT ── */
  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => { const c = canvasRef.current; if (!c) return; const r = c.getBoundingClientRect(); mouse.current = { x: (e.clientX - r.left) * (CW / r.width), y: (e.clientY - r.top) * (CH / r.height) } }, [])

  const onClick = useCallback(() => {
    if (scrR.current !== 'PITCHING' || sw.current.swung || !pitch.current.active) return
    const now = performance.now(); sw.current = { swung: true, t: now, x: mouse.current.x, y: mouse.current.y }
    const p = pitch.current, el = now - p.tt, prog = clamp(el / p.arr, 0, 1), e2 = easeIn(prog)
    let px = lerp(p.sx, p.tx, e2), py = lerp(p.sy, p.ty, e2)
    const bt = clamp((prog - 0.65) / 0.35, 0, 1); px += p.hB * easeOut(bt); py += p.vB * easeOut(bt)
    p.active = false; const result = calcR(mouse.current.x, mouse.current.y, now, px, py, p.arr, p.tt)
    resT.current = now; setScreen('RESULT'); processR(result)
  }, [calcR, processR])

  /* ── TRANSITIONS ── */
  const confirmPl = useCallback(() => {
    setPl({ name: cN || 'Slugger', team: cT || 'Dingers', pri: cP, sec: cS })
    setLi(0); setAbN(0); setStrikes(0); setBalls2(0); setLvHR(0); setLvHits(0); setLastR(null)
    setCareer({ hr: 0, hits: 0, ab: 0, ks: 0, longHR: 0, maxEV: 0, lvls: 0 })
    setScreen('INTRO')
  }, [cN, cT, cP, cS])

  const startLvl = useCallback(() => { setAbN(0); setStrikes(0); setBalls2(0); setLvHR(0); setLvHits(0); setLastR(null); pPhase.current = 'idle'; setScreen('AT_BAT'); waitR.current = true; pDelay.current = performance.now() + 1400 }, [])
  const nextLvl = useCallback(() => { setLi(i => i + 1); setScreen('INTRO') }, [])

  const fD = { fontFamily: "'Bebas Neue',sans-serif" }, fB = { fontFamily: "'DM Sans',sans-serif" }, fM = { fontFamily: "'JetBrains Mono',monospace" }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <header className="border-b border-[#1e1e2a] bg-[#0a0a0f]/90 backdrop-blur px-4 py-3"><div className="max-w-5xl mx-auto flex items-center justify-between"><Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity"><span className="text-2xl">⚾</span><span style={fD} className="text-xl tracking-wider text-[#f59e0b]">DINGERS ONLY</span></Link><span style={fD} className="text-lg tracking-wider text-white/60">BATTING CAGE</span></div></header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[800px]">
          <canvas ref={canvasRef} width={CW} height={CH} className="w-full rounded-xl border border-[#1e1e2a] shadow-2xl" style={{ aspectRatio: `${CW}/${CH}`, cursor: (screen === 'AT_BAT' || screen === 'PITCHING') ? 'none' : 'default' }} onMouseMove={onMove} onClick={onClick} />

          {/* HUD */}
          {(screen === 'AT_BAT' || screen === 'PITCHING' || screen === 'RESULT') && lv && (
            <div className="absolute top-0 left-0 right-0 pointer-events-none p-3 flex justify-between items-start">
              <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 border border-white/10">
                <div style={fD} className="text-[10px] tracking-[0.2em] text-[#f59e0b]">{lv.name}</div>
                <div className="flex items-baseline gap-2 mt-0.5"><span style={fM} className="text-lg text-white font-bold">{lvHR} HR</span><span style={fM} className="text-[10px] text-white/40">/ {lv.reqHR}</span></div>
                <div style={fB} className="text-[10px] text-white/30 mt-0.5">{pl.name} — {pl.team}</div>
              </div>
              <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 border border-white/10 text-right">
                <div className="flex gap-2 items-center justify-end"><span style={fM} className="text-[10px] text-white/40">COUNT</span><span style={fM} className="text-lg text-white font-bold">{balls2}-{strikes}</span></div>
                <div style={fM} className="text-[10px] text-white/40 mt-0.5">AB {Math.min(abN + 1, lv.abs)}/{lv.abs}</div>
              </div>
            </div>
          )}

          {/* Result */}
          {screen === 'RESULT' && lastR && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="text-center">
              <div style={{ ...fD, color: RS[lastR.type]?.c, textShadow: '0 2px 20px rgba(0,0,0,0.9)' }} className={`text-5xl tracking-wider ${lastR.type === 'HR' ? 'animate-bounce' : ''}`}>{lastR.type === 'HR' ? '💣 ' : ''}{RS[lastR.type]?.t}</div>
              {lastR.ev != null && (<div style={fM} className="text-sm text-white/80 mt-2 drop-shadow-lg">{lastR.ev} mph &middot; {lastR.la}&deg; &middot; {lastR.dist} ft</div>)}
              {showPT && (<div style={fB} className="text-xs text-white/40 mt-1">{PCS[pitch.current.type].name} — {Math.round(pitch.current.spd)} mph</div>)}
            </div></div>
          )}

          {/* MENU */}
          {screen === 'MENU' && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8">
              <div className="text-7xl mb-3">⚾</div>
              <h1 style={fD} className="text-6xl tracking-wider text-[#f59e0b] mb-2">BATTING CAGE</h1>
              <p style={fB} className="text-white/50 mb-8 max-w-md mx-auto">Work your way from Little League to The Show. Hit dingers, climb levels, become a legend.</p>
              <button onClick={() => setScreen('CREATE')} style={fD} className="px-10 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-xl tracking-wide">NEW CAREER</button>
              <div style={fB} className="mt-5 text-xs text-white/25">Move mouse to aim &middot; Click to swing &middot; Timing is everything</div>
              {hs.length > 0 && (<div className="mt-5 border-t border-white/10 pt-4"><div style={fD} className="text-xs text-white/30 tracking-[0.25em] mb-2">HIGH SCORES</div><div className="flex justify-center gap-4">{hs.map((s, i) => <span key={i} style={fM} className="text-sm text-[#f59e0b]">{s} HR</span>)}</div></div>)}
            </div></div>
          )}

          {/* CREATE */}
          {screen === 'CREATE' && (
            <div className="absolute inset-0 bg-[#0a0a0f]/94 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8 w-full max-w-md">
              <h2 style={fD} className="text-3xl tracking-wider text-[#f59e0b] mb-6">CREATE YOUR PLAYER</h2>
              <div className="space-y-4 text-left">
                <div><label style={fD} className="text-xs tracking-[0.2em] text-white/50 block mb-1">PLAYER NAME</label><input type="text" value={cN} onChange={e => setCN(e.target.value)} placeholder="Slugger" maxLength={20} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]/50" style={fB} /></div>
                <div><label style={fD} className="text-xs tracking-[0.2em] text-white/50 block mb-1">TEAM NAME</label><input type="text" value={cT} onChange={e => setCT(e.target.value)} placeholder="Dingers" maxLength={20} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]/50" style={fB} /></div>
                <div><label style={fD} className="text-xs tracking-[0.2em] text-white/50 block mb-2">JERSEY</label><div className="flex gap-2 justify-center flex-wrap">{COLS.map(c => <button key={'p' + c} onClick={() => setCP(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${cP === c ? 'border-white scale-125' : 'border-transparent opacity-70 hover:opacity-100'}`} style={{ backgroundColor: c }} />)}</div></div>
                <div><label style={fD} className="text-xs tracking-[0.2em] text-white/50 block mb-2">ACCENT</label><div className="flex gap-2 justify-center flex-wrap">{COLS.map(c => <button key={'s' + c} onClick={() => setCS(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${cS === c ? 'border-white scale-125' : 'border-transparent opacity-70 hover:opacity-100'}`} style={{ backgroundColor: c }} />)}</div></div>
              </div>
              <div className="mt-5 flex items-center justify-center gap-3"><div className="w-10 h-14 rounded-full border border-white/10 relative overflow-hidden" style={{ backgroundColor: cP }}><div className="absolute bottom-0 left-0 right-0 h-3" style={{ backgroundColor: cS }} /><div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#dab894]" /></div><div className="text-left"><div style={fD} className="text-lg text-white tracking-wide">{cN || 'Slugger'}</div><div style={fB} className="text-xs text-white/40">{cT || 'Dingers'}</div></div></div>
              <button onClick={confirmPl} style={fD} className="mt-6 px-10 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">START CAREER</button>
            </div></div>
          )}

          {/* INTRO */}
          {screen === 'INTRO' && lv && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8">
              <div style={fD} className="text-sm tracking-[0.3em] text-white/25 mb-2">LEVEL {li + 1} OF {LVS.length}</div>
              <h2 style={fD} className="text-5xl tracking-wider text-[#f59e0b] mb-1">{lv.name}</h2>
              <p style={fB} className="text-white/50 mb-7">{lv.sub}</p>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6">{[['GOAL', `${lv.reqHR} HR`], ['AT-BATS', `${lv.abs}`], ['SPEED', `${lv.spdMin}-${lv.spdMax}`]].map(([l2, v]) => (<div key={l2} className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={fD} className="text-[10px] tracking-widest text-white/40">{l2}</div><div style={fM} className="text-xl text-white font-bold">{v}</div></div>))}</div>
              <div className="mb-7"><div style={fD} className="text-[10px] tracking-widest text-white/25 mb-2">PITCHES</div><div className="flex justify-center gap-2">{lv.types.map(pt => (<span key={pt} style={{ ...fM, borderColor: PCS[pt].color }} className="text-xs px-2 py-1 rounded border text-white/70">{PCS[pt].name}</span>))}</div></div>
              <button onClick={startLvl} style={fD} className="px-10 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">STEP UP TO THE PLATE</button>
            </div></div>
          )}

          {/* LEVEL WIN */}
          {screen === 'LEVEL_WIN' && lv && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8">
              <div className="text-5xl mb-3">🎉</div><h2 style={fD} className="text-4xl tracking-wider text-[#4ade80] mb-1">LEVEL CLEARED!</h2><p style={fB} className="text-white/50 mb-6">You crushed {lv.name}</p>
              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6"><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={fD} className="text-[10px] tracking-widest text-white/40">HOME RUNS</div><div style={fM} className="text-2xl text-[#f59e0b] font-bold">{lvHR}</div></div><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={fD} className="text-[10px] tracking-widest text-white/40">HITS</div><div style={fM} className="text-2xl text-white font-bold">{lvHits}</div></div></div>
              <button onClick={nextLvl} style={fD} className="px-10 py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-lg transition-colors text-lg tracking-wide">NEXT LEVEL →</button>
            </div></div>
          )}

          {/* FAIL */}
          {screen === 'LEVEL_FAIL' && lv && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8">
              <div className="text-5xl mb-3">😤</div><h2 style={fD} className="text-4xl tracking-wider text-[#ef4444] mb-1">SENT DOWN</h2><p style={fB} className="text-white/50 mb-6">Needed {lv.reqHR} HR, only hit {lvHR}</p>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6">{[['CAREER HR', career.hr], ['LONGEST', `${career.longHR} ft`], ['MAX EV', `${career.maxEV} mph`]].map(([l2, v]) => (<div key={String(l2)} className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={fD} className="text-[10px] tracking-widest text-white/40">{String(l2)}</div><div style={fM} className="text-lg text-white font-bold">{String(v)}</div></div>))}</div>
              <div className="flex gap-3 justify-center"><button onClick={startLvl} style={fD} className="px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">TRY AGAIN</button><button onClick={() => setScreen('MENU')} style={fD} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-lg tracking-wide">MAIN MENU</button></div>
            </div></div>
          )}

          {/* CAREER WIN */}
          {screen === 'CAREER_WIN' && (
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8">
              <div className="text-6xl mb-3">🏆</div><h2 style={fD} className="text-5xl tracking-wider text-[#f59e0b] mb-1">HALL OF FAME!</h2><p style={fB} className="text-white/50 mb-6">{pl.name} is a dinger machine.</p>
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-6">{[['CAREER HR', career.hr, true], ['LONGEST', `${career.longHR} ft`, false], ['MAX EV', `${career.maxEV} mph`, false], ['HITS', career.hits, false]].map(([l2, v, a]) => (<div key={String(l2)} className={`bg-white/5 rounded-lg p-3 border ${a ? 'border-[#f59e0b]/30' : 'border-white/10'}`}><div style={fD} className={`text-[10px] tracking-widest ${a ? 'text-[#f59e0b]' : 'text-white/40'}`}>{String(l2)}</div><div style={fM} className={`text-2xl font-bold ${a ? 'text-[#f59e0b]' : 'text-white'}`}>{String(v)}</div></div>))}</div>
              <div className="flex gap-3 justify-center"><button onClick={() => setScreen('CREATE')} style={fD} className="px-8 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">NEW CAREER</button><button onClick={() => setScreen('MENU')} style={fD} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-lg tracking-wide">MAIN MENU</button></div>
            </div></div>
          )}
        </div>
      </div>
      <footer className="border-t border-[#1e1e2a] px-4 py-3 text-center"><span style={fB} className="text-xs text-white/30">⚾ Dingers Only Batting Cage — <Link href="/" className="text-[#f59e0b]/60 hover:text-[#f59e0b] transition-colors">Back to League</Link></span></footer>
    </div>
  )
}
