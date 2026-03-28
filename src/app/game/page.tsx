'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface PlayerProfile { name: string; teamName: string; primaryColor: string; secondaryColor: string }
interface Level { name: string; subtitle: string; pitchSpeedMin: number; pitchSpeedMax: number; pitchTypes: PitchType[]; fenceDistance: number; requiredHR: number; totalABs: number; strikeZoneSize: number; accentColor: string }
type PitchType = 'fastball' | 'changeup' | 'slider' | 'curveball' | 'cutter'
interface PitchConfig { name: string; speedMult: number; horizMovement: number; vertMovement: number; color: string }
type GameScreen = 'MENU' | 'CREATE_PLAYER' | 'LEVEL_INTRO' | 'AT_BAT' | 'PITCHING' | 'SWING_RESULT' | 'LEVEL_COMPLETE' | 'LEVEL_FAILED' | 'CAREER_COMPLETE'
interface AtBatResult { type: 'HR' | 'TRIPLE' | 'DOUBLE' | 'SINGLE' | 'FLY_OUT' | 'GROUND_OUT' | 'LINE_OUT' | 'STRIKE' | 'BALL' | 'FOUL'; exitVelo?: number; launchAngle?: number; distance?: number; description: string }

const PITCH_CONFIGS: Record<PitchType, PitchConfig> = {
  fastball: { name: 'Fastball', speedMult: 1.0, horizMovement: 0, vertMovement: -2, color: '#ef4444' },
  changeup: { name: 'Changeup', speedMult: 0.82, horizMovement: 3, vertMovement: 8, color: '#22c55e' },
  slider: { name: 'Slider', speedMult: 0.88, horizMovement: 14, vertMovement: 3, color: '#3b82f6' },
  curveball: { name: 'Curveball', speedMult: 0.78, horizMovement: -4, vertMovement: 18, color: '#a855f7' },
  cutter: { name: 'Cutter', speedMult: 0.94, horizMovement: -8, vertMovement: 2, color: '#f97316' },
}

const LEVELS: Level[] = [
  { name: 'LITTLE LEAGUE', subtitle: 'The sandlot where legends begin', pitchSpeedMin: 45, pitchSpeedMax: 55, pitchTypes: ['fastball'], fenceDistance: 200, requiredHR: 2, totalABs: 10, strikeZoneSize: 1.3, accentColor: '#4ade80' },
  { name: 'HIGH SCHOOL', subtitle: 'Varsity tryouts', pitchSpeedMin: 62, pitchSpeedMax: 74, pitchTypes: ['fastball', 'changeup'], fenceDistance: 310, requiredHR: 3, totalABs: 12, strikeZoneSize: 1.15, accentColor: '#60a5fa' },
  { name: 'COLLEGE', subtitle: 'NCAA regionals — scouts are watching', pitchSpeedMin: 78, pitchSpeedMax: 88, pitchTypes: ['fastball', 'changeup', 'slider'], fenceDistance: 360, requiredHR: 3, totalABs: 12, strikeZoneSize: 1.0, accentColor: '#c084fc' },
  { name: 'THE SHOW', subtitle: 'Welcome to the bigs, rook', pitchSpeedMin: 90, pitchSpeedMax: 101, pitchTypes: ['fastball', 'changeup', 'slider', 'curveball', 'cutter'], fenceDistance: 400, requiredHR: 4, totalABs: 15, strikeZoneSize: 0.9, accentColor: '#f59e0b' },
]

const COLOR_OPTIONS = ['#ef4444','#f97316','#f59e0b','#22c55e','#10b981','#3b82f6','#6366f1','#a855f7','#ec4899','#ffffff']
const CW = 800, CH = 560, SZ_BASE_W = 140, SZ_BASE_H = 170, SZ_CX = CW/2, SZ_CY = 370, PITCHER_Y = 120

function lerp(a:number,b:number,t:number){return a+(b-a)*t}
function clamp(v:number,mn:number,mx:number){return Math.max(mn,Math.min(mx,v))}
function rand(a:number,b:number){return Math.random()*(b-a)+a}
function randInt(a:number,b:number){return Math.floor(rand(a,b+1))}
function pick<T>(a:T[]):T{return a[Math.floor(Math.random()*a.length)]}
function easeIn(t:number){return t*t}
function easeOut(t:number){return 1-Math.pow(1-t,3)}

function drawHomePlate(c:CanvasRenderingContext2D){c.fillStyle='#e8e8e8';c.beginPath();c.moveTo(CW/2,SZ_CY+70);c.lineTo(CW/2-10,SZ_CY+60);c.lineTo(CW/2-10,SZ_CY+50);c.lineTo(CW/2+10,SZ_CY+50);c.lineTo(CW/2+10,SZ_CY+60);c.closePath();c.fill()}

function drawField(c:CanvasRenderingContext2D,li:number,t:number){
  if(li===0)drawSandlot(c);else if(li===1)drawHS(c);else if(li===2)drawCollege(c);else drawPro(c,t)
}

function drawSandlot(c:CanvasRenderingContext2D){
  let g=c.createLinearGradient(0,0,0,280);g.addColorStop(0,'#5BA3D9');g.addColorStop(1,'#87CEEB');c.fillStyle=g;c.fillRect(0,0,CW,280)
  c.fillStyle='rgba(255,255,255,0.7)';[[150,50,30],[170,40,25],[130,45,20],[600,60,35],[620,50,28],[580,55,22]].forEach(([x,y,r])=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()})
  c.fillStyle='#2d8a2d';[50,120,200,350,500,620,700,760].forEach(x=>{c.beginPath();c.arc(x,195,30+Math.sin(x)*8,0,Math.PI*2);c.fill()})
  c.strokeStyle='#888';c.lineWidth=2;c.beginPath();c.moveTo(0,210);c.lineTo(CW,210);c.stroke()
  g=c.createLinearGradient(0,210,0,CH);g.addColorStop(0,'#4a8a3a');g.addColorStop(1,'#3a7a2a');c.fillStyle=g;c.fillRect(0,210,CW,CH-210)
  c.fillStyle='#9a8a5a';c.beginPath();c.ellipse(300,350,40,25,0.2,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(500,400,35,20,-0.3,0,Math.PI*2);c.fill()
  c.fillStyle='#b8a070';c.beginPath();c.ellipse(CW/2,SZ_CY+60,90,35,0,0,Math.PI*2);c.fill()
  c.fillStyle='#b8a070';c.beginPath();c.ellipse(CW/2,PITCHER_Y+15,25,8,0,0,Math.PI*2);c.fill();drawHomePlate(c)
}

function drawHS(c:CanvasRenderingContext2D){
  let g=c.createLinearGradient(0,0,0,280);g.addColorStop(0,'#3a6fa8');g.addColorStop(1,'#6aaed6');c.fillStyle=g;c.fillRect(0,0,CW,280)
  c.fillStyle='#666';c.fillRect(20,170,150,40);c.fillRect(CW-170,170,150,40)
  c.fillStyle='#5a4020';c.fillRect(0,200,CW,15);c.fillStyle='#7a5a30';c.fillRect(0,200,CW,3)
  c.fillStyle='#2a2a2a';c.fillRect(360,160,80,45);c.fillStyle='#4ade80';c.font='bold 14px monospace';c.textAlign='center';c.fillText('HOME',400,180)
  g=c.createLinearGradient(0,215,0,CH);g.addColorStop(0,'#2d7a2d');g.addColorStop(1,'#2a6a2a');c.fillStyle=g;c.fillRect(0,215,CW,CH-215)
  for(let i=0;i<8;i++){c.fillStyle=i%2===0?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)';c.fillRect(0,215+i*45,CW,45)}
  c.fillStyle='#a08050';c.beginPath();c.ellipse(CW/2,SZ_CY+55,95,38,0,0,Math.PI*2);c.fill()
  c.fillStyle='#2d7a2d';c.beginPath();c.ellipse(CW/2,SZ_CY+20,35,30,0,0,Math.PI*2);c.fill()
  c.fillStyle='#a08050';c.beginPath();c.ellipse(CW/2,PITCHER_Y+15,28,9,0,0,Math.PI*2);c.fill();drawHomePlate(c)
}

function drawCollege(c:CanvasRenderingContext2D){
  let g=c.createLinearGradient(0,0,0,280);g.addColorStop(0,'#1a2a4a');g.addColorStop(1,'#3a6a5a');c.fillStyle=g;c.fillRect(0,0,CW,280)
  for(const[lx,ly]of[[100,30],[250,20],[550,20],[700,30]]){const gl=c.createRadialGradient(lx,ly,2,lx,ly,60);gl.addColorStop(0,'rgba(255,255,220,0.6)');gl.addColorStop(1,'rgba(255,255,200,0)');c.fillStyle=gl;c.fillRect(lx-60,ly-60,120,120);c.fillStyle='#fffde0';c.beginPath();c.arc(lx,ly,3,0,Math.PI*2);c.fill();c.strokeStyle='#555';c.lineWidth=3;c.beginPath();c.moveTo(lx,ly+5);c.lineTo(lx,170);c.stroke()}
  c.fillStyle='#3a3a4a';c.beginPath();c.moveTo(0,150);c.lineTo(0,210);c.lineTo(CW,210);c.lineTo(CW,150);c.bezierCurveTo(CW*0.7,180,CW*0.3,180,0,150);c.fill()
  for(let i=0;i<80;i++){c.fillStyle=`hsl(${rand(0,360)},60%,${rand(40,70)}%)`;c.beginPath();c.arc(rand(20,CW-20),rand(155,205),2.5,0,Math.PI*2);c.fill()}
  c.fillStyle='#1a4a1a';c.fillRect(0,208,CW,18);c.fillStyle='#2a6a2a';c.fillRect(0,208,CW,4)
  g=c.createLinearGradient(0,226,0,CH);g.addColorStop(0,'#1e5a1e');g.addColorStop(1,'#1a4a1a');c.fillStyle=g;c.fillRect(0,226,CW,CH-226)
  c.fillStyle='#8a6a40';c.beginPath();c.ellipse(CW/2,SZ_CY+55,100,40,0,0,Math.PI*2);c.fill()
  c.fillStyle='#1e5a1e';c.beginPath();c.ellipse(CW/2,SZ_CY+15,38,32,0,0,Math.PI*2);c.fill()
  c.fillStyle='#8a6a40';c.beginPath();c.ellipse(CW/2,PITCHER_Y+15,30,10,0,0,Math.PI*2);c.fill();drawHomePlate(c)
}

function drawPro(c:CanvasRenderingContext2D,time:number){
  let g=c.createLinearGradient(0,0,0,280);g.addColorStop(0,'#050510');g.addColorStop(1,'#101030');c.fillStyle=g;c.fillRect(0,0,CW,280)
  c.fillStyle='rgba(255,255,255,0.4)';for(let i=0;i<40;i++){c.fillRect((i*137.5+10)%CW,(i*73.1+5)%120,1.2,1.2)}
  for(const[lx,ly]of[[80,15],[200,10],[350,8],[450,8],[600,10],[720,15]]){const gl=c.createRadialGradient(lx,ly,3,lx,ly,80);gl.addColorStop(0,'rgba(255,255,220,0.7)');gl.addColorStop(1,'rgba(255,255,200,0)');c.fillStyle=gl;c.fillRect(lx-80,ly-80,160,160);c.fillStyle='#fffde8';c.beginPath();c.arc(lx,ly,4,0,Math.PI*2);c.fill()}
  c.fillStyle='#1a1a2a';c.fillRect(0,100,CW,50)
  c.fillStyle='#2a2a3a';c.beginPath();c.moveTo(0,148);c.lineTo(0,215);c.lineTo(CW,215);c.lineTo(CW,148);c.bezierCurveTo(CW*0.75,175,CW*0.25,175,0,148);c.fill()
  for(let i=0;i<200;i++){c.fillStyle=`hsla(${(i*47+Math.sin(time/2000+i)*20)%360},50%,${50+Math.sin(time/1000+i*3)*10}%,0.8)`;c.beginPath();c.arc((i*4.01)%CW,105+(i*2.73)%105,2,0,Math.PI*2);c.fill()}
  c.fillStyle='#0a3a0a';c.fillRect(0,213,CW,20);c.fillStyle='#1a5a1a';c.fillRect(0,213,CW,5)
  c.fillStyle='#ffd700';c.font='bold 10px monospace';c.textAlign='center';c.fillText('330',80,228);c.fillText('400',CW/2,228);c.fillText('330',CW-80,228)
  g=c.createLinearGradient(0,233,0,CH);g.addColorStop(0,'#0f4a0f');g.addColorStop(0.5,'#1a5a1a');g.addColorStop(1,'#0a3a0a');c.fillStyle=g;c.fillRect(0,233,CW,CH-233)
  c.save();c.globalAlpha=0.06;for(let i=0;i<12;i++){c.fillStyle=i%2===0?'#fff':'#000';c.fillRect(0,233+i*28,CW,28)};c.restore()
  c.strokeStyle='rgba(255,255,255,0.15)';c.lineWidth=2;c.beginPath();c.moveTo(CW/2,SZ_CY+70);c.lineTo(CW/2-200,233);c.stroke();c.beginPath();c.moveTo(CW/2,SZ_CY+70);c.lineTo(CW/2+200,233);c.stroke()
  c.fillStyle='#7a5a35';c.beginPath();c.ellipse(CW/2,SZ_CY+55,105,42,0,0,Math.PI*2);c.fill()
  c.fillStyle='#0f4a0f';c.beginPath();c.ellipse(CW/2,SZ_CY+12,40,34,0,0,Math.PI*2);c.fill()
  c.fillStyle='#7a5a35';c.beginPath();c.ellipse(CW/2,PITCHER_Y+15,32,11,0,0,Math.PI*2);c.fill()
  c.fillStyle='#ddd';c.fillRect(CW/2-8,PITCHER_Y+13,16,3);drawHomePlate(c)
}

function drawPitcher(c:CanvasRenderingContext2D,li:number,windup:boolean){
  const px=CW/2,py=PITCHER_Y
  const jc=li===0?'#e04040':li===1?'#3060c0':li===2?'#6030a0':'#1a1a1a'
  c.save()
  c.fillStyle='rgba(0,0,0,0.2)';c.beginPath();c.ellipse(px,py+28,18,5,0,0,Math.PI*2);c.fill()
  c.fillStyle='#e8e8e8';c.beginPath();c.moveTo(px-6,py+8);c.lineTo(px-10,py+25);c.lineTo(px-3,py+25);c.lineTo(px-2,py+8);c.fill();c.beginPath();c.moveTo(px+2,py+8);c.lineTo(px+3,py+25);c.lineTo(px+10,py+25);c.lineTo(px+6,py+8);c.fill()
  c.fillStyle='#222';c.fillRect(px-12,py+24,10,4);c.fillRect(px+2,py+24,10,4)
  c.fillStyle=jc;c.beginPath();c.moveTo(px-12,py-8);c.lineTo(px-10,py+10);c.lineTo(px+10,py+10);c.lineTo(px+12,py-8);c.bezierCurveTo(px+8,py-12,px-8,py-12,px-12,py-8);c.fill()
  c.fillStyle='rgba(255,255,255,0.8)';c.font='bold 10px Arial';c.textAlign='center';c.fillText('1',px,py+4)
  c.fillStyle='#f0c8a0'
  if(windup){c.beginPath();c.moveTo(px+10,py-5);c.lineTo(px+20,py-18);c.lineTo(px+17,py-20);c.lineTo(px+8,py-7);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(px+19,py-20,4,0,Math.PI*2);c.fill();c.strokeStyle='#cc3333';c.lineWidth=0.5;c.beginPath();c.arc(px+19,py-21,2,0,1);c.stroke();c.fillStyle='#8B4513';c.beginPath();c.ellipse(px-18,py-2,7,5,0.3,0,Math.PI*2);c.fill();c.fillStyle='#f0c8a0';c.beginPath();c.moveTo(px-10,py-5);c.lineTo(px-16,py);c.lineTo(px-13,py+2);c.lineTo(px-8,py-3);c.fill()}
  else{c.beginPath();c.moveTo(px+10,py-5);c.lineTo(px+18,py+5);c.lineTo(px+15,py+7);c.lineTo(px+8,py-3);c.fill();c.fillStyle='#8B4513';c.beginPath();c.ellipse(px-16,py+5,7,5,-0.3,0,Math.PI*2);c.fill();c.fillStyle='#f0c8a0';c.beginPath();c.moveTo(px-10,py-5);c.lineTo(px-14,py+3);c.lineTo(px-11,py+5);c.lineTo(px-8,py-3);c.fill()}
  c.fillStyle='#f0c8a0';c.beginPath();c.arc(px,py-17,9,0,Math.PI*2);c.fill()
  c.fillStyle=jc;c.beginPath();c.arc(px,py-20,10,Math.PI,Math.PI*2);c.fill();c.fillRect(px-2,py-28,14,5)
  c.fillStyle='#222';c.beginPath();c.arc(px-3,py-17,1.5,0,Math.PI*2);c.fill();c.beginPath();c.arc(px+3,py-17,1.5,0,Math.PI*2);c.fill()
  c.restore()
}

export default function GamePage(){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const[screen,setScreen]=useState<GameScreen>('MENU')
  const[player,setPlayer]=useState<PlayerProfile>({name:'',teamName:'',primaryColor:'#f59e0b',secondaryColor:'#1a1a1a'})
  const[levelIdx,setLevelIdx]=useState(0)
  const[abNumber,setAbNumber]=useState(0)
  const[strikes,setStrikes]=useState(0)
  const[balls,setBalls]=useState(0)
  const[levelHRs,setLevelHRs]=useState(0)
  const[levelHits,setLevelHits]=useState(0)
  const[lastResult,setLastResult]=useState<AtBatResult|null>(null)
  const[careerHR,setCareerHR]=useState(0)
  const[longestHR,setLongestHR]=useState(0)
  const[maxEV,setMaxEV]=useState(0)
  const[nameInput,setNameInput]=useState('')
  const[teamInput,setTeamInput]=useState('')

  const mouseRef=useRef({x:CW/2,y:SZ_CY})
  const pitchRef=useRef({active:false,type:'fastball' as PitchType,startX:CW/2,startY:PITCHER_Y,targetX:CW/2,targetY:SZ_CY,currentX:CW/2,currentY:PITCHER_Y,progress:0,speed:85,thrown:false,arrivalTime:0,throwTime:0,horizBreak:0,vertBreak:0})
  const swingRef=useRef({swung:false,swingTime:0,swingX:CW/2,swingY:SZ_CY})
  const animRef=useRef(0)
  const screenRef=useRef(screen),levelRef=useRef(levelIdx),strikesRef=useRef(strikes),ballsRef=useRef(balls),abRef=useRef(abNumber),hrsRef=useRef(levelHRs)
  const resultTimerRef=useRef(0),pitchDelayRef=useRef(0),waitRef=useRef(false)

  useEffect(()=>{screenRef.current=screen},[screen])
  useEffect(()=>{levelRef.current=levelIdx},[levelIdx])
  useEffect(()=>{strikesRef.current=strikes},[strikes])
  useEffect(()=>{ballsRef.current=balls},[balls])
  useEffect(()=>{abRef.current=abNumber},[abNumber])
  useEffect(()=>{hrsRef.current=levelHRs},[levelHRs])

  const level=LEVELS[levelIdx]
  const szW=SZ_BASE_W*(level?.strikeZoneSize??1),szH=SZ_BASE_H*(level?.strikeZoneSize??1)
  const szL=SZ_CX-szW/2,szR=SZ_CX+szW/2,szT=SZ_CY-szH/2,szB=SZ_CY+szH/2

  const throwPitch=useCallback(()=>{
    if(!level)return;const type=pick(level.pitchTypes),cfg=PITCH_CONFIGS[type],spd=rand(level.pitchSpeedMin,level.pitchSpeedMax)*cfg.speedMult
    const inZ=Math.random()<0.65;let tx:number,ty:number
    if(inZ){tx=rand(szL+8,szR-8);ty=rand(szT+8,szB-8)}else{const s=randInt(0,3);if(s===0){tx=rand(szL-40,szL-5);ty=rand(szT,szB)}else if(s===1){tx=rand(szR+5,szR+40);ty=rand(szT,szB)}else if(s===2){tx=rand(szL,szR);ty=rand(szT-40,szT-5)}else{tx=rand(szL,szR);ty=rand(szB+5,szB+40)}}
    const ft=lerp(850,450,(spd-40)/65),bs=level.strikeZoneSize>1?0.6:1.0
    pitchRef.current={active:true,type,startX:CW/2+rand(-15,15),startY:PITCHER_Y,targetX:tx,targetY:ty,currentX:CW/2,currentY:PITCHER_Y,progress:0,speed:spd,thrown:true,throwTime:performance.now(),arrivalTime:ft,horizBreak:cfg.horizMovement*bs,vertBreak:cfg.vertMovement*bs}
    swingRef.current={swung:false,swingTime:0,swingX:CW/2,swingY:SZ_CY}
  },[level,szL,szR,szT,szB])

  const calcResult=useCallback((sx:number,sy:number,st:number,px:number,py:number,pa:number,pt:number):AtBatResult=>{
    if(!level)return{type:'STRIKE',description:''}
    const td=Math.abs(st-(pt+pa)),pd=Math.sqrt((sx-px)**2+(sy-py)**2)
    const ts=td<30?1:td<60?0.9:td<100?0.75:td<160?0.5:td<250?0.25:0.05
    const ps=Math.max(0,1-pd/90),ct=ts*0.55+ps*0.45
    if(ct<0.12||pd>80)return px>=szL&&px<=szR&&py>=szT&&py<=szB?{type:'STRIKE',description:'Swing and a miss!'}:{type:'BALL',description:'Ball'}
    if(ct<0.25&&Math.random()<0.6)return{type:'FOUL',description:'Foul ball'}
    const ev=lerp(55,112,Math.pow(ct,0.8))+rand(-5,5),vd=(sy-py)/szH
    const la=lerp(-15,50,clamp(0.5-vd*1.5,0,1))+rand(-(1-ct)*25,(1-ct)*25)
    const v0=ev*1.467,ht=(2*v0*Math.sin(la*Math.PI/180))/32.2
    let d=Math.max(0,v0*Math.cos(la*Math.PI/180)*Math.max(0,ht)*0.7)*lerp(0.4,1.1,ct)
    if(la<5){d=Math.min(d,rand(80,200));return ct>0.5&&Math.random()<0.3?{type:'SINGLE',exitVelo:Math.round(ev),distance:Math.round(d),description:`Ground ball single! ${Math.round(ev)} mph`}:{type:'GROUND_OUT',exitVelo:Math.round(ev),distance:Math.round(d),description:'Grounded out'}}
    if(la>55)return{type:'FLY_OUT',exitVelo:Math.round(ev),distance:Math.round(Math.min(d,180)),description:'Popped up'}
    if(d>=level.fenceDistance)return{type:'HR',exitVelo:Math.round(ev),launchAngle:Math.round(la),distance:Math.round(d),description:`GONE! ${Math.round(d)} ft, ${Math.round(ev)} mph EV`}
    if(d>level.fenceDistance*0.85&&la>15)return Math.random()<0.4?{type:'FLY_OUT',exitVelo:Math.round(ev),distance:Math.round(d),description:'Warning track!'}:{type:'TRIPLE',exitVelo:Math.round(ev),distance:Math.round(d),description:`Triple! ${Math.round(d)} ft`}
    if(d>level.fenceDistance*0.55)return la>25&&Math.random()<0.35?{type:'FLY_OUT',exitVelo:Math.round(ev),distance:Math.round(d),description:'Caught at the track'}:{type:'DOUBLE',exitVelo:Math.round(ev),distance:Math.round(d),description:`Double! ${Math.round(d)} ft`}
    return ct>0.4?{type:'SINGLE',exitVelo:Math.round(ev),distance:Math.round(d),description:`Base hit! ${Math.round(ev)} mph`}:{type:'FLY_OUT',exitVelo:Math.round(ev),distance:Math.round(d),description:'Fly out'}
  },[level,szL,szR,szT,szB,szH])

  const schedPitch=useCallback(()=>{waitRef.current=true;pitchDelayRef.current=performance.now()+rand(800,1500)},[])

  const advanceAB=useCallback(()=>{
    const nab=abRef.current+1;setAbNumber(nab)
    if(!level)return
    if(nab>=level.totalABs){
      const hrs=hrsRef.current
      if(hrs>=level.requiredHR){if(levelIdx>=LEVELS.length-1)setScreen('CAREER_COMPLETE');else setScreen('LEVEL_COMPLETE')}
      else setScreen('LEVEL_FAILED')
    }else{setScreen('AT_BAT');schedPitch()}
  },[level,levelIdx,schedPitch])

  const processResult=useCallback((r:AtBatResult)=>{
    setLastResult(r);resultTimerRef.current=performance.now()
    const isHit=['HR','TRIPLE','DOUBLE','SINGLE'].includes(r.type),isEnd=isHit||['FLY_OUT','GROUND_OUT','LINE_OUT'].includes(r.type)
    if(r.type==='HR'){setLevelHRs(h=>{hrsRef.current=h+1;return h+1});setLevelHits(h=>h+1);setCareerHR(h=>h+1);if(r.distance)setLongestHR(h=>Math.max(h,r.distance!));if(r.exitVelo)setMaxEV(h=>Math.max(h,r.exitVelo!))}
    else if(isHit){setLevelHits(h=>h+1);if(r.exitVelo)setMaxEV(h=>Math.max(h,r.exitVelo!))}
    if(r.type==='STRIKE'||r.type==='FOUL'){const ns=strikesRef.current+1;setStrikes(ns);if(r.type==='STRIKE'&&ns>=3){setTimeout(()=>{setStrikes(0);setBalls(0);advanceAB()},1200);return};setTimeout(()=>{setScreen('AT_BAT');schedPitch()},900);return}
    if(r.type==='BALL'){const nb=ballsRef.current+1;setBalls(nb);if(nb>=4){setTimeout(()=>{setStrikes(0);setBalls(0);setScreen('AT_BAT');schedPitch()},1000);return};setTimeout(()=>{setScreen('AT_BAT');schedPitch()},900);return}
    if(isEnd)setTimeout(()=>{setStrikes(0);setBalls(0);advanceAB()},r.type==='HR'?2200:1400)
  },[advanceAB,schedPitch])

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;let run=true
    const loop=(time:number)=>{
      if(!run)return
      if(waitRef.current&&time>pitchDelayRef.current&&screenRef.current==='AT_BAT'){waitRef.current=false;setScreen('PITCHING');throwPitch()}
      ctx.clearRect(0,0,CW,CH);const lv=LEVELS[levelRef.current];if(!lv){animRef.current=requestAnimationFrame(loop);return}
      const scr=screenRef.current
      if(scr==='AT_BAT'||scr==='PITCHING'||scr==='SWING_RESULT'){
        drawField(ctx,levelRef.current,time)
        const sw=SZ_BASE_W*lv.strikeZoneSize,sh=SZ_BASE_H*lv.strikeZoneSize,sl=SZ_CX-sw/2,sr=SZ_CX+sw/2,st=SZ_CY-sh/2,sb=SZ_CY+sh/2
        ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.strokeRect(sl,st,sw,sh);ctx.setLineDash([])
        ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(sl+(sw/3)*i,st);ctx.lineTo(sl+(sw/3)*i,sb);ctx.stroke();ctx.beginPath();ctx.moveTo(sl,st+(sh/3)*i);ctx.lineTo(sr,st+(sh/3)*i);ctx.stroke()}
        drawPitcher(ctx,levelRef.current,waitRef.current)
        const p=pitchRef.current
        if(p.active&&(scr==='PITCHING'||scr==='SWING_RESULT')){
          const el=time-p.throwTime,t=clamp(el/p.arrivalTime,0,1),e=easeIn(t);let bx=lerp(p.startX,p.targetX,e),by=lerp(p.startY,p.targetY,e)
          const bt=clamp((t-0.7)/0.3,0,1);bx+=p.horizBreak*easeOut(bt);by+=p.vertBreak*easeOut(bt);p.currentX=bx;p.currentY=by;p.progress=t
          const bs=lerp(4,14,e);ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(bx+2,by+bs+2,bs*0.8,bs*0.3,0,0,Math.PI*2);ctx.fill()
          const bg=ctx.createRadialGradient(bx-2,by-2,1,bx,by,bs);bg.addColorStop(0,'#fff');bg.addColorStop(1,'#ccc');ctx.fillStyle=bg;ctx.beginPath();ctx.arc(bx,by,bs,0,Math.PI*2);ctx.fill()
          if(bs>8){ctx.strokeStyle='#cc3333';ctx.lineWidth=1;ctx.beginPath();ctx.arc(bx-2,by,bs*0.6,-0.5,0.5);ctx.stroke();ctx.beginPath();ctx.arc(bx+2,by,bs*0.6,2.6,3.6);ctx.stroke()}
          if(t>=1&&!swingRef.current.swung){p.active=false;const inZ=p.targetX>=sl&&p.targetX<=sr&&p.targetY>=st&&p.targetY<=sb;setScreen('SWING_RESULT');processResult(inZ?{type:'STRIKE',description:'Called strike!'}:{type:'BALL',description:'Ball'})}
        }
        if((scr==='AT_BAT'||scr==='PITCHING')&&!swingRef.current.swung){const mx=mouseRef.current.x,my=mouseRef.current.y;ctx.strokeStyle=`${player.primaryColor}bb`;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(mx,my,20,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=`${player.primaryColor}88`;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(mx-28,my);ctx.lineTo(mx-10,my);ctx.stroke();ctx.beginPath();ctx.moveTo(mx+10,my);ctx.lineTo(mx+28,my);ctx.stroke();ctx.beginPath();ctx.moveTo(mx,my-28);ctx.lineTo(mx,my-10);ctx.stroke();ctx.beginPath();ctx.moveTo(mx,my+10);ctx.lineTo(mx,my+28);ctx.stroke();ctx.fillStyle=player.primaryColor;ctx.beginPath();ctx.arc(mx,my,3,0,Math.PI*2);ctx.fill()}
        if(swingRef.current.swung&&scr==='SWING_RESULT'){const sx=swingRef.current.swingX,sy=swingRef.current.swingY,el=time-swingRef.current.swingTime,sa=clamp(el/150,0,1);ctx.save();ctx.translate(sx,sy);ctx.rotate(-1.2+sa*2.4);ctx.strokeStyle='#8B4513';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(35,-5);ctx.stroke();ctx.strokeStyle='#A0522D';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(30,-4);ctx.lineTo(50,-8);ctx.stroke();ctx.restore();if(el<100&&lastResult&&['HR','TRIPLE','DOUBLE','SINGLE','FLY_OUT','GROUND_OUT','LINE_OUT','FOUL'].includes(lastResult.type)){ctx.fillStyle=`rgba(245,158,11,${(1-el/100)*0.6})`;ctx.beginPath();ctx.arc(sx,sy,30+el*0.3,0,Math.PI*2);ctx.fill()}}
        if(scr==='SWING_RESULT'&&lastResult?.type==='HR'){const el=time-resultTimerRef.current,t=clamp(el/1800,0,1),e=easeOut(t);if(t<1){const hx=lerp(swingRef.current.swingX,CW/2,e),hy=lerp(swingRef.current.swingY,-20,e);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx,hy,lerp(12,5,e),0,Math.PI*2);ctx.fill();for(let i=0;i<5;i++){const a=rand(0,Math.PI*2),d=rand(5,20)*t;ctx.fillStyle=`rgba(245,158,11,${1-t})`;ctx.beginPath();ctx.arc(hx+Math.cos(a)*d,hy+Math.sin(a)*d,2,0,Math.PI*2);ctx.fill()}}}
        if(scr==='SWING_RESULT'&&lastResult){const lb:Record<string,{t:string;c:string}>={HR:{t:'💣 HOME RUN!',c:'#f59e0b'},TRIPLE:{t:'🔥 TRIPLE!',c:'#a855f7'},DOUBLE:{t:'✨ DOUBLE!',c:'#3b82f6'},SINGLE:{t:'👏 SINGLE!',c:'#22c55e'},FLY_OUT:{t:'Fly Out',c:'#ef4444'},GROUND_OUT:{t:'Ground Out',c:'#ef4444'},LINE_OUT:{t:'Line Out',c:'#ef4444'},STRIKE:{t:'STRIKE!',c:'#ef4444'},BALL:{t:'Ball',c:'#94a3b8'},FOUL:{t:'Foul Ball',c:'#fbbf24'}};const i=lb[lastResult.type];if(i){ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(CW/2-130,265,260,50);ctx.strokeStyle=i.c;ctx.lineWidth=2;ctx.strokeRect(CW/2-130,265,260,50);ctx.fillStyle=i.c;ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText(i.t,CW/2,297)};if(lastResult.description&&!['STRIKE','BALL'].includes(lastResult.type)){ctx.fillStyle='#aaa';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText(lastResult.description,CW/2,330)}}
        ctx.fillStyle='rgba(0,0,0,0.8)';ctx.fillRect(0,0,CW,36);ctx.fillStyle=lv.accentColor;ctx.font='bold 13px monospace';ctx.textAlign='left';ctx.fillText(lv.name,10,14);ctx.fillStyle='#fff';ctx.font='bold 16px monospace';ctx.fillText(`${hrsRef.current}/${lv.requiredHR} HR`,10,30);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 18px monospace';ctx.fillText(`${ballsRef.current}-${strikesRef.current}`,CW/2,26);ctx.fillStyle='#666';ctx.font='11px monospace';ctx.fillText('COUNT',CW/2,13);ctx.textAlign='right';ctx.fillStyle='#888';ctx.font='12px monospace';ctx.fillText(`AB ${Math.min(abRef.current+1,lv.totalABs)}/${lv.totalABs}`,CW-10,14);ctx.fillStyle=player.primaryColor;ctx.font='bold 12px monospace';ctx.fillText(player.name||'Player',CW-10,30)
      }
      animRef.current=requestAnimationFrame(loop)
    };animRef.current=requestAnimationFrame(loop);return()=>{run=false;cancelAnimationFrame(animRef.current)}
  },[throwPitch,processResult,lastResult,player])

  const handleMouseMove=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect();mouseRef.current={x:(e.clientX-r.left)*CW/r.width,y:(e.clientY-r.top)*CH/r.height}},[])
  const handleClick=useCallback(()=>{if(screenRef.current!=='PITCHING'||swingRef.current.swung||!pitchRef.current.active)return;const now=performance.now();swingRef.current={swung:true,swingTime:now,swingX:mouseRef.current.x,swingY:mouseRef.current.y};const p=pitchRef.current,el=now-p.throwTime,t=clamp(el/p.arrivalTime,0,1),e=easeIn(t);let px=lerp(p.startX,p.targetX,e),py=lerp(p.startY,p.targetY,e);const bt=clamp((t-0.7)/0.3,0,1);px+=p.horizBreak*easeOut(bt);py+=p.vertBreak*easeOut(bt);p.active=false;resultTimerRef.current=now;setScreen('SWING_RESULT');processResult(calcResult(mouseRef.current.x,mouseRef.current.y,now,px,py,p.arrivalTime,p.throwTime))},[calcResult,processResult])

  const startLevel=useCallback(()=>{setAbNumber(0);abRef.current=0;setStrikes(0);setBalls(0);setLevelHRs(0);hrsRef.current=0;setLevelHits(0);setLastResult(null);setScreen('AT_BAT');waitRef.current=true;pitchDelayRef.current=performance.now()+1200},[])
  const startCareer=useCallback(()=>{setLevelIdx(0);setCareerHR(0);setLongestHR(0);setMaxEV(0);setScreen('LEVEL_INTRO')},[])
  const nextLevel=useCallback(()=>{setLevelIdx(i=>i+1);setScreen('LEVEL_INTRO')},[])
  const confirmPlayer=useCallback(()=>{setPlayer({name:nameInput||'Slugger',teamName:teamInput||'Dingers',primaryColor:player.primaryColor,secondaryColor:player.secondaryColor});startCareer()},[nameInput,teamInput,player.primaryColor,player.secondaryColor,startCareer])

  const F=(f:string):React.CSSProperties=>({fontFamily:f})

  return(<div className="min-h-screen bg-[#0a0a0f] flex flex-col">
    <header className="border-b border-[#1e1e2e] bg-[#0a0a0f]/90 backdrop-blur px-4 py-3"><div className="max-w-5xl mx-auto flex items-center justify-between"><Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity"><span className="text-2xl">⚾</span><span style={F('Bebas Neue,sans-serif')} className="text-xl tracking-wider text-[#f59e0b]">DINGERS ONLY</span></Link><span style={F('Bebas Neue,sans-serif')} className="text-lg tracking-wider text-white/60">BATTING CAGE</span></div></header>
    <div className="flex-1 flex items-center justify-center p-4"><div className="relative w-full max-w-[800px]">
      <canvas ref={canvasRef} width={CW} height={CH} className="w-full rounded-xl border border-[#1e1e2e] shadow-2xl" style={{aspectRatio:`${CW}/${CH}`,cursor:(screen==='AT_BAT'||screen==='PITCHING')?'none':'default'}} onMouseMove={handleMouseMove} onClick={handleClick}/>

      {screen==='MENU'&&(<div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8"><div className="text-6xl mb-4">⚾</div><h1 style={F('Bebas Neue,sans-serif')} className="text-5xl tracking-wider text-[#f59e0b] mb-2">BATTING CAGE</h1><p style={F('DM Sans,sans-serif')} className="text-white/50 mb-8 max-w-md mx-auto">Work your way from the sandlot to The Show.</p><button onClick={()=>setScreen('CREATE_PLAYER')} className="px-8 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg text-lg font-bold" style={F('Bebas Neue,sans-serif')}>START CAREER</button><div className="mt-6 text-xs text-white/30" style={F('DM Sans,sans-serif')}>Move mouse to aim · Click to swing</div></div></div>)}

      {screen==='CREATE_PLAYER'&&(<div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8 w-full max-w-sm"><h2 style={F('Bebas Neue,sans-serif')} className="text-3xl tracking-wider text-[#f59e0b] mb-6">CREATE YOUR PLAYER</h2><div className="space-y-4 text-left"><div><label className="text-xs text-white/40 uppercase tracking-widest" style={F('Bebas Neue,sans-serif')}>Player Name</label><input value={nameInput} onChange={e=>setNameInput(e.target.value)} placeholder="Slugger" maxLength={16} className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]/50" style={F('JetBrains Mono,monospace')}/></div><div><label className="text-xs text-white/40 uppercase tracking-widest" style={F('Bebas Neue,sans-serif')}>Team Name</label><input value={teamInput} onChange={e=>setTeamInput(e.target.value)} placeholder="Dingers" maxLength={16} className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#f59e0b]/50" style={F('JetBrains Mono,monospace')}/></div><div><label className="text-xs text-white/40 uppercase tracking-widest" style={F('Bebas Neue,sans-serif')}>Primary Color</label><div className="flex gap-2 mt-2 flex-wrap">{COLOR_OPTIONS.map(c=>(<button key={c} onClick={()=>setPlayer(p=>({...p,primaryColor:c}))} className={`w-8 h-8 rounded-full border-2 transition-all ${player.primaryColor===c?'border-white scale-110':'border-transparent'}`} style={{backgroundColor:c}}/>))}</div></div><div><label className="text-xs text-white/40 uppercase tracking-widest" style={F('Bebas Neue,sans-serif')}>Secondary Color</label><div className="flex gap-2 mt-2 flex-wrap">{COLOR_OPTIONS.map(c=>(<button key={`s${c}`} onClick={()=>setPlayer(p=>({...p,secondaryColor:c}))} className={`w-8 h-8 rounded-full border-2 transition-all ${player.secondaryColor===c?'border-white scale-110':'border-transparent'}`} style={{backgroundColor:c}}/>))}</div></div></div><button onClick={confirmPlayer} className="mt-6 px-8 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg text-lg font-bold w-full" style={F('Bebas Neue,sans-serif')}>LET&apos;S GO</button></div></div>)}

      {screen==='LEVEL_INTRO'&&level&&(<div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8"><div className="text-5xl mb-3">{levelIdx===0?'🏏':levelIdx===1?'⚾':levelIdx===2?'🎓':'🏟️'}</div><h2 style={F('Bebas Neue,sans-serif')} className="text-4xl tracking-wider mb-1"><span style={{color:level.accentColor}}>{level.name}</span></h2><p style={F('DM Sans,sans-serif')} className="text-white/50 mb-6">{level.subtitle}</p><div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-6"><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={F('Bebas Neue,sans-serif')} className="text-xs tracking-widest text-white/40">GOAL</div><div style={F('JetBrains Mono,monospace')} className="text-xl text-white font-bold">{level.requiredHR} HR</div></div><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={F('Bebas Neue,sans-serif')} className="text-xs tracking-widest text-white/40">AT-BATS</div><div style={F('JetBrains Mono,monospace')} className="text-xl text-white font-bold">{level.totalABs}</div></div><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={F('Bebas Neue,sans-serif')} className="text-xs tracking-widest text-white/40">SPEED</div><div style={F('JetBrains Mono,monospace')} className="text-xl text-white font-bold">{level.pitchSpeedMin}-{level.pitchSpeedMax}</div></div></div><div className="mb-6"><div style={F('Bebas Neue,sans-serif')} className="text-xs tracking-widest text-white/30 mb-2">PITCHES</div><div className="flex justify-center gap-2">{level.pitchTypes.map(pt=>(<span key={pt} style={{...F('JetBrains Mono,monospace'),borderColor:PITCH_CONFIGS[pt].color}} className="text-xs px-2 py-1 rounded border text-white/70">{PITCH_CONFIGS[pt].name}</span>))}</div></div><button onClick={startLevel} className="px-8 py-3 rounded-lg text-lg font-bold text-black" style={{...F('Bebas Neue,sans-serif'),backgroundColor:level.accentColor}}>STEP UP TO THE PLATE</button></div></div>)}

      {screen==='LEVEL_COMPLETE'&&level&&(<div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8"><div className="text-5xl mb-3">🎉</div><h2 style={F('Bebas Neue,sans-serif')} className="text-4xl tracking-wider text-[#4ade80] mb-1">LEVEL CLEARED!</h2><p style={F('DM Sans,sans-serif')} className="text-white/50 mb-6">{player.name||'You'} crushed {level.name}!</p><div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6"><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={F('Bebas Neue,sans-serif')} className="text-xs tracking-widest text-white/40">HOME RUNS</div><div style={F('JetBrains Mono,monospace')} className="text-2xl text-[#f59e0b] font-bold">{levelHRs}</div></div><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={F('Bebas Neue,sans-serif')} className="text-xs tracking-widest text-white/40">HITS</div><div style={F('JetBrains Mono,monospace')} className="text-2xl text-white font-bold">{levelHits}</div></div></div><button onClick={nextLevel} className="px-8 py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-lg text-lg font-bold" style={F('Bebas Neue,sans-serif')}>NEXT LEVEL →</button></div></div>)}

      {screen==='LEVEL_FAILED'&&level&&(<div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8"><div className="text-5xl mb-3">😤</div><h2 style={F('Bebas Neue,sans-serif')} className="text-4xl tracking-wider text-[#ef4444] mb-1">SENT DOWN</h2><p style={F('DM Sans,sans-serif')} className="text-white/50 mb-6">Needed {level.requiredHR} HR but only hit {levelHRs}</p><div className="flex gap-3 justify-center"><button onClick={startLevel} className="px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg text-lg font-bold" style={F('Bebas Neue,sans-serif')}>TRY AGAIN</button><button onClick={()=>setScreen('MENU')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-lg font-bold" style={F('Bebas Neue,sans-serif')}>MAIN MENU</button></div></div></div>)}

      {screen==='CAREER_COMPLETE'&&(<div className="absolute inset-0 bg-[#0a0a0f]/90 backdrop-blur-sm rounded-xl flex items-center justify-center"><div className="text-center px-8"><div className="text-6xl mb-3">🏆</div><h2 style={F('Bebas Neue,sans-serif')} className="text-5xl tracking-wider text-[#f59e0b] mb-1">HALL OF FAME!</h2><p style={F('DM Sans,sans-serif')} className="text-white/50 mb-6">{player.name||'You'} is a legend of the {player.teamName||'Dingers'}!</p><div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6"><div className="bg-white/5 rounded-lg p-3 border border-[#f59e0b]/30"><div style={F('Bebas Neue,sans-serif')} className="text-xs tracking-widest text-[#f59e0b]">CAREER HR</div><div style={F('JetBrains Mono,monospace')} className="text-2xl text-[#f59e0b] font-bold">{careerHR}</div></div><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={F('Bebas Neue,sans-serif')} className="text-xs tracking-widest text-white/40">LONGEST</div><div style={F('JetBrains Mono,monospace')} className="text-2xl text-white font-bold">{longestHR} ft</div></div><div className="bg-white/5 rounded-lg p-3 border border-white/10"><div style={F('Bebas Neue,sans-serif')} className="text-xs tracking-widest text-white/40">MAX EV</div><div style={F('JetBrains Mono,monospace')} className="text-2xl text-white font-bold">{maxEV} mph</div></div></div><div className="flex gap-3 justify-center"><button onClick={()=>setScreen('CREATE_PLAYER')} className="px-8 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-lg text-lg font-bold" style={F('Bebas Neue,sans-serif')}>NEW CAREER</button><button onClick={()=>setScreen('MENU')} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-lg font-bold" style={F('Bebas Neue,sans-serif')}>MAIN MENU</button></div></div></div>)}
    </div></div>
    <footer className="border-t border-[#1e1e2e] px-4 py-3 text-center"><span style={F('DM Sans,sans-serif')} className="text-xs text-white/30">⚾ Dingers Only Batting Cage — <Link href="/" className="text-[#f59e0b]/60 hover:text-[#f59e0b] transition-colors">Back to League</Link></span></footer>
  </div>)
}
