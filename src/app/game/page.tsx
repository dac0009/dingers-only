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
  hMov: number
  vMov: number
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
  primary: string
  secondary: string
}

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const CW = 800
const CH = 560

const PCC: Record<PitchType, PitchConfig> = {
  fastball:  { name: 'Fastball',  speedMult: 1.0,  hMov: 0,   vMov: -2,  color: '#ef4444' },
  changeup:  { name: 'Changeup',  speedMult: 0.82, hMov: 3,   vMov: 8,   color: '#22c55e' },
  slider:    { name: 'Slider',    speedMult: 0.88, hMov: 14,  vMov: 3,   color: '#3b82f6' },
  curveball: { name: 'Curveball', speedMult: 0.78, hMov: -4,  vMov: 18,  color: '#a855f7' },
  cutter:    { name: 'Cutter',    speedMult: 0.94, hMov: -8,  vMov: 2,   color: '#f97316' },
}

const LEVELS: Level[] = [
  { name: 'LITTLE LEAGUE', subtitle: 'Where legends begin', pitchSpeedMin: 45, pitchSpeedMax: 55, pitchTypes: ['fastball'], fenceDistance: 200, requiredHR: 2, totalABs: 10, strikeZoneSize: 1.3 },
  { name: 'HIGH SCHOOL', subtitle: 'Varsity tryouts', pitchSpeedMin: 62, pitchSpeedMax: 74, pitchTypes: ['fastball', 'changeup'], fenceDistance: 310, requiredHR: 3, totalABs: 12, strikeZoneSize: 1.15 },
  { name: 'COLLEGE', subtitle: 'NCAA regionals', pitchSpeedMin: 78, pitchSpeedMax: 88, pitchTypes: ['fastball', 'changeup', 'slider'], fenceDistance: 360, requiredHR: 3, totalABs: 12, strikeZoneSize: 1.0 },
  { name: 'THE SHOW', subtitle: 'Welcome to the bigs', pitchSpeedMin: 90, pitchSpeedMax: 101, pitchTypes: ['fastball', 'changeup', 'slider', 'curveball', 'cutter'], fenceDistance: 400, requiredHR: 4, totalABs: 15, strikeZoneSize: 0.9 },
]

const FENCE_Y = 180
const MOUND_Y = 280
const PLATE_Y = 470
const SZ_CX = 400
const SZ_CY = 385
const SZ_BW = 120
const SZ_BH = 100
const BATTER_X = 370
const VPX = 400

const COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0d9488',
  '#2563eb', '#4f46e5', '#9333ea', '#db2777', '#e2e8f0',
]

const RES_S: Record<string, { text: string; color: string }> = {
  HR: { text: 'HOME RUN!', color: '#f59e0b' },
  TRIPLE: { text: 'TRIPLE!', color: '#a855f7' },
  DOUBLE: { text: 'DOUBLE!', color: '#3b82f6' },
  SINGLE: { text: 'SINGLE!', color: '#22c55e' },
  FLY_OUT: { text: 'Fly Out', color: '#ef4444' },
  GROUND_OUT: { text: 'Ground Out', color: '#ef4444' },
  LINE_OUT: { text: 'Line Out', color: '#ef4444' },
  STRIKE: { text: 'STRIKE!', color: '#ef4444' },
  BALL: { text: 'Ball', color: '#94a3b8' },
  FOUL: { text: 'Foul Ball', color: '#fbbf24' },
}

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const rand = (a: number, b: number) => Math.random() * (b - a) + a
const randI = (a: number, b: number) => Math.floor(rand(a, b + 1))
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const easeIn = (t: number) => t * t * t
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeBoth = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/* ═══════════════════════════════════════════════════
   DRAWING: SKY + SCENERY PER LEVEL
   ═══════════════════════════════════════════════════ */

function drawSky0(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, FENCE_Y + 10)
  g.addColorStop(0, '#3b8de0'); g.addColorStop(0.55, '#6db8f0'); g.addColorStop(1, '#a8daf5')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, FENCE_Y + 10)

  const sg = ctx.createRadialGradient(680, 50, 10, 680, 50, 90)
  sg.addColorStop(0, 'rgba(255,248,200,1)'); sg.addColorStop(0.3, 'rgba(255,240,150,0.6)')
  sg.addColorStop(0.6, 'rgba(255,220,100,0.15)'); sg.addColorStop(1, 'rgba(255,220,100,0)')
  ctx.fillStyle = sg; ctx.fillRect(590, 0, 180, 140)
  ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.arc(680, 50, 28, 0, Math.PI * 2); ctx.fill()

  const cloud = (cx: number, cy: number, s: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    for (const [dx, dy, r] of [[-14,4,11],[0,-3,16],[14,2,13],[7,-9,10],[-8,-7,9]]) {
      ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2); ctx.fill()
    }
  }
  cloud(140, 55, 1.1); cloud(380, 40, 0.7); cloud(530, 70, 0.9)

  // Far treeline
  ctx.fillStyle = '#1a6030'
  for (let x = 20; x < CW; x += 45) {
    ctx.beginPath(); ctx.arc(x + rand(-5,5), FENCE_Y - 16, 20, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(x + rand(-8,8) - 8, FENCE_Y - 8, 14, 0, Math.PI * 2); ctx.fill()
  }
  // Near trees
  const tree = (tx: number, s: number) => {
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(tx - 3*s, FENCE_Y - 10*s, 6*s, 14*s)
    ctx.fillStyle = '#2a8840'; ctx.beginPath(); ctx.arc(tx, FENCE_Y - 18*s, 16*s, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = '#238838'
    ctx.beginPath(); ctx.arc(tx - 8*s, FENCE_Y - 10*s, 12*s, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(tx + 9*s, FENCE_Y - 12*s, 13*s, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = 'rgba(100,220,100,0.25)'; ctx.beginPath(); ctx.arc(tx + 3*s, FENCE_Y - 22*s, 8*s, 0, Math.PI*2); ctx.fill()
  }
  tree(70,1.1); tree(200,1.3); tree(340,0.9); tree(470,1.0); tree(600,1.2); tree(730,1.0)
}

function drawSky1(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, FENCE_Y + 10)
  g.addColorStop(0, '#4a7ab8'); g.addColorStop(0.4, '#78a8d0'); g.addColorStop(0.75, '#d8b868'); g.addColorStop(1, '#c89838')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, FENCE_Y + 10)

  for (let i = 0; i < 3; i++) {
    const bx = 40 + i * 270, bw = 200, bh = 40, by = FENCE_Y - bh - 5
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(bx, by, bw, bh)
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = r%2===0 ? '#a5a5a5' : '#929292'; ctx.fillRect(bx, by + r*10, bw, 9)
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(bx, by + r*10 + 8, bw, 2)
    }
    for (let c = 0; c < 18; c++) {
      const cx = bx + 6 + c*11, row = c%4, cy = by + 3 + row*10
      ctx.fillStyle = pick(['#dab894','#c49570','#8d6040','#f5dbc0'])
      ctx.beginPath(); ctx.arc(cx, cy-2, 3, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = pick(['#dc2626','#2563eb','#f59e0b','#fff','#16a34a','#9333ea','#666'])
      ctx.fillRect(cx-2.5, cy+1, 5, 4)
    }
  }
  // Scoreboard
  const sbx=320, sby=FENCE_Y-55
  ctx.fillStyle='#1a2a18'
  ctx.beginPath(); ctx.roundRect(sbx, sby, 160, 48, 3); ctx.fill()
  ctx.strokeStyle='#3a5a38'; ctx.lineWidth=2; ctx.stroke()
  ctx.fillStyle='#33cc55'; ctx.font='bold 10px monospace'; ctx.textAlign='center'
  ctx.fillText('HOME',sbx+50,sby+18); ctx.fillText('AWAY',sbx+110,sby+18)
  ctx.fillStyle='#ffcc00'; ctx.font='bold 18px monospace'
  ctx.fillText('0',sbx+50,sby+38); ctx.fillText('0',sbx+110,sby+38)
}

function drawSky2(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, FENCE_Y + 10)
  g.addColorStop(0,'#0e0828'); g.addColorStop(0.25,'#2a1458'); g.addColorStop(0.5,'#6a2a78')
  g.addColorStop(0.75,'#c06040'); g.addColorStop(1,'#d89040')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, FENCE_Y + 10)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (const [x,y] of [[80,18],[200,35],[450,12],[620,28],[720,40],[350,48],[550,55]]) {
    ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fill()
  }

  ctx.fillStyle = '#1a1235'
  ctx.beginPath()
  ctx.moveTo(-20, FENCE_Y+5); ctx.quadraticCurveTo(400, FENCE_Y-55, 820, FENCE_Y+5)
  ctx.lineTo(820, FENCE_Y-20); ctx.quadraticCurveTo(400, FENCE_Y-80, -20, FENCE_Y-20)
  ctx.closePath(); ctx.fill()

  for (let c = 0; c < 65; c++) {
    const cx = 10 + c*12.2, curveY = FENCE_Y - 30 - Math.sin((cx/CW)*Math.PI)*35
    ctx.fillStyle = pick(['#dc2626','#2563eb','#f59e0b','#fff','#16a34a','#9333ea','#db2777','#ddd'])
    ctx.beginPath(); ctx.arc(cx, curveY+rand(-2,2), 2.5, 0, Math.PI*2); ctx.fill()
  }

  const light = (lx: number) => {
    ctx.fillStyle='#3a3a4a'; ctx.fillRect(lx-3,15,6,FENCE_Y-30)
    ctx.fillStyle='#4a4a5a'; ctx.fillRect(lx-22,10,44,12)
    for (let b=-2;b<=2;b++) { ctx.fillStyle='#fffde0'; ctx.beginPath(); ctx.arc(lx+b*8,16,3.5,0,Math.PI*2); ctx.fill() }
    const gl = ctx.createRadialGradient(lx,16,5,lx,16,100)
    gl.addColorStop(0,'rgba(255,255,200,0.3)'); gl.addColorStop(1,'rgba(255,255,200,0)')
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx,16,100,0,Math.PI*2); ctx.fill()
  }
  light(90); light(710)
}

function drawSky3(ctx: CanvasRenderingContext2D, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, FENCE_Y + 10)
  g.addColorStop(0,'#020210'); g.addColorStop(0.5,'#08082a'); g.addColorStop(1,'#0a0a30')
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, FENCE_Y + 10)

  const stars=[[40,12],[100,30],[170,8],[230,45],[300,15],[370,38],[440,10],[510,42],[570,20],[640,8],[700,35],[760,15],[130,55],[400,50],[550,58],[680,48]]
  for (const [sx,sy] of stars) {
    ctx.globalAlpha = 0.4 + 0.6*Math.sin(t/600+sx*0.1+sy*0.2)
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(sx,sy,1.2,0,Math.PI*2); ctx.fill()
  }
  ctx.globalAlpha=1

  // Upper deck
  ctx.fillStyle='#0c0c28'; ctx.beginPath()
  ctx.moveTo(-20,FENCE_Y-15); ctx.quadraticCurveTo(400,FENCE_Y-75,820,FENCE_Y-15)
  ctx.lineTo(820,FENCE_Y-50); ctx.quadraticCurveTo(400,FENCE_Y-110,-20,FENCE_Y-50)
  ctx.closePath(); ctx.fill()

  ctx.fillStyle='#101038'; ctx.beginPath()
  ctx.moveTo(-20,FENCE_Y+5); ctx.quadraticCurveTo(400,FENCE_Y-40,820,FENCE_Y+5)
  ctx.lineTo(820,FENCE_Y-15); ctx.quadraticCurveTo(400,FENCE_Y-60,-20,FENCE_Y-15)
  ctx.closePath(); ctx.fill()

  for (let tier=0;tier<2;tier++) {
    const count = tier===0?55:70, baseTop = tier===0?FENCE_Y-65:FENCE_Y-30, curve=tier===0?32:22
    for (let c=0;c<count;c++) {
      const cx=10+c*(780/count), cOff=Math.sin((cx/CW)*Math.PI)*curve
      const bounce=Math.sin(t/250+c*0.8+tier*2)*1.8
      ctx.fillStyle=pick(['#dc2626','#2563eb','#f59e0b','#fff','#16a34a','#9333ea','#db2777','#fbbf24','#ccc'])
      ctx.beginPath(); ctx.arc(cx,baseTop-cOff+bounce,2.5,0,Math.PI*2); ctx.fill()
    }
  }

  const bigLight = (lx: number) => {
    ctx.fillStyle='#282838'; ctx.fillRect(lx-4,0,8,FENCE_Y-60)
    ctx.fillStyle='#383848'; ctx.fillRect(lx-30,0,60,16)
    for (let b=-3;b<=3;b++) { ctx.fillStyle='#fffde0'; ctx.beginPath(); ctx.arc(lx+b*7.5,8,3.5,0,Math.PI*2); ctx.fill() }
    const gl=ctx.createRadialGradient(lx,8,8,lx,8,140)
    gl.addColorStop(0,'rgba(255,255,230,0.35)'); gl.addColorStop(0.4,'rgba(255,255,210,0.08)'); gl.addColorStop(1,'rgba(255,255,200,0)')
    ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(lx,8,140,0,Math.PI*2); ctx.fill()
  }
  bigLight(60); bigLight(240); bigLight(560); bigLight(740)
}

/* ═══════════════════════════════════════════════════
   DRAWING: FIELD
   ═══════════════════════════════════════════════════ */

function drawField(ctx: CanvasRenderingContext2D, li: number) {
  const greens = [['#2d8040','#35903a','#2a7035'],['#25702c','#2e8032','#1d5e24'],['#1c5c24','#246a2c','#16501c'],['#1a5820','#206228','#143e18']][li]
  const gg = ctx.createLinearGradient(0, FENCE_Y, 0, CH)
  gg.addColorStop(0,greens[0]); gg.addColorStop(0.5,greens[1]); gg.addColorStop(1,greens[2])
  ctx.fillStyle = gg; ctx.fillRect(0, FENCE_Y, CW, CH - FENCE_Y)

  if (li >= 2) { for (let i=0;i<16;i++) { if(i%2===0){ctx.fillStyle='rgba(255,255,255,0.018)'; ctx.fillRect(0,FENCE_Y+i*24,CW,24)} } }

  // Outfield wall
  if (li===0) {
    ctx.fillStyle='#6a6a6a'; ctx.fillRect(0,FENCE_Y-2,CW,5)
    for (let p=40;p<CW;p+=65) { ctx.fillStyle='#808080'; ctx.fillRect(p-1.5,FENCE_Y-18,3,20); ctx.fillStyle='#909090'; ctx.beginPath(); ctx.arc(p,FENCE_Y-18,3,0,Math.PI*2); ctx.fill() }
    ctx.strokeStyle='rgba(160,160,160,0.2)'; ctx.lineWidth=0.5
    for (let x=0;x<CW;x+=6) { ctx.beginPath(); ctx.moveTo(x,FENCE_Y-16); ctx.lineTo(x+3,FENCE_Y-1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x+3,FENCE_Y-16); ctx.lineTo(x,FENCE_Y-1); ctx.stroke() }
  } else if (li===1) {
    ctx.fillStyle='#5c3820'; ctx.fillRect(0,FENCE_Y-10,CW,13)
    ctx.fillStyle='#6a4028'; ctx.fillRect(0,FENCE_Y-10,CW,2)
    ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1
    for (let p=0;p<CW;p+=35) { ctx.beginPath(); ctx.moveTo(p,FENCE_Y-10); ctx.lineTo(p,FENCE_Y+3); ctx.stroke() }
  } else if (li===2) {
    ctx.fillStyle='#1a3868'; ctx.fillRect(0,FENCE_Y-14,CW,17)
    ctx.fillStyle='#244a80'; ctx.fillRect(0,FENCE_Y-14,CW,3)
  } else {
    ctx.fillStyle='#081830'; ctx.fillRect(0,FENCE_Y-18,CW,21)
    ctx.fillStyle='#0c2240'; ctx.fillRect(0,FENCE_Y-18,CW,3)
    ctx.fillStyle='#e8b820'; ctx.font='bold 11px Arial'; ctx.textAlign='center'
    ctx.fillText('330',160,FENCE_Y-4); ctx.fillText('370',270,FENCE_Y-4); ctx.fillText('400',400,FENCE_Y-4); ctx.fillText('370',530,FENCE_Y-4); ctx.fillText('330',640,FENCE_Y-4)
  }

  // Foul lines
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(VPX,FENCE_Y+5); ctx.lineTo(120,CH+20); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(VPX,FENCE_Y+5); ctx.lineTo(680,CH+20); ctx.stroke()

  // Infield dirt — smooth bezier
  const dg = ctx.createRadialGradient(400,390,30,400,390,160)
  dg.addColorStop(0,li===0?'#b8986a':'#9a8058'); dg.addColorStop(0.7,li===0?'#a88858':'#8a7048'); dg.addColorStop(1,li===0?'#907848':'#786040')
  ctx.fillStyle = dg
  ctx.beginPath()
  ctx.moveTo(400, 310)
  ctx.bezierCurveTo(490, 340, 520, 400, 490, 460)
  ctx.quadraticCurveTo(400, 500, 310, 460)
  ctx.bezierCurveTo(280, 400, 310, 340, 400, 310)
  ctx.closePath(); ctx.fill()

  if (li >= 1) {
    ctx.fillStyle = li>=3 ? '#1a5822' : '#22682c'
    ctx.beginPath()
    ctx.moveTo(400,340); ctx.bezierCurveTo(450,355,460,390,440,420)
    ctx.quadraticCurveTo(400,438,360,420); ctx.bezierCurveTo(340,390,350,355,400,340)
    ctx.closePath(); ctx.fill()
  }

  // Basepaths
  ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=2
  ctx.beginPath(); ctx.moveTo(400,PLATE_Y-10); ctx.lineTo(460,380); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(400,PLATE_Y-10); ctx.lineTo(340,380); ctx.stroke()

  // Mound
  const mg = ctx.createRadialGradient(400,MOUND_Y+5,5,400,MOUND_Y+5,30)
  mg.addColorStop(0,'#b09068'); mg.addColorStop(1,'#907850')
  ctx.fillStyle=mg; ctx.beginPath(); ctx.ellipse(400,MOUND_Y+5,30,12,0,0,Math.PI*2); ctx.fill()
  ctx.fillStyle='#d8d8d8'; ctx.fillRect(393,MOUND_Y-1,14,3)

  // Home plate area
  const pg = ctx.createRadialGradient(400,PLATE_Y+2,5,400,PLATE_Y+2,55)
  pg.addColorStop(0,'#b09068'); pg.addColorStop(1,'#907850')
  ctx.fillStyle=pg; ctx.beginPath(); ctx.ellipse(400,PLATE_Y+2,55,18,0,0,Math.PI*2); ctx.fill()

  ctx.fillStyle='#e0e0e0'; ctx.beginPath()
  ctx.moveTo(400,PLATE_Y+8); ctx.lineTo(393,PLATE_Y+2); ctx.lineTo(393,PLATE_Y-4)
  ctx.lineTo(407,PLATE_Y-4); ctx.lineTo(407,PLATE_Y+2); ctx.closePath(); ctx.fill()

  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1.5
  ctx.strokeRect(355,PLATE_Y-20,25,42); ctx.strokeRect(420,PLATE_Y-20,25,42)
}

/* ═══════════════════════════════════════════════════
   DRAWING: CHARACTERS
   ═══════════════════════════════════════════════════ */

function drawPitcherChar(ctx: CanvasRenderingContext2D, phase: string) {
  const px=400, py=MOUND_Y-10, s=1.8
  ctx.save(); ctx.translate(px,py)

  ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0,22*s,14*s,4*s,0,0,Math.PI*2); ctx.fill()

  // Legs
  ctx.fillStyle='#e8e8e8'
  ctx.beginPath(); ctx.moveTo(-5*s,8*s); ctx.quadraticCurveTo(-7*s,14*s,-8*s,20*s); ctx.lineTo(-4*s,20*s); ctx.quadraticCurveTo(-3*s,14*s,-1*s,8*s); ctx.closePath(); ctx.fill()
  if (phase==='windup') {
    ctx.beginPath(); ctx.moveTo(3*s,8*s); ctx.quadraticCurveTo(5*s,6*s,4*s,0); ctx.lineTo(8*s,0); ctx.quadraticCurveTo(9*s,6*s,7*s,8*s); ctx.closePath(); ctx.fill()
  } else {
    ctx.beginPath(); ctx.moveTo(3*s,8*s); ctx.quadraticCurveTo(5*s,14*s,6*s,20*s); ctx.lineTo(10*s,20*s); ctx.quadraticCurveTo(9*s,14*s,7*s,8*s); ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle='#222'
  ctx.beginPath(); ctx.ellipse(-6*s,21*s,5*s,2*s,0,0,Math.PI*2); ctx.fill()
  if (phase!=='windup') { ctx.beginPath(); ctx.ellipse(8*s,21*s,5*s,2*s,0,0,Math.PI*2); ctx.fill() }

  // Torso
  ctx.fillStyle='#c8c8c8'
  ctx.beginPath(); ctx.moveTo(-10*s,-6*s); ctx.quadraticCurveTo(-11*s,4*s,-8*s,10*s)
  ctx.lineTo(8*s,10*s); ctx.quadraticCurveTo(11*s,4*s,10*s,-6*s); ctx.closePath(); ctx.fill()
  ctx.strokeStyle='#999'; ctx.lineWidth=1
  ctx.beginPath(); ctx.moveTo(-3*s,-6*s); ctx.lineTo(0,-2*s); ctx.lineTo(3*s,-6*s); ctx.stroke()

  // Arms
  ctx.fillStyle='#dab894'
  if (phase==='windup') {
    ctx.beginPath(); ctx.ellipse(-14*s,2*s,4*s,3*s,-0.3,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#5a3010'; ctx.beginPath(); ctx.ellipse(-18*s,4*s,5*s,4*s,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#dab894'; ctx.beginPath(); ctx.ellipse(14*s,-10*s,3.5*s,3*s,0.5,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(16*s,-14*s,3*s,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle='#cc3333'; ctx.lineWidth=0.5*s; ctx.beginPath(); ctx.arc(15*s,-14*s,2*s,-0.5,0.5); ctx.stroke()
  } else if (phase==='thrown') {
    ctx.beginPath(); ctx.ellipse(-12*s,6*s,4*s,3*s,0.3,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#5a3010'; ctx.beginPath(); ctx.ellipse(-15*s,8*s,5*s,4*s,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#dab894'; ctx.beginPath(); ctx.ellipse(12*s,8*s,4*s,3*s,-0.3,0,Math.PI*2); ctx.fill()
  } else {
    ctx.beginPath(); ctx.ellipse(-12*s,5*s,3.5*s,3*s,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#5a3010'; ctx.beginPath(); ctx.ellipse(-15*s,7*s,5*s,4*s,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#dab894'; ctx.beginPath(); ctx.ellipse(12*s,5*s,3.5*s,3*s,0,0,Math.PI*2); ctx.fill()
  }

  // Head + cap
  ctx.fillStyle='#dab894'; ctx.beginPath(); ctx.arc(0,-13*s,8*s,0,Math.PI*2); ctx.fill()
  ctx.fillStyle='#2a2a3a'
  ctx.beginPath(); ctx.arc(0,-16*s,9*s,Math.PI,Math.PI*2); ctx.closePath(); ctx.fill()
  ctx.fillRect(-9*s,-17*s,18*s,3*s)
  ctx.fillStyle='#1a1a28'; ctx.beginPath(); ctx.ellipse(0,-14.5*s,10*s,3*s,0,0,Math.PI); ctx.fill()
  ctx.fillStyle='#222'
  ctx.beginPath(); ctx.arc(-3*s,-12*s,1.5*s,0,Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.arc(3*s,-12*s,1.5*s,0,Math.PI*2); ctx.fill()
  ctx.restore()
}

function drawBatterChar(ctx: CanvasRenderingContext2D, pri: string, sec: string, sw: boolean, sp: number) {
  const bx=BATTER_X, by=480, s=2.4
  ctx.save(); ctx.translate(bx,by)

  ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(5*s,18*s,16*s,4*s,0,0,Math.PI*2); ctx.fill()

  // Legs
  ctx.fillStyle='#e8e8e8'
  ctx.beginPath(); ctx.moveTo(-4*s,8*s); ctx.quadraticCurveTo(-6*s,13*s,-6*s,18*s); ctx.lineTo(-2*s,18*s); ctx.quadraticCurveTo(-2*s,13*s,0,8*s); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(4*s,8*s); ctx.quadraticCurveTo(6*s,13*s,7*s,18*s); ctx.lineTo(11*s,18*s); ctx.quadraticCurveTo(10*s,13*s,8*s,8*s); ctx.closePath(); ctx.fill()
  ctx.fillStyle='#222'
  ctx.beginPath(); ctx.ellipse(-4*s,18.5*s,5*s,2.2*s,0,0,Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(9*s,18.5*s,5*s,2.2*s,0,0,Math.PI*2); ctx.fill()

  // Torso
  ctx.fillStyle=pri
  ctx.beginPath(); ctx.moveTo(-10*s,-6*s); ctx.quadraticCurveTo(-12*s,2*s,-9*s,10*s)
  ctx.lineTo(9*s,10*s); ctx.quadraticCurveTo(12*s,2*s,10*s,-6*s); ctx.closePath(); ctx.fill()
  ctx.fillStyle=sec; ctx.fillRect(-8*s,-1*s,16*s,2.5*s)
  ctx.strokeStyle=sec; ctx.lineWidth=1.5; ctx.font=`bold ${7*s}px Arial`; ctx.textAlign='center'; ctx.strokeText('7',0,7*s)
  ctx.fillStyle=pri; ctx.beginPath(); ctx.ellipse(0,-5*s,13*s,5*s,0,0,Math.PI*2); ctx.fill()

  // Helmet
  ctx.fillStyle=pri; ctx.beginPath(); ctx.arc(0,-14*s,9*s,0,Math.PI*2); ctx.fill()
  ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(-2*s,-18*s,4*s,0,Math.PI*2); ctx.fill()
  ctx.fillStyle=pri; ctx.beginPath(); ctx.ellipse(8*s,-10*s,3*s,5*s,0.2,0,Math.PI*2); ctx.fill()
  ctx.fillStyle='#dab894'; ctx.fillRect(-3*s,-7*s,6*s,4*s)

  // Bat arm
  ctx.save()
  const ax=9*s, ay=-3*s
  if (sw) {
    const angle = lerp(-1.6, 1.8, easeBoth(clamp(sp,0,1)))
    ctx.translate(ax,ay); ctx.rotate(angle)
    ctx.fillStyle='#dab894'; ctx.beginPath(); ctx.ellipse(6*s,0,5*s,3*s,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle=sec; ctx.beginPath(); ctx.ellipse(10*s,0,3.5*s,3*s,0,0,Math.PI*2); ctx.fill()
    // Bat
    ctx.fillStyle='#A07020'
    ctx.beginPath(); ctx.moveTo(10*s,-2*s); ctx.lineTo(32*s,-3.5*s)
    ctx.quadraticCurveTo(36*s,-3*s,36*s,-1*s); ctx.quadraticCurveTo(36*s,1*s,32*s,1*s)
    ctx.lineTo(10*s,2*s); ctx.closePath(); ctx.fill()
    ctx.fillStyle='#B88028'
    ctx.beginPath(); ctx.moveTo(28*s,-4*s); ctx.quadraticCurveTo(38*s,-4.5*s,38*s,-0.5*s)
    ctx.quadraticCurveTo(38*s,3*s,28*s,2.5*s); ctx.closePath(); ctx.fill()
    ctx.fillStyle='#806018'; ctx.beginPath(); ctx.arc(10*s,0,2.5*s,0,Math.PI*2); ctx.fill()
  } else {
    ctx.translate(ax,ay); ctx.rotate(-1.4)
    ctx.fillStyle='#dab894'; ctx.beginPath(); ctx.ellipse(5*s,0,4.5*s,3*s,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle=sec; ctx.beginPath(); ctx.ellipse(8*s,-1*s,3*s,2.5*s,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#A07020'
    ctx.beginPath(); ctx.moveTo(7*s,-1*s); ctx.lineTo(10*s,-26*s); ctx.lineTo(13*s,-26*s); ctx.lineTo(10*s,1*s); ctx.closePath(); ctx.fill()
    ctx.fillStyle='#B88028'
    ctx.beginPath(); ctx.moveTo(9*s,-24*s); ctx.quadraticCurveTo(8*s,-32*s,11.5*s,-32*s)
    ctx.quadraticCurveTo(15*s,-32*s,14*s,-24*s); ctx.closePath(); ctx.fill()
    ctx.fillStyle='#806018'; ctx.beginPath(); ctx.arc(8.5*s,0,2*s,0,Math.PI*2); ctx.fill()
  }
  ctx.restore()

  ctx.fillStyle='#dab894'; ctx.beginPath(); ctx.ellipse(-9*s,2*s,4*s,3*s,-0.2,0,Math.PI*2); ctx.fill()
  ctx.restore()
}

function drawCatcher(ctx: CanvasRenderingContext2D) {
  ctx.save(); ctx.translate(408, PLATE_Y+8)
  const s=1.4
  ctx.fillStyle='#444'; ctx.beginPath(); ctx.ellipse(0,2*s,10*s,7*s,0,0,Math.PI*2); ctx.fill()
  ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(0,-6*s,6*s,0,Math.PI*2); ctx.fill()
  ctx.strokeStyle='#666'; ctx.lineWidth=1
  ctx.beginPath(); ctx.moveTo(-3*s,-8*s); ctx.lineTo(-3*s,-2*s); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(3*s,-8*s); ctx.lineTo(3*s,-2*s); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-5*s,-5*s); ctx.lineTo(5*s,-5*s); ctx.stroke()
  ctx.fillStyle='#8B5020'; ctx.beginPath(); ctx.ellipse(10*s,-3*s,6*s,5*s,0.2,0,Math.PI*2); ctx.fill()
  ctx.fillStyle='#A06030'; ctx.beginPath(); ctx.ellipse(10*s,-3*s,4*s,3.5*s,0.2,0,Math.PI*2); ctx.fill()
  ctx.restore()
}

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [screen, setScreen] = useState<GameScreen>('MENU')
  const [levelIdx, setLevelIdx] = useState(0)
  const [abNumber, setAbNumber] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [balls, setBalls] = useState(0)
  const [levelHRs, setLevelHRs] = useState(0)
  const [levelHits, setLevelHits] = useState(0)
  const [lastResult, setLastResult] = useState<AtBatResult | null>(null)
  const [showPT, setShowPT] = useState(false)
  const [career, setCareer] = useState<CareerStats>({ totalHR:0,totalHits:0,totalABs:0,totalStrikes:0,longestHR:0,maxExitVelo:0,levelsCompleted:0 })
  const [hs, setHs] = useState<number[]>([])
  const [player, setPlayer] = useState<PlayerProfile>({ name:'',teamName:'',primary:'#dc2626',secondary:'#e2e8f0' })
  const [cN, setCN] = useState(''); const [cT, setCT] = useState('')
  const [cP, setCP] = useState('#dc2626'); const [cS, setCS] = useState('#e2e8f0')

  const mouseRef = useRef({ x: SZ_CX, y: SZ_CY })
  const pitchRef = useRef({ active:false,type:'fastball' as PitchType,startX:400,startY:MOUND_Y-20,targetX:400,targetY:SZ_CY,curX:400,curY:MOUND_Y,progress:0,speed:85,thrown:false,arrTime:600,throwT:0,hBreak:0,vBreak:0 })
  const swRef = useRef({ swung:false,time:0,x:400,y:SZ_CY })
  const animRef = useRef(0)
  const scrRef = useRef(screen); const lvRef = useRef(levelIdx)
  const kRef = useRef(strikes); const bbRef = useRef(balls)
  const resTimerRef = useRef(0); const pitchDelayRef = useRef(0)
  const waitRef = useRef(false); const pitPhase = useRef<'idle'|'windup'|'thrown'>('idle')
  const hrParts = useRef<Array<{x:number;y:number;vx:number;vy:number;life:number}>>([])

  useEffect(() => { scrRef.current=screen }, [screen])
  useEffect(() => { lvRef.current=levelIdx }, [levelIdx])
  useEffect(() => { kRef.current=strikes }, [strikes])
  useEffect(() => { bbRef.current=balls }, [balls])
  useEffect(() => { try{const s=localStorage.getItem('dg-hs2');if(s)setHs(JSON.parse(s))}catch{} }, [])

  const saveHS = useCallback((hrs: number) => {
    setHs(p => { const n=[...p,hrs].sort((a,b)=>b-a).slice(0,5); try{localStorage.setItem('dg-hs2',JSON.stringify(n))}catch{}; return n })
  }, [])

  const level = LEVELS[levelIdx]
  const szW = SZ_BW*(level?.strikeZoneSize??1), szH = SZ_BH*(level?.strikeZoneSize??1)
  const szL=SZ_CX-szW/2, szR=SZ_CX+szW/2, szT=SZ_CY-szH/2, szB=SZ_CY+szH/2

  const throwPitch = useCallback(() => {
    if (!level) return
    const type=pick(level.pitchTypes), cfg=PCC[type]
    const speed=rand(level.pitchSpeedMin,level.pitchSpeedMax)*cfg.speedMult
    const inZ=Math.random()<0.65
    let tx:number, ty:number
    if(inZ){tx=rand(szL+8,szR-8);ty=rand(szT+8,szB-8)}
    else{const side=randI(0,3);if(side===0){tx=rand(szL-30,szL-5);ty=rand(szT,szB)}else if(side===1){tx=rand(szR+5,szR+30);ty=rand(szT,szB)}else if(side===2){tx=rand(szL,szR);ty=rand(szT-30,szT-5)}else{tx=rand(szL,szR);ty=rand(szB+5,szB+30)}}
    const flight=lerp(780,400,(speed-40)/65), brk=level.strikeZoneSize>1?0.5:1.0
    pitPhase.current='windup'
    setTimeout(()=>{
      pitPhase.current='thrown'
      pitchRef.current={active:true,type,startX:400+rand(-6,6),startY:MOUND_Y-20,targetX:tx,targetY:ty,curX:400,curY:MOUND_Y,progress:0,speed,thrown:true,throwT:performance.now(),arrTime:flight,hBreak:cfg.hMov*brk,vBreak:cfg.vMov*brk}
      swRef.current={swung:false,time:0,x:400,y:SZ_CY}
      setShowPT(false)
    }, 350)
  }, [level,szL,szR,szT,szB])

  const calcRes = useCallback((sx:number,sy:number,st:number,px:number,py:number,at:number,tt:number): AtBatResult => {
    if(!level)return{type:'STRIKE',description:''}
    const tDiff=Math.abs(st-(tt+at)), pDist=Math.sqrt((sx-px)**2+(sy-py)**2)
    let tS:number; if(tDiff<30)tS=1;else if(tDiff<60)tS=0.9;else if(tDiff<100)tS=0.75;else if(tDiff<160)tS=0.5;else if(tDiff<250)tS=0.25;else tS=0.05
    const pS=Math.max(0,1-pDist/85), contact=tS*0.55+pS*0.45
    if(contact<0.12||pDist>75){const inZ=px>=szL&&px<=szR&&py>=szT&&py<=szB;return(inZ||swRef.current.swung)?{type:'STRIKE',description:'Whiff!'}:{type:'BALL',description:'Ball'}}
    if(contact<0.25&&Math.random()<0.6)return{type:'FOUL',description:'Foul ball'}
    const ev=lerp(55,112,Math.pow(contact,0.8))+rand(-5,5),vD=(sy-py)/szH
    const la=lerp(-15,50,clamp(0.5-vD*1.5,0,1))+rand(-(1-contact)*25,(1-contact)*25)
    const rad=(la*Math.PI)/180,v0=ev*1.467,hang=(2*v0*Math.sin(rad))/32.2
    let dist=Math.max(0,v0*Math.cos(rad)*Math.max(0,hang)*0.7)*lerp(0.4,1.1,contact)
    const e=Math.round(ev),l=Math.round(la),d=Math.round(dist)
    if(la<5){dist=Math.min(dist,rand(80,200));return contact>0.5&&Math.random()<0.3?{type:'SINGLE',exitVelo:e,launchAngle:l,distance:Math.round(dist),description:`Ground single! ${e} mph`}:{type:'GROUND_OUT',exitVelo:e,launchAngle:l,distance:Math.round(dist),description:'Grounded out'}}
    if(la>55)return{type:'FLY_OUT',exitVelo:e,launchAngle:l,distance:Math.round(Math.min(dist,180)),description:'Popped up'}
    if(dist>=level.fenceDistance)return{type:'HR',exitVelo:e,launchAngle:l,distance:d,description:`GONE! ${d} ft`}
    if(dist>level.fenceDistance*0.85&&la>15)return Math.random()<0.4?{type:'FLY_OUT',exitVelo:e,launchAngle:l,distance:d,description:'Warning track!'}:{type:'TRIPLE',exitVelo:e,launchAngle:l,distance:d,description:`Triple! ${d} ft`}
    if(dist>level.fenceDistance*0.55)return la>25&&Math.random()<0.35?{type:'FLY_OUT',exitVelo:e,launchAngle:l,distance:d,description:'Caught'}:{type:'DOUBLE',exitVelo:e,launchAngle:l,distance:d,description:`Double! ${d} ft`}
    if(contact>0.4)return la>20&&Math.random()<0.4?{type:'FLY_OUT',exitVelo:e,launchAngle:l,distance:d,description:'Fly out'}:{type:'SINGLE',exitVelo:e,launchAngle:l,distance:d,description:`Base hit! ${e} mph`}
    return Math.random()<0.5?{type:'LINE_OUT',exitVelo:e,launchAngle:l,distance:d,description:'Lined out'}:{type:'FLY_OUT',exitVelo:e,launchAngle:l,distance:d,description:'Fly out'}
  }, [level,szL,szR,szT,szB,szH])

  const checkEnd = useCallback((nAB:number,curHR:number)=>{
    if(!level)return
    if(nAB>=level.totalABs){
      if(curHR>=level.requiredHR){setTimeout(()=>{setCareer(s=>({...s,levelsCompleted:s.levelsCompleted+1}));if(levelIdx>=LEVELS.length-1){saveHS(curHR);setScreen('CAREER_COMPLETE')}else setScreen('LEVEL_COMPLETE')},300)}
      else{setTimeout(()=>{saveHS(curHR);setScreen('LEVEL_FAILED')},300)}
    }else{setTimeout(()=>{pitPhase.current='idle';setScreen('AT_BAT');waitRef.current=true;pitchDelayRef.current=performance.now()+rand(800,1500)},300)}
  }, [level,levelIdx,saveHS])

  const processRes = useCallback((r:AtBatResult)=>{
    setLastResult(r); setShowPT(true); resTimerRef.current=performance.now()
    const isHit=['HR','TRIPLE','DOUBLE','SINGLE'].includes(r.type)
    const isEnd=isHit||['FLY_OUT','GROUND_OUT','LINE_OUT'].includes(r.type)
    const isK=r.type==='STRIKE'||r.type==='FOUL'
    if(r.type==='HR'){
      setLevelHRs(h=>h+1);setLevelHits(h=>h+1)
      setCareer(s=>({...s,totalHR:s.totalHR+1,totalHits:s.totalHits+1,longestHR:Math.max(s.longestHR,r.distance??0),maxExitVelo:Math.max(s.maxExitVelo,r.exitVelo??0)}))
      hrParts.current=Array.from({length:20},()=>({x:swRef.current.x,y:swRef.current.y,vx:rand(-4,4),vy:rand(-6,-1),life:rand(0.6,1)}))
    }else if(isHit){setLevelHits(h=>h+1);setCareer(s=>({...s,totalHits:s.totalHits+1,maxExitVelo:Math.max(s.maxExitVelo,r.exitVelo??0)}))}
    if(isK){const nk=kRef.current+1;setStrikes(nk);if(nk>=3){setTimeout(()=>{setStrikes(0);setBalls(0);const n=abNumber+1;setAbNumber(n);setCareer(s=>({...s,totalABs:s.totalABs+1,totalStrikes:s.totalStrikes+1}));setLevelHRs(c=>{checkEnd(n,c);return c})},1100);return}}
    else if(r.type==='BALL'){const nb=bbRef.current+1;setBalls(nb);if(nb>=4){setTimeout(()=>{setStrikes(0);setBalls(0);pitPhase.current='idle';setScreen('AT_BAT');waitRef.current=true;pitchDelayRef.current=performance.now()+rand(800,1500)},900);return}}
    if(isEnd){setTimeout(()=>{setStrikes(0);setBalls(0);const n=abNumber+1;setAbNumber(n);setCareer(s=>({...s,totalABs:s.totalABs+1}));setLevelHRs(c=>{checkEnd(n,c);return c})},r.type==='HR'?2000:1300);return}
    setTimeout(()=>{pitPhase.current='idle';setScreen('AT_BAT');waitRef.current=true;pitchDelayRef.current=performance.now()+rand(600,1100)},800)
  }, [abNumber,checkEnd])

  const draw = useCallback((ctx:CanvasRenderingContext2D,t:number)=>{
    const cs=scrRef.current,li=lvRef.current,lv=LEVELS[li]
    if(!lv)return
    const szWl=SZ_BW*lv.strikeZoneSize,szHl=SZ_BH*lv.strikeZoneSize
    const szLl=SZ_CX-szWl/2,szRl=SZ_CX+szWl/2,szTl=SZ_CY-szHl/2,szBl=SZ_CY+szHl/2
    ctx.clearRect(0,0,CW,CH)
    if(li===0)drawSky0(ctx);else if(li===1)drawSky1(ctx);else if(li===2)drawSky2(ctx);else drawSky3(ctx,t)
    drawField(ctx,li)
    const inPlay=cs==='AT_BAT'||cs==='PITCHING'||cs==='SWING_RESULT'
    if(inPlay)drawCatcher(ctx)
    if(inPlay)drawPitcherChar(ctx,pitPhase.current)
    if(inPlay){
      ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.strokeRect(szLl,szTl,szWl,szHl);ctx.setLineDash([])
      ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=1
      for(let i=1;i<3;i++){const gx=szLl+(szWl/3)*i;ctx.beginPath();ctx.moveTo(gx,szTl);ctx.lineTo(gx,szBl);ctx.stroke();const gy=szTl+(szHl/3)*i;ctx.beginPath();ctx.moveTo(szLl,gy);ctx.lineTo(szRl,gy);ctx.stroke()}
    }
    // Ball
    const p=pitchRef.current
    if(p.active&&(cs==='PITCHING'||cs==='SWING_RESULT')){
      const el=t-p.throwT,prog=clamp(el/p.arrTime,0,1),e=easeIn(prog)
      let bx=lerp(p.startX,p.targetX,e),by=lerp(p.startY,p.targetY,e)
      const bt=clamp((prog-0.65)/0.35,0,1),be=easeOut(bt)
      bx+=p.hBreak*be;by+=p.vBreak*be;p.curX=bx;p.curY=by;p.progress=prog
      const br=lerp(3,12,e)
      if(prog>0.05){for(let i=1;i<=5;i++){const tp=clamp((el-i*18)/p.arrTime,0,1),te=easeIn(tp);let tx=lerp(p.startX,p.targetX,te),ty=lerp(p.startY,p.targetY,te);const tbt=clamp((tp-0.65)/0.35,0,1);tx+=p.hBreak*easeOut(tbt);ty+=p.vBreak*easeOut(tbt);ctx.fillStyle=`rgba(255,255,255,${0.1/i})`;ctx.beginPath();ctx.arc(tx,ty,lerp(3,12,te)*0.4,0,Math.PI*2);ctx.fill()}}
      ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(bx+1,by+br+1,br*0.7,br*0.2,0,0,Math.PI*2);ctx.fill()
      const bg=ctx.createRadialGradient(bx-br*0.2,by-br*0.2,br*0.1,bx,by,br);bg.addColorStop(0,'#fff');bg.addColorStop(0.6,'#f0f0f0');bg.addColorStop(1,'#c8c8c8')
      ctx.fillStyle=bg;ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fill()
      if(br>5){ctx.strokeStyle='#cc3333';ctx.lineWidth=0.7;ctx.beginPath();ctx.arc(bx-1,by,br*0.5,-0.5,0.5);ctx.stroke();ctx.beginPath();ctx.arc(bx+1,by,br*0.5,2.6,3.6);ctx.stroke()}
      if(prog>=1&&!swRef.current.swung){p.active=false;const inZ=p.targetX>=szLl&&p.targetX<=szRl&&p.targetY>=szTl&&p.targetY<=szBl;setScreen('SWING_RESULT');processRes(inZ?{type:'STRIKE',description:'Called strike!'}:{type:'BALL',description:'Ball'})}
    }
    if(inPlay){const sw2=swRef.current.swung;drawBatterChar(ctx,player.primary,player.secondary,sw2,sw2?clamp((t-swRef.current.time)/200,0,1):0)}
    // Crosshair
    if((cs==='AT_BAT'||cs==='PITCHING')&&!swRef.current.swung){
      const mx=mouseRef.current.x,my=mouseRef.current.y,col=player.primary||'#f59e0b'
      ctx.globalAlpha=0.75;ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(mx,my,16,0,Math.PI*2);ctx.stroke()
      ctx.lineWidth=1.5;const gap=8,len=14
      ctx.beginPath();ctx.moveTo(mx-len-gap,my);ctx.lineTo(mx-gap,my);ctx.stroke()
      ctx.beginPath();ctx.moveTo(mx+gap,my);ctx.lineTo(mx+gap+len,my);ctx.stroke()
      ctx.beginPath();ctx.moveTo(mx,my-len-gap);ctx.lineTo(mx,my-gap);ctx.stroke()
      ctx.beginPath();ctx.moveTo(mx,my+gap);ctx.lineTo(mx,my+gap+len);ctx.stroke()
      ctx.fillStyle=col;ctx.beginPath();ctx.arc(mx,my,2.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1
    }
    // Contact flash
    if(swRef.current.swung&&cs==='SWING_RESULT'&&lastResult){const el=t-swRef.current.time;if(el<150&&['HR','TRIPLE','DOUBLE','SINGLE','FLY_OUT','GROUND_OUT','LINE_OUT','FOUL'].includes(lastResult.type)){ctx.fillStyle=`rgba(255,220,100,${(1-el/150)*0.5})`;ctx.beginPath();ctx.arc(swRef.current.x,swRef.current.y,20+el*0.5,0,Math.PI*2);ctx.fill()}}
    // HR anim
    if(cs==='SWING_RESULT'&&lastResult?.type==='HR'){
      const el=t-resTimerRef.current,ft=clamp(el/1600,0,1),fe=easeOut(ft)
      const hx=lerp(swRef.current.x,400,fe),hy=lerp(swRef.current.y,FENCE_Y-80,fe),hss=lerp(11,2,fe)
      if(ft<1){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx,hy,hss,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(245,158,11,${(1-ft)*0.8})`;for(let i=0;i<4;i++){const sa=rand(0,Math.PI*2),sd=rand(2,14)*ft;ctx.beginPath();ctx.arc(hx+Math.cos(sa)*sd,hy+Math.sin(sa)*sd,1.5,0,Math.PI*2);ctx.fill()}}
      for(const pa of hrParts.current){pa.x+=pa.vx;pa.y+=pa.vy;pa.vy+=0.08;pa.life-=0.008;if(pa.life>0){ctx.globalAlpha=pa.life;ctx.fillStyle=pick(['#f59e0b','#fbbf24','#fff','#ef4444']);ctx.beginPath();ctx.arc(pa.x,pa.y,2,0,Math.PI*2);ctx.fill()}}
      ctx.globalAlpha=1
      if(el>200&&el<700){const pulse=Math.sin((el-200)/70)*0.12;if(pulse>0){ctx.fillStyle=`rgba(245,158,11,${pulse})`;ctx.fillRect(0,0,CW,CH)}}
    }
  }, [processRes,lastResult,player])

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return
    let run=true
    const loop=(t:number)=>{if(!run)return;if(waitRef.current&&t>pitchDelayRef.current&&scrRef.current==='AT_BAT'){waitRef.current=false;setScreen('PITCHING');throwPitch()};draw(ctx,t);animRef.current=requestAnimationFrame(loop)}
    animRef.current=requestAnimationFrame(loop)
    return()=>{run=false;cancelAnimationFrame(animRef.current)}
  }, [draw,throwPitch])

  const onMove=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();mouseRef.current={x:(e.clientX-r.left)*(CW/r.width),y:(e.clientY-r.top)*(CH/r.height)}},[])

  const onClick=useCallback(()=>{
    if(scrRef.current!=='PITCHING'||swRef.current.swung||!pitchRef.current.active)return
    const now=performance.now();swRef.current={swung:true,time:now,x:mouseRef.current.x,y:mouseRef.current.y}
    const p=pitchRef.current,el=now-p.throwT,prog=clamp(el/p.arrTime,0,1),e=easeIn(prog)
    let px=lerp(p.startX,p.targetX,e),py=lerp(p.startY,p.targetY,e)
    const bt=clamp((prog-0.65)/0.35,0,1);px+=p.hBreak*easeOut(bt);py+=p.vBreak*easeOut(bt)
    p.active=false;const result=calcRes(mouseRef.current.x,mouseRef.current.y,now,px,py,p.arrTime,p.throwT)
    resTimerRef.current=now;setScreen('SWING_RESULT');processRes(result)
  }, [calcRes,processRes])

  const confirmPlayer=useCallback(()=>{
    setPlayer({name:cN||'Slugger',teamName:cT||'Dingers',primary:cP,secondary:cS})
    setLevelIdx(0);setAbNumber(0);setStrikes(0);setBalls(0);setLevelHRs(0);setLevelHits(0);setLastResult(null)
    setCareer({totalHR:0,totalHits:0,totalABs:0,totalStrikes:0,longestHR:0,maxExitVelo:0,levelsCompleted:0})
    setScreen('LEVEL_INTRO')
  },[cN,cT,cP,cS])

  const startLvl=useCallback(()=>{setAbNumber(0);setStrikes(0);setBalls(0);setLevelHRs(0);setLevelHits(0);setLastResult(null);pitPhase.current='idle';setScreen('AT_BAT');waitRef.current=true;pitchDelayRef.current=performance.now()+1200},[])
  const nextLvl=useCallback(()=>{setLevelIdx(i=>i+1);setScreen('LEVEL_INTRO')},[])

  const fD={fontFamily:"'Bebas Neue',sans-serif"},fB={fontFamily:"'DM Sans',sans-serif"},fM={fontFamily:"'JetBrains Mono',monospace"}

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <header className="border-b border-[#1e1e2a] bg-[#0a0a0f]/90 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">⚾</span>
            <span style={fD} className="text-xl tracking-wider text-[#f59e0b]">DINGERS ONLY</span>
          </Link>
          <span style={fD} className="text-lg tracking-wider text-white/60">BATTING CAGE</span>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[800px]">
          <canvas ref={canvasRef} width={CW} height={CH} className="w-full rounded-xl border border-[#1e1e2a] shadow-2xl" style={{aspectRatio:`${CW}/${CH}`,cursor:(screen==='AT_BAT'||screen==='PITCHING')?'none':'default'}} onMouseMove={onMove} onClick={onClick}/>
          {(screen==='AT_BAT'||screen==='PITCHING'||screen==='SWING_RESULT')&&level&&(
            <div className="absolute top-0 left-0 right-0 pointer-events-none p-3 flex justify-between items-start">
              <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 border border-white/10">
                <div style={fD} className="text-[10px] tracking-[0.2em] text-[#f59e0b]">{level.name}</div>
                <div className="flex items-baseline gap-2 mt-0.5"><span style={fM} className="text-lg text-white font-bold">{levelHRs} HR</span><span style={fM} className="text-[10px] text-white/40">/ {level.requiredHR}</span></div>
                <div style={fB} className="text-[10px] text-white/30 mt-0.5">{player.name} — {player.teamName}</div>
              </div>
              <div className="bg-black/70 backdrop-blur rounded-lg px-3 py-2 border border-white/10 text-right">
                <div className="flex gap-2 items-center justify-end"><span style={fM} className="text-[10px] text-white/40">COUNT</span><span style={fM} className="text-lg text-white font-bold">{balls}-{strikes}</span></div>
                <div style={fM} className="text-[10px] text-white/40 mt-0.5">AB {Math.min(abNumber+1,level.totalABs)}/{level.totalABs}</div>
              </div>
            </div>
          )}
          {screen==='SWING_RESULT'&&lastResult&&(
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div style={{...fD,color:RES_S[lastResult.type]?.color,textShadow:'0 2px 20px rgba(0,0,0,0.9)'}} className={`text-5xl tracking-wider ${lastResult.type==='HR'?'animate-bounce':''}`}>{lastResult.type==='HR'?'💣 ':''}{RES_S[lastResult.type]?.text}</div>
                {lastResult.exitVelo!=null&&(<div style={fM} className="text-sm text-white/80 mt-2 drop-shadow-lg">{lastResult.exitVelo} mph &middot; {lastResult.launchAngle}&deg; &middot; {lastResult.distance} ft</div>)}
                {showPT&&(<div style={fB} className="text-xs text-white/40 mt-1">{PCC[pitchRef.current.type].name} — {Math.round(pitchRef.current.speed)} mph</div>)}
              </div>
            </div>
          )}
          {screen==='MENU'&&(
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-7xl mb-3">⚾</div>
                <h1 style={fD} className="text-6xl tracking-wider text-[#f59e0b] mb-2">BATTING CAGE</h1>
                <p style={fB} className="text-white/50 mb-8 max-w-md mx-auto">Work your way from Little League to The Show. Hit dingers, climb levels, become a legend.</p>
                <button onClick={()=>setScreen('CREATE_PLAYER')} style={fD} className="px-10 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-xl tracking-wide">NEW CAREER</button>
                <div style={fB} className="mt-5 text-xs text-white/25">Move mouse to aim &middot; Click to swing &middot; Timing is everything</div>
                {hs.length>0&&(<div className="mt-5 border-t border-white/10 pt-4"><div style={fD} className="text-xs text-white/30 tracking-[0.25em] mb-2">HIGH SCORES</div><div className="flex justify-center gap-4">{hs.map((s,i)=><span key={i} style={fM} className="text-sm text-[#f59e0b]">{s} HR</span>)}</div></div>)}
              </div>
            </div>
          )}
          {screen==='CREATE_PLAYER'&&(
            <div className="absolute inset-0 bg-[#0a0a0f]/94 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8 w-full max-w-md">
                <h2 style={fD} className="text-3xl tracking-wider text-[#f59e0b] mb-6">CREATE YOUR PLAYER</h2>
                <div className="space-y-4 text-left">
                  <div><label style={fD} className="text-xs tracking-[0.2em] text-white/50 block mb-1">PLAYER NAME</label><input type="text" value={cN} onChange={e=>setCN(e.target.value)} placeholder="Slugger" maxLength={20} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]/50" style={fB}/></div>
                  <div><label style={fD} className="text-xs tracking-[0.2em] text-white/50 block mb-1">TEAM NAME</label><input type="text" value={cT} onChange={e=>setCT(e.target.value)} placeholder="Dingers" maxLength={20} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]/50" style={fB}/></div>
                  <div><label style={fD} className="text-xs tracking-[0.2em] text-white/50 block mb-2">JERSEY COLOR</label><div className="flex gap-2 justify-center flex-wrap">{COLORS.map(c=><button key={'p'+c} onClick={()=>setCP(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${cP===c?'border-white scale-125':'border-transparent opacity-70 hover:opacity-100'}`} style={{backgroundColor:c}}/>)}</div></div>
                  <div><label style={fD} className="text-xs tracking-[0.2em] text-white/50 block mb-2">ACCENT COLOR</label><div className="flex gap-2 justify-center flex-wrap">{COLORS.map(c=><button key={'s'+c} onClick={()=>setCS(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${cS===c?'border-white scale-125':'border-transparent opacity-70 hover:opacity-100'}`} style={{backgroundColor:c}}/>)}</div></div>
                </div>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <div className="w-10 h-14 rounded-md border border-white/10 relative overflow-hidden" style={{backgroundColor:cP}}><div className="absolute bottom-0 left-0 right-0 h-2" style={{backgroundColor:cS}}/><div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#dab894]"/></div>
                  <div className="text-left"><div style={fD} className="text-lg text-white tracking-wide">{cN||'Slugger'}</div><div style={fB} className="text-xs text-white/40">{cT||'Dingers'}</div></div>
                </div>
                <button onClick={confirmPlayer} style={fD} className="mt-6 px-10 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">START CAREER</button>
              </div>
            </div>
          )}
          {screen==='LEVEL_INTRO'&&level&&(
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div style={fD} className="text-sm tracking-[0.3em] text-white/25 mb-2">LEVEL {levelIdx+1} OF {LEVELS.length}</div>
                <h2 style={fD} className="text-5xl tracking-wider text-[#f59e0b] mb-1">{level.name}</h2>
                <p style={fB} className="text-white/50 mb-7">{level.subtitle}</p>
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6">{[['GOAL',`${level.requiredHR} HR`],['AT-BATS',`${level.totalABs}`],['SPEED',`${level.pitchSpeedMin}-${level.pitchSpeedMax}`]].map(([l,v])=>(<div key={l} className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={fD} className="text-[10px] tracking-widest text-white/40">{l}</div><div style={fM} className="text-xl text-white font-bold">{v}</div></div>))}</div>
                <div className="mb-7"><div style={fD} className="text-[10px] tracking-widest text-white/25 mb-2">PITCHES</div><div className="flex justify-center gap-2">{level.pitchTypes.map(pt=>(<span key={pt} style={{...fM,borderColor:PCC[pt].color}} className="text-xs px-2 py-1 rounded border text-white/70">{PCC[pt].name}</span>))}</div></div>
                <button onClick={startLvl} style={fD} className="px-10 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">STEP UP TO THE PLATE</button>
              </div>
            </div>
          )}
          {screen==='LEVEL_COMPLETE'&&level&&(
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-5xl mb-3">🎉</div><h2 style={fD} className="text-4xl tracking-wider text-[#4ade80] mb-1">LEVEL CLEARED!</h2><p style={fB} className="text-white/50 mb-6">You crushed {level.name}</p>
                <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6"><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={fD} className="text-[10px] tracking-widest text-white/40">HOME RUNS</div><div style={fM} className="text-2xl text-[#f59e0b] font-bold">{levelHRs}</div></div><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={fD} className="text-[10px] tracking-widest text-white/40">HITS</div><div style={fM} className="text-2xl text-white font-bold">{levelHits}</div></div></div>
                <button onClick={nextLvl} style={fD} className="px-10 py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-lg transition-colors text-lg tracking-wide">NEXT LEVEL →</button>
              </div>
            </div>
          )}
          {screen==='LEVEL_FAILED'&&level&&(
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-5xl mb-3">😤</div><h2 style={fD} className="text-4xl tracking-wider text-[#ef4444] mb-1">SENT DOWN</h2><p style={fB} className="text-white/50 mb-6">Needed {level.requiredHR} HR, only hit {levelHRs}</p>
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6">{[['CAREER HR',career.totalHR],['LONGEST',`${career.longestHR} ft`],['MAX EV',`${career.maxExitVelo} mph`]].map(([l,v])=>(<div key={String(l)} className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={fD} className="text-[10px] tracking-widest text-white/40">{String(l)}</div><div style={fM} className="text-lg text-white font-bold">{String(v)}</div></div>))}</div>
                <div className="flex gap-3 justify-center"><button onClick={startLvl} style={fD} className="px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">TRY AGAIN</button><button onClick={()=>setScreen('MENU')} style={fD} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-lg tracking-wide">MAIN MENU</button></div>
              </div>
            </div>
          )}
          {screen==='CAREER_COMPLETE'&&(
            <div className="absolute inset-0 bg-[#0a0a0f]/92 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="text-center px-8">
                <div className="text-6xl mb-3">🏆</div><h2 style={fD} className="text-5xl tracking-wider text-[#f59e0b] mb-1">HALL OF FAME!</h2><p style={fB} className="text-white/50 mb-6">{player.name} is a dinger machine.</p>
                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-6">{[['CAREER HR',career.totalHR,true],['LONGEST',`${career.longestHR} ft`,false],['MAX EV',`${career.maxExitVelo} mph`,false],['HITS',career.totalHits,false]].map(([l,v,a])=>(<div key={String(l)} className={`bg-white/5 rounded-lg p-3 border ${a?'border-[#f59e0b]/30':'border-white/10'}`}><div style={fD} className={`text-[10px] tracking-widest ${a?'text-[#f59e0b]':'text-white/40'}`}>{String(l)}</div><div style={fM} className={`text-2xl font-bold ${a?'text-[#f59e0b]':'text-white'}`}>{String(v)}</div></div>))}</div>
                <div className="flex gap-3 justify-center"><button onClick={()=>setScreen('CREATE_PLAYER')} style={fD} className="px-8 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg transition-colors text-lg tracking-wide">NEW CAREER</button><button onClick={()=>setScreen('MENU')} style={fD} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-lg tracking-wide">MAIN MENU</button></div>
              </div>
            </div>
          )}
        </div>
      </div>
      <footer className="border-t border-[#1e1e2a] px-4 py-3 text-center"><span style={fB} className="text-xs text-white/30">⚾ Dingers Only Batting Cage — <Link href="/" className="text-[#f59e0b]/60 hover:text-[#f59e0b] transition-colors">Back to League</Link></span></footer>
    </div>
  )
}
